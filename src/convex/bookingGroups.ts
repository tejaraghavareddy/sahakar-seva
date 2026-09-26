import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation, QueryCtx, MutationCtx } from "./_generated/server";
import { consume } from "./rateLimit";
import { WORKER_SHARE_RATE, WELFARE_RATE, priceService } from "./bookings";
import { Id } from "./_generated/dataModel";
import { v } from "convex/values";

/**
 * Shared ("group") bookings — the cooperative cost-split.
 *
 * The economics this solves are the ones that push informal workers off
 * platforms entirely: a visit charge is indivisible. A tap leaking costs ₹199
 * whether one flat pays it or fifty do, so the only way it feels affordable to
 * a household is if the work is shared. When three flats on one street all need
 * a plumber on the same evening, that is one visit for three households, not
 * three visits — the worker earns the same rate for one trip instead of three,
 * and each household pays a third.
 *
 * The job price itself never changes. `base`/`total` stay the full amount the
 * worker is paid and the 90/7/3 federation split is applied to that total once,
 * exactly as for a solo booking. Splitting happens on the *customer* side,
 * which keeps the cooperative's ledger arithmetic identical whether a job was
 * booked alone or by four neighbours.
 */

/** Guard rails on how many households may share one visit. */
export const MIN_SHARES = 2;
export const MAX_SHARES = 4;

/** How long a group stays open for more households. */
const OPEN_WINDOW_MS = 6 * 60 * 60; // 6 hours

/** Default catchment for a shared visit. */
export const DEFAULT_RADIUS_M = 3000;

async function requireUser(ctx: QueryCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("Not authenticated");
  return userId;
}

/** The household bookings attached to a group, oldest first. */
async function bookingsInGroup(
  ctx: QueryCtx | MutationCtx,
  groupId: Id<"bookingGroups">,
) {
  return await ctx.db
    .query("bookings")
    .withIndex("by_group", (q) => q.eq("groupId", groupId))
    .collect();
}

/**
 * Public, session-free surface: "3 people near you need a plumber this
 * evening". This is the discovery half of the innovation and it has to be
 * readable without a session, or nobody would ever find a group to join. It
 * therefore projects only what the pitch needs — trade, service, window, a
 * count and a distance — and never an address, a name or a user id.
 */
export const nearbyOpen = query({
  args: {
    /** Omit to see shared visits across every trade. */
    trade: v.optional(v.string()),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const open = await ctx.db
      .query("bookingGroups")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .collect();

    const visible = [];
    for (const g of open) {
      if (args.trade && g.trade !== args.trade) continue;
      if (g.windowEnd <= now) continue;
      // Never surface a group to someone outside its own catchment.
      if (args.lat !== undefined && args.lng !== undefined) {
        if (g.lat === undefined || g.lng === undefined) continue;
        if (haversineM(g.lat, g.lng, args.lat, args.lng) > g.radiusM) continue;
      }
      const filled = (await bookingsInGroup(ctx, g._id)).length;
      visible.push({
        _id: g._id,
        serviceId: g.serviceId,
        serviceName: g.serviceName,
        trade: g.trade,
        windowStart: g.windowStart,
        windowEnd: g.windowEnd,
        maxShares: g.maxShares,
        filled,
        spotsLeft: g.maxShares - filled,
        note: g.note,
        distM:
          args.lat !== undefined &&
          args.lng !== undefined &&
          g.lat !== undefined &&
          g.lng !== undefined
            ? Math.round(haversineM(g.lat, g.lng, args.lat, args.lng))
            : null,
      });
    }
    return visible
      .sort((a, b) => a.windowStart - b.windowStart || b.filled - a.filled)
      .slice(0, 20);
  },
});

/** Open groups the signed-in customer is part of. */
export const myGroups = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const open = await ctx.db
      .query("bookingGroups")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .collect();
    const mine = await ctx.db
      .query("bookings")
      .withIndex("by_customer", (q) => q.eq("customerId", userId))
      .collect();
    const mineGroups = new Set(
      mine.map((b) => b.groupId).filter((g): g is Id<"bookingGroups"> => !!g),
    );

    const out = [];
    for (const g of open) {
      if (!mineGroups.has(g._id)) continue;
      const rows = await bookingsInGroup(ctx, g._id);
      out.push({
        _id: g._id,
        serviceId: g.serviceId,
        serviceName: g.serviceName,
        trade: g.trade,
        windowStart: g.windowStart,
        windowEnd: g.windowEnd,
        maxShares: g.maxShares,
        filled: rows.length,
        myBookingId: rows.find((b) => b.customerId === userId)?._id ?? null,
        myShare: rows.find((b) => b.customerId === userId)?.shareAmount ?? null,
      });
    }
    return out;
  },
});

/** Full detail for one group — visible to its members and its creator. */
export const get = query({
  args: { id: v.id("bookingGroups") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const g = await ctx.db.get(args.id);
    if (!g) return null;
    const rows = await bookingsInGroup(ctx, g._id);
    const member = userId !== null && rows.some((b) => b.customerId === userId);
    if (!member && g.createdBy !== userId) return null;

    return {
      serviceId: g.serviceId,
      serviceName: g.serviceName,
      trade: g.trade,
      windowStart: g.windowStart,
      windowEnd: g.windowEnd,
      maxShares: g.maxShares,
      status: g.status,
      filled: rows.length,
      spotsLeft: g.maxShares - rows.length,
      participants: rows.map((b) => ({
        // Members see that other households are in, and nothing about who they
        // are. A raw customer id would be a stable handle on a neighbour's
        // account, and the other household's address is nobody's business.
        isYou: b.customerId === userId,
        shareAmount: b.shareAmount ?? null,
        paid: b.participantPaid ?? false,
      })),
    };
  },
});

/* ── mutations ── */

export const create = mutation({
  args: {
    serviceId: v.string(),
    address: v.string(),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    scheduledFor: v.number(),
    maxShares: v.number(),
    notes: v.optional(v.string()),
    welfareOptIn: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    await consume(ctx, "group", userId);
    if (args.maxShares < MIN_SHARES || args.maxShares > MAX_SHARES) {
      throw new Error("A shared visit takes 2 to 4 households");
    }
    if (!args.address.trim()) throw new Error("Address is required");
    // Price is resolved server-side before the group exists, so a service that
    // was never bookable cannot be smuggled into a group either.
    const svc = await priceService(ctx, args.serviceId);
    if (!svc) throw new Error("Unknown service");

    const groupId = await ctx.db.insert("bookingGroups", {
      serviceId: args.serviceId,
      trade: svc.trade,
      serviceName: svc.name,
      lat: args.lat,
      lng: args.lng,
      radiusM: DEFAULT_RADIUS_M,
      windowStart: args.scheduledFor,
      windowEnd: args.scheduledFor + OPEN_WINDOW_MS,
      maxShares: args.maxShares,
      status: "open",
      note: args.notes?.trim() || undefined,
      createdBy: userId,
      createdAt: Date.now(),
    });

    const bookingId = await addParticipant(ctx, groupId, userId, {
      address: args.address,
      lat: args.lat,
      lng: args.lng,
      scheduledFor: args.scheduledFor,
      notes: args.notes,
      welfareOptIn: args.welfareOptIn,
    });
    return { groupId, bookingId };
  },
});

export const join = mutation({
  args: { id: v.id("bookingGroups") },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    await consume(ctx, "group", userId);
    const g = await ctx.db.get(args.id);
    if (!g) throw new Error("Shared visit not found");
    // A full group gets its own message: "closed" is true but unhelpful, and this
    // is the one case a customer is most likely to hit deliberately.
    if (g.status === "full") throw new Error("This shared visit is already full");
    if (g.status !== "open") throw new Error("This shared visit is closed");
    if (Date.now() >= g.windowEnd) {
      throw new Error("This shared visit has closed");
    }

    const rows = await bookingsInGroup(ctx, g._id);
    if (rows.some((b) => b.customerId === userId)) {
      throw new Error("You are already in this shared visit");
    }
    if (rows.length >= g.maxShares) {
      throw new Error("This shared visit is already full");
    }

    return await addParticipant(ctx, g._id, userId, {
      // A joining household supplies its own address at dispatch; until then the
      // group only knows the neighbourhood, never a second address.
      address: "",
      lat: g.lat,
      lng: g.lng,
      scheduledFor: g.windowStart,
      notes: undefined,
      welfareOptIn: true,
    });
  },
});

export const leave = mutation({
  args: { id: v.id("bookingGroups") },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const g = await ctx.db.get(args.id);
    if (!g) throw new Error("Shared visit not found");
    if (g.status !== "open") throw new Error("This shared visit is closed");
    const rows = (await bookingsInGroup(ctx, g._id)).filter(
      (b) => b.customerId === userId,
    );
    if (rows.length === 0) throw new Error("You are not in this shared visit");
    for (const b of rows) {
      if (b.status !== "pending") {
        throw new Error("This visit is already under way");
      }
      await ctx.db.delete(b._id);
    }
  },
});

/* ── internals ── */

type ParticipantArgs = {
  address: string;
  lat: number | undefined;
  lng: number | undefined;
  scheduledFor: number;
  notes: string | undefined;
  welfareOptIn: boolean;
};

/**
 * Write this household's half of a shared visit.
 *
 * The amounts are recomputed from the live catalogue rather than accepted from
 * the client, so a crafted group request cannot set its own price — the same
 * reason `bookings.create` takes no price argument.
 */
async function addParticipant(
  ctx: MutationCtx,
  groupId: Id<"bookingGroups">,
  customerId: Id<"users">,
  args: ParticipantArgs,
): Promise<Id<"bookings">> {
  const g = await ctx.db.get(groupId);
  if (!g) throw new Error("Shared visit not found");

  const svc = await priceService(ctx, g.serviceId);
  if (!svc) throw new Error("Unknown service");

  const rows = await bookingsInGroup(ctx, groupId);
  if (rows.length >= g.maxShares) throw new Error("This shared visit is full");

  // The worker is paid the whole visit price; the household pays its slice.
  // Per-head is floored to whole rupees and the rounding remainder is carried by
  // the first participant, so `sum(shareAmount) === total` always holds exactly
  // and no fraction of a rupee is created or lost by splitting.
  const total = svc.base;
  const perHead = Math.floor(total / g.maxShares);
  const remainder = total - perHead * g.maxShares;

  const workerShare = Math.round(total * WORKER_SHARE_RATE);
  const welfareAmt = Math.round(total * WELFARE_RATE);
  const opsAmt = total - workerShare - welfareAmt;

  const isFirst = rows.length === 0;
  const shareAmount = isFirst ? perHead + remainder : perHead;

  const bookingId = await ctx.db.insert("bookings", {
    customerId,
    serviceId: g.serviceId,
    customServiceId: svc.customServiceId,
    trade: svc.trade,
    serviceName: svc.name,
    address: args.address.trim() || svc.name,
    lat: args.lat,
    lng: args.lng,
    scheduledFor: args.scheduledFor,
    urgent: svc.urgent,
    emergency: false,
    notes: args.notes?.trim() || undefined,
    welfareOptIn: args.welfareOptIn,
    base: total,
    hourly: svc.hourly,
    welfareAmt,
    opsAmt,
    workerShare,
    total,
    status: "pending",
    groupId,
    shareCount: g.maxShares,
    shareAmount,
    participantPaid: false,
    createdAt: Date.now(),
  });

  // A filled group is real work: it goes onto the workers' radar like any other
  // pending job, one job, one visit.
  if (rows.length + 1 >= g.maxShares) {
    await ctx.db.patch(groupId, { status: "full" });
  }
  return bookingId;
}

/** Great-circle distance in metres. */
function haversineM(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
