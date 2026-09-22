import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation, QueryCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { v } from "convex/values";

async function requireUser(ctx: QueryCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("Not authenticated");
  return userId;
}

async function isAdminUser(
  ctx: QueryCtx,
  userId: Id<"users">,
): Promise<boolean> {
  const user = await ctx.db.get(userId);
  if (!user) return false;
  if (user.email === "teja200822@gmail.com") return true;
  return user.role === "admin";
}

/** Federation console stats — booking pipeline, workers, welfare pool. */
export const overview = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    if (!(await isAdminUser(ctx, userId))) throw new Error("Forbidden");

    const bookings = await ctx.db.query("bookings").collect();
    const artisans = await ctx.db.query("artisans").collect();

    const byStatus: Record<string, number> = {};
    let revenueSettled = 0;
    let welfarePool = 0;
    let workerPayouts = 0;
    let opsPool = 0;
    for (const b of bookings) {
      byStatus[b.status] = (byStatus[b.status] ?? 0) + 1;
      if (b.status === "settled" || b.status === "completed") {
        revenueSettled += b.base;
        welfarePool += b.welfareAmt ?? 0;
        workerPayouts += b.workerShare ?? Math.round(b.base * 0.9);
        opsPool += b.opsAmt ?? Math.max(0, b.base - (b.welfareAmt ?? 0) - Math.round(b.base * 0.9));
      }
    }

    const byTrade: Record<string, number> = {};
    let online = 0;
    let verified = 0;
    let credentials = 0;
    for (const a of artisans) {
      byTrade[a.trade] = (byTrade[a.trade] ?? 0) + 1;
      if (a.isOnline) online += 1;
      if (a.kycStatus === "verified") verified += 1;
      if (a.quizPassed) credentials += 1;
    }

    return {
      bookings: bookings.length,
      byStatus,
      revenueSettled,
      welfarePool,
      workerPayouts,
      opsPool,
      workers: artisans.length,
      online,
      verified,
      credentials,
      byTrade,
    };
  },
});

/** Full worker directory for the admin console. */
export const workerDirectory = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    if (!(await isAdminUser(ctx, userId))) throw new Error("Forbidden");
    return await ctx.db.query("artisans").order("desc").take(200);
  },
});

export const amAdmin = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return false;
    return isAdminUser(ctx, userId);
  },
});

/** Artisans pending KYC verification (formal registration pipeline). */
export const verificationQueue = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    if (!(await isAdminUser(ctx, userId))) throw new Error("Forbidden");
    return await ctx.db
      .query("artisans")
      .withIndex("by_kyc", (q) => q.eq("kycStatus", "pending"))
      .take(200);
  },
});

/** Approve or reject an artisan's KYC identity verification. */
export const reviewKyc = mutation({
  args: {
    artisanId: v.id("artisans"),
    approve: v.boolean(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    if (!(await isAdminUser(ctx, userId))) throw new Error("Forbidden");
    const artisan = await ctx.db.get(args.artisanId);
    if (!artisan) throw new Error("Artisan not found");
    if (artisan.kycStatus !== "pending") {
      throw new Error("This artisan's KYC is not pending review");
    }
    const now = Date.now();
    const kycRef = `BGC-${now.toString(36).toUpperCase().slice(-8)}`;
    await ctx.db.patch(args.artisanId, {
      kycStatus: args.approve ? "verified" : "rejected",
      ...(args.approve
        ? { kycVerifiedAt: now, kycRef }
        : { reviewNote: args.note?.trim() || "Rejected by federation officer" }),
    });
  },
});

/** Admin cancels any active booking (federation override). */
export const adminCancelBooking = mutation({
  args: { id: v.id("bookings") },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    if (!(await isAdminUser(ctx, userId))) throw new Error("Forbidden");
    const b = await ctx.db.get(args.id);
    if (!b) throw new Error("Booking not found");
    if (["completed", "settled", "cancelled"].includes(b.status)) {
      throw new Error("Booking already closed");
    }
    await ctx.db.patch(b._id, {
      status: "cancelled",
      cancelledAt: Date.now(),
      cancelBy: "admin",
    });
  },
});
