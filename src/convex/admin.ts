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
    for (const b of bookings) {
      byStatus[b.status] = (byStatus[b.status] ?? 0) + 1;
      if (b.status === "settled" || b.status === "completed") {
        revenueSettled += b.base;
        welfarePool += b.welfareAmt;
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
