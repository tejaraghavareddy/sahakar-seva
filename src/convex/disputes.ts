import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation, QueryCtx } from "./_generated/server";
import { DEMO_ADMIN_EMAILS } from "./admin";
import { consume } from "./rateLimit";
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
  // Demo admin (removable — see DEMO_ADMIN_EMAILS in admin.ts)
  if (DEMO_ADMIN_EMAILS.includes(user.email ?? "")) return true;
  return user.role === "admin";
}

/** Raise a dispute on a booking (customer or worker side, double-blind). */
export const raise = mutation({
  args: {
    bookingId: v.id("bookings"),
    category: v.string(),
    details: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("Not authenticated");

    const booking = await ctx.db.get(args.bookingId);
    if (!booking) throw new Error("Booking not found");

    const isCustomer = booking.customerId === userId;
    const isWorker = booking.workerUserId === userId;
    if (!isCustomer && !isWorker) {
      throw new Error("Only the customer or assigned worker can flag this booking");
    }
    // Charged only after the caller is confirmed to be a party to this
    // booking, so the budget cannot be drained against arbitrary booking ids.
    await consume(ctx, "dispute", userId);
    if (!args.details.trim()) throw new Error("Please describe the issue");

    return await ctx.db.insert("disputes", {
      bookingId: args.bookingId,
      raisedBy: userId,
      raisedByRole: isCustomer ? "customer" : "worker",
      category: args.category,
      details: args.details.trim(),
      status: "open",
      createdAt: Date.now(),
    });
  },
});

/** All disputes for the arbitration board, newest first. */
export const listForAdmin = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    if (!(await isAdminUser(ctx, userId))) throw new Error("Forbidden");
    return await ctx.db.query("disputes").order("desc").take(200);
  },
});

/** Whether the current member has already flagged a given booking. */
export const myDisputeForBooking = query({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const mine = await ctx.db
      .query("disputes")
      .filter((q) => q.eq(q.field("raisedBy"), userId))
      .filter((q) => q.eq(q.field("bookingId"), args.bookingId))
      .first();
    return mine;
  },
});

/** Board resolution: resolve, dismiss, or blacklist the abusive account. */
export const resolve = mutation({
  args: {
    id: v.id("disputes"),
    status: v.union(
      v.literal("resolved"),
      v.literal("dismissed"),
      v.literal("blacklisted"),
    ),
    resolution: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    if (!(await isAdminUser(ctx, userId))) throw new Error("Forbidden");
    const dispute = await ctx.db.get(args.id);
    if (!dispute) throw new Error("Dispute not found");
    if (dispute.status !== "open") {
      throw new Error("This dispute has already been arbitrated");
    }
    await ctx.db.patch(args.id, {
      status: args.status,
      resolution: args.resolution?.trim() || undefined,
      resolvedBy: userId,
      resolvedAt: Date.now(),
    });

    // Blacklisting suspends the artisan's account from the radar.
    if (args.status === "blacklisted") {
      const booking = await ctx.db.get(dispute.bookingId);
      const workerUserId = booking?.workerUserId;
      if (workerUserId && dispute.raisedByRole === "worker") {
        const artisan = await ctx.db
          .query("artisans")
          .withIndex("by_userId", (q) => q.eq("userId", workerUserId))
          .first();
        if (artisan) {
          await ctx.db.patch(artisan._id, { isOnline: false, kycStatus: "rejected" });
        }
      }
    }
  },
});

/** My open disputes (customer or worker portal view). */
export const myDisputes = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    return await ctx.db
      .query("disputes")
      .filter((q) => q.eq(q.field("raisedBy"), userId))
      .order("desc")
      .take(50);
  },
});
