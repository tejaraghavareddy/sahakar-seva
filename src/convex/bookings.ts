import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation, QueryCtx, MutationCtx } from "./_generated/server";
import { DEMO_ADMIN_EMAILS } from "./admin";
import { consume } from "./rateLimit";
import { parseCustomServiceId } from "./customServices";
import { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";

/* ── Server-side service pricing (kept free of client/UI imports) ── */

interface ServicePrice {
  trade: string;
  name: string;
  base: number;
  hourly: number;
  urgent: boolean;
}

const SERVICE_PRICES: Record<string, ServicePrice> = {
  "el-fan": { trade: "electrician", name: "Ceiling fan install or repair", base: 149, hourly: 250, urgent: false },
  "el-wire": { trade: "electrician", name: "Full house wiring check", base: 299, hourly: 350, urgent: false },
  "el-short": { trade: "electrician", name: "Short circuit / power failure", base: 249, hourly: 400, urgent: true },
  "el-light": { trade: "electrician", name: "Light & switch fittings", base: 129, hourly: 250, urgent: false },
  "pl-tap": { trade: "plumber", name: "Tap & mixer repair", base: 129, hourly: 250, urgent: false },
  "pl-block": { trade: "plumber", name: "Blocked drain clearing", base: 199, hourly: 300, urgent: true },
  "pl-tank": { trade: "plumber", name: "Tank & flush repair", base: 199, hourly: 300, urgent: false },
  "pl-pipe": { trade: "plumber", name: "Hidden pipe leak trace", base: 299, hourly: 350, urgent: false },
  "ca-door": { trade: "carpenter", name: "Door & lock alignment", base: 199, hourly: 300, urgent: false },
  "ca-furn": { trade: "carpenter", name: "Furniture repair", base: 249, hourly: 350, urgent: false },
  "ca-modular": { trade: "carpenter", name: "Modular fittings", base: 179, hourly: 300, urgent: false },
  "ca-measure": { trade: "carpenter", name: "Custom build consultation", base: 299, hourly: 0, urgent: false },
  "ma-crack": { trade: "mason", name: "Wall crack sealing", base: 299, hourly: 350, urgent: false },
  "ma-water": { trade: "mason", name: "Seepage & dampness fix", base: 499, hourly: 400, urgent: false },
  "ma-tile": { trade: "mason", name: "Tile replacement", base: 249, hourly: 350, urgent: false },
  "ma-plaster": { trade: "mason", name: "Plaster patch work", base: 249, hourly: 350, urgent: false },
  "pa-room": { trade: "painter", name: "Single room repaint", base: 999, hourly: 0, urgent: false },
  "pa-wall": { trade: "painter", name: "Patch & touch-up", base: 299, hourly: 300, urgent: false },
  "pa-texture": { trade: "painter", name: "Texture & accent wall", base: 699, hourly: 0, urgent: false },
  "pa-waterproof": { trade: "painter", name: "Waterproof coating", base: 899, hourly: 0, urgent: false },
  "ap-ac": { trade: "appliance", name: "AC service & gas top-up", base: 449, hourly: 350, urgent: false },
  "ap-fridge": { trade: "appliance", name: "Refrigerator repair", base: 299, hourly: 350, urgent: true },
  "ap-wm": { trade: "appliance", name: "Washing machine repair", base: 299, hourly: 350, urgent: false },
  "ap-mw": { trade: "appliance", name: "Microwave & oven fix", base: 299, hourly: 350, urgent: false },
};

/** Pricing for a service, from the standard catalog or a worker listing. */
interface PricedService {
  trade: string;
  name: string;
  base: number;
  hourly: number;
  urgent: boolean;
  customServiceId?: Id<"customServices">;
}

/**
 * Resolve the price of the requested service. `cs_<id>` addresses a
 * worker-created listing, which is only bookable once the board approved it.
 */
async function priceService(
  ctx: QueryCtx | MutationCtx,
  serviceId: string,
): Promise<PricedService | null> {
  const customId = parseCustomServiceId(serviceId);
  if (customId) {
    let row: Doc<"customServices"> | null = null;
    try {
      row = await ctx.db.get(customId as Id<"customServices">);
    } catch {
      return null;
    }
    if (!row || row.status !== "approved") return null;
    return {
      trade: row.trade,
      name: row.name,
      base: row.base,
      hourly: row.hourly,
      urgent: row.urgent,
      customServiceId: row._id,
    };
  }
  const svc = SERVICE_PRICES[serviceId];
  return svc ? { ...svc } : null;
}

/* ── Cooperative revenue distribution ──
 * Every booking amount splits three ways:
 *   90% → worker payout (direct UPI settlement to the artisan)
 *    7% → worker welfare fund (pension, insurance, family support)
 *    3% → operational costs (dispatch, telemetry, verification board)
 */
export const WORKER_SHARE_RATE = 0.9;
export const WELFARE_RATE = 0.07;
export const OPS_RATE = 0.03;
const NEXT_STATUS: Record<string, string> = {
  accepted: "enroute",
  enroute: "inprogress",
  inprogress: "payment",
  payment: "completed",
  completed: "settled",
};

/* ── helpers ── */

async function requireUser(ctx: QueryCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("Not authenticated");
  return userId;
}

async function getMyArtisan(ctx: QueryCtx, userId: Id<"users">) {
  return await ctx.db
    .query("artisans")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .first();
}

async function isAdminUser(
  ctx: QueryCtx,
  userId: Id<"users">,
): Promise<boolean> {
  const user = await ctx.db.get(userId);
  if (!user) return false;
  if (user.email === "teja200822@gmail.com") return true;
  // Demo admin (removable — see DEMO_ADMIN_EMAILS in admin.ts)
  if (DEMO_ADMIN_EMAILS.includes(user.email ?? "")) return true;
  return user.role === "admin";
}

async function canSeeBooking(
  ctx: QueryCtx,
  userId: Id<"users">,
  b: Doc<"bookings"> | null,
) {
  if (!b) return false;
  if (b.customerId === userId) return true;
  if (b.workerUserId === userId) return true;
  return await isAdminUser(ctx, userId);
}

/* ── customer: create ── */

export const create = mutation({
  args: {
    serviceId: v.string(),
    address: v.string(),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    scheduledFor: v.number(),
    urgent: v.boolean(),
    notes: v.optional(v.string()),
    welfareOptIn: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    // Every booking becomes a live dispatch on the workers' radar, so creation
    // is rate limited per customer before any work is done.
    await consume(ctx, "booking", userId);
    const svc = await priceService(ctx, args.serviceId);
    if (!svc) throw new Error("Unknown service");
    if (!args.address.trim()) throw new Error("Address is required");
    // Cooperative split applied on the gross amount — always, not opt-in.
    const workerShare = Math.round(svc.base * WORKER_SHARE_RATE);
    const welfareAmt = Math.round(svc.base * WELFARE_RATE);
    const opsAmt = svc.base - workerShare - welfareAmt; // exactly 3%, no rounding drift
    const bookingId = await ctx.db.insert("bookings", {
      customerId: userId,
      serviceId: args.serviceId,
      customServiceId: svc.customServiceId,
      trade: svc.trade,
      serviceName: svc.name,
      address: args.address.trim(),
      lat: args.lat,
      lng: args.lng,
      scheduledFor: args.scheduledFor,
      urgent: args.urgent && svc.urgent,
      notes: args.notes?.trim() || undefined,
      welfareOptIn: args.welfareOptIn,
      base: svc.base,
      hourly: svc.hourly,
      welfareAmt,
      opsAmt,
      workerShare,
      total: svc.base,
      status: "pending",
      createdAt: Date.now(),
    });
    return bookingId;
  },
});

/* ── lists ── */

export const listForCustomer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    return await ctx.db
      .query("bookings")
      .withIndex("by_customer", (q) => q.eq("customerId", userId))
      .order("desc")
      .take(50);
  },
});

/** Jobs assigned to the signed-in worker + open radar pool for their trade. */
export const listForWorker = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const me = await getMyArtisan(ctx, userId);
    if (!me) return { mine: [], radar: [] };
    const mine = await ctx.db
      .query("bookings")
      .withIndex("by_worker", (q) => q.eq("workerUserId", userId))
      .order("desc")
      .take(50);
    const all = await ctx.db.query("bookings").order("desc").take(200);
    const radar = all.filter(
      (b) =>
        b.status === "pending" &&
        b.trade === me.trade &&
        b.workerUserId === undefined,
    );
    // Flag the entries that came from this worker's own published listing so
    // the hub can mark them as their own category of work.
    const myListingIds = new Set<string>();
    for (const b of radar) {
      if (!b.customServiceId) continue;
      const listing = await ctx.db.get(b.customServiceId);
      if (listing?.userId === userId) myListingIds.add(b._id);
    }
    const flagged = radar.map((b) => ({
      ...b,
      myListing: myListingIds.has(b._id),
    }));
    return { mine, radar: flagged.slice(0, 20) };
  },
});

export const listForAdmin = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    if (!(await isAdminUser(ctx, userId))) throw new Error("Forbidden");
    return await ctx.db.query("bookings").order("desc").take(200);
  },
});

/* ── detail + chat ── */

export const getBooking = query({
  args: { id: v.id("bookings") },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const b = await ctx.db.get(args.id);
    if (!b || !(await canSeeBooking(ctx, userId, b))) return null;
    return b;
  },
});

export const listMessages = query({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const b = await ctx.db.get(args.bookingId);
    if (!b || !(await canSeeBooking(ctx, userId, b))) return [];
    return await ctx.db
      .query("messages")
      .withIndex("by_booking", (q) => q.eq("bookingId", args.bookingId))
      .order("asc")
      .take(200);
  },
});

export const sendMessage = mutation({
  args: { bookingId: v.id("bookings"), body: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const b = await ctx.db.get(args.bookingId);
    if (!b || !(await canSeeBooking(ctx, userId, b))) {
      throw new Error("Not allowed");
    }
    const body = args.body.trim();
    if (!body) throw new Error("Empty message");
    // Charged only after the sender is known to belong to the conversation, so
    // the budget cannot be drained by poking ids they do not own.
    await consume(ctx, "message", userId);
    const user = await ctx.db.get(userId);
    const me = await getMyArtisan(ctx, userId);
    const role =
      b.customerId === userId ? "customer" : me ? "worker" : "admin";
    await ctx.db.insert("messages", {
      bookingId: args.bookingId,
      senderId: userId,
      senderName: user?.name ?? me?.fullName ?? "Member",
      senderRole: role,
      body: body.slice(0, 1000),
      at: Date.now(),
    });
  },
});

/* ── worker lifecycle ── */

export const accept = mutation({
  args: { id: v.id("bookings") },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const me = await getMyArtisan(ctx, userId);
    if (!me || !me.quizPassed || me.kycStatus !== "verified") {
      throw new Error("Verified credential required to accept jobs.");
    }
    const b = await ctx.db.get(args.id);
    if (!b) throw new Error("Booking not found");
    if (b.status !== "pending") throw new Error("No longer available");
    // The job radar only ever *shows* a worker their own trade, but that is a
    // UI convenience, not a control: the mutation is publicly callable with any
    // booking id, so the trade match has to be enforced here too or a plumber
    // could claim an electrical job simply by knowing its id.
    if (b.trade !== me.trade) {
      throw new Error("This job is not in your trade.");
    }
    await ctx.db.patch(b._id, {
      status: "accepted",
      workerId: me._id,
      workerUserId: userId,
      workerVpa: me.upiVpa,
      acceptedAt: Date.now(),
    });
  },
});

/** Worker advances the job along the lifecycle, one stage at a time. */
export const advance = mutation({
  args: { id: v.id("bookings") },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const b = await ctx.db.get(args.id);
    if (!b) throw new Error("Booking not found");
    if (b.workerUserId !== userId) throw new Error("Not your job");
    const next = NEXT_STATUS[b.status];
    if (!next) throw new Error(`Cannot advance from ${b.status}`);
    const patch: Record<string, unknown> = { status: next };
    if (next === "settled") patch.settledAt = Date.now();
    await ctx.db.patch(b._id, patch);
    return next;
  },
});

/** Customer confirms the UPI payment by submitting the UTR reference. */
export const confirmUtr = mutation({
  args: { id: v.id("bookings"), utr: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const b = await ctx.db.get(args.id);
    if (!b) throw new Error("Booking not found");
    if (b.customerId !== userId) throw new Error("Not your booking");
    if (b.status !== "payment") throw new Error("Not awaiting payment");
    const utr = args.utr.trim();
    if (utr.length < 6) throw new Error("Enter a valid UTR / reference");
    await ctx.db.patch(b._id, {
      utr,
      paidAt: Date.now(),
      status: "completed",
    });
    // 7% welfare share accrues to the artisan's cooperative welfare ledger
    if (b.welfareAmt > 0 && b.workerId) {
      const w = await ctx.db.get(b.workerId);
      if (w) {
        await ctx.db.patch(w._id, {
          welfareBalance: (w.welfareBalance ?? 0) + b.welfareAmt,
        });
      }
    }
  },
});

/* ── cancellation (customer / assigned worker / admin) ── */

export const cancel = mutation({
  args: { id: v.id("bookings"), by: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const b = await ctx.db.get(args.id);
    if (!b) throw new Error("Booking not found");
    const admin = await isAdminUser(ctx, userId);
    const allowed =
      b.customerId === userId ||
      b.workerUserId === userId ||
      admin;
    if (!allowed) throw new Error("Not allowed");
    if (["completed", "settled", "cancelled"].includes(b.status)) {
      throw new Error("Booking can no longer be cancelled");
    }
    await ctx.db.patch(b._id, {
      status: "cancelled",
      cancelledAt: Date.now(),
      cancelBy: admin && b.customerId !== userId && b.workerUserId !== userId ? "admin" : args.by,
    });
  },
});
