import { query } from "./_generated/server";
import { isAdminUser, requireUser } from "./identity";
import { Id } from "./_generated/dataModel";
import { v } from "convex/values";

/**
 * Everything the Federation GIS command map renders in one subscription:
 * geo-located artisans, active dispatch demand, and society HQs.
 */
export const mapData = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    if (!(await isAdminUser(ctx, userId))) throw new Error("Forbidden");

    const allArtisans = await ctx.db.query("artisans").collect();
    const artisans = allArtisans.filter((a) => !a.removedAt);
    const bookings = await ctx.db.query("bookings").order("desc").take(400);
    const societies = await ctx.db.query("societies").take(200);

    const active = new Set(["pending", "accepted", "enroute", "inprogress"]);

    return {
      artisans: artisans.map((a) => ({
        _id: a._id,
        fullName: a.fullName,
        trade: a.trade,
        district: a.district,
        phone: a.phone,
        lat: a.lat,
        lng: a.lng,
        isOnline: a.isOnline,
        kycStatus: a.kycStatus,
        quizPassed: a.quizPassed,
        credentialId: a.credentialId,
        telemetryAt: a.telemetryAt,
      })),
      bookings: bookings
        .filter((b) => active.has(b.status) && b.lat !== undefined && b.lng !== undefined)
        .map((b) => ({
          _id: b._id,
          serviceName: b.serviceName,
          trade: b.trade,
          status: b.status,
          urgent: b.urgent,
          address: b.address,
          lat: b.lat,
          lng: b.lng,
          scheduledFor: b.scheduledFor,
        })),
      societies: societies.map((s) => ({
        _id: s._id,
        name: s.name,
        code: s.code,
        district: s.district,
        state: s.state,
        status: s.status,
        registrationNo: s.registrationNo,
        lat: s.lat,
        lng: s.lng,
      })),
      // Raw demand points (any booking with coords, incl. closed) for the
      // underserved-area heatmap intensity rendering.
      demandPoints: bookings
        .filter((b) => b.lat !== undefined && b.lng !== undefined)
        .map((b) => ({
          trade: b.trade,
          lat: b.lat as number,
          lng: b.lng as number,
          status: b.status,
        })),
    };
  },
});

/**
 * Live radar payload for one booking: destination coordinates plus the
 * assigned artisan's latest GPS telemetry. Only participants / admin.
 */
export const radar = query({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const b = await ctx.db.get(args.bookingId);
    if (!b) return null;
    if (!(b.customerId === userId || b.workerUserId === userId)) {
      if (!(await isAdminUser(ctx, userId))) return null;
    }
    let worker: {
      artisanId: Id<"artisans">;
      fullName: string;
      trade: string;
      lat?: number;
      lng?: number;
      telemetryAt?: number;
      isOnline: boolean;
    } | null = null;
    if (b.workerId) {
      const a = await ctx.db.get(b.workerId);
      if (a) {
        worker = {
          artisanId: a._id,
          fullName: a.fullName,
          trade: a.trade,
          lat: a.lat,
          lng: a.lng,
          telemetryAt: a.telemetryAt,
          isOnline: a.isOnline,
        };
      }
    }
    return {
      booking: {
        _id: b._id,
        status: b.status,
        address: b.address,
        lat: b.lat,
        lng: b.lng,
      },
      worker,
    };
  },
});

/**
 * District operational telemetry for the Gemini demand-forecasting prompt:
 * per-trade artisan supply (total/online/verified) vs unserviced demand.
 */
export const forecastContext = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    if (!(await isAdminUser(ctx, userId))) throw new Error("Forbidden");

    const artisans = await ctx.db.query("artisans").collect();
    const bookings = await ctx.db.query("bookings").order("desc").take(500);
    const societies = await ctx.db.query("societies").collect();

    const trades = [
      "electrician",
      "plumber",
      "carpenter",
      "mason",
      "painter",
      "appliance",
    ];
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const active = new Set(["pending", "accepted", "enroute", "inprogress"]);

    const perTrade: Record<
      string,
      { artisans: number; online: number; verified: number; unserviced: number; booked24h: number }
    > = {};
    for (const t of trades) perTrade[t] = { artisans: 0, online: 0, verified: 0, unserviced: 0, booked24h: 0 };
    for (const a of artisans) {
      const s = perTrade[a.trade];
      if (!s) continue;
      s.artisans += 1;
      if (a.isOnline) s.online += 1;
      if (a.kycStatus === "verified") s.verified += 1;
    }
    for (const b of bookings) {
      const s = perTrade[b.trade];
      if (!s) continue;
      if (active.has(b.status)) s.unserviced += 1;
      if (b.createdAt >= dayAgo) s.booked24h += 1;
    }

    const districts: Record<string, number> = {};
    for (const a of artisans) districts[a.district] = (districts[a.district] ?? 0) + 1;

    return {
      perTrade,
      districts,
      totalUnserviced: bookings.filter((b) => active.has(b.status)).length,
      totalBookings: bookings.length,
      societiesActive: societies.filter((s) => s.status === "active").length,
      welfarePoolAccrued: bookings
        .filter((b) => b.status === "settled" || b.status === "completed")
        .reduce((sum, b) => sum + b.welfareAmt, 0),
      generatedAt: Date.now(),
    };
  },
});
