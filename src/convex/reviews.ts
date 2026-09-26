import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation, QueryCtx, MutationCtx } from "./_generated/server";
import { consume } from "./rateLimit";
import { isAdminUser } from "./identity";
import { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";

/**
 * Customer reputation.
 *
 * Verification and reputation answer two different questions. A verified
 * credential says "this worker is who they claim to be". A review says "the
 * work was good". Customers need both: the neighbourhood has no way to check a
 * licence the way it can ask a neighbour, so the record of past work is the
 * signal that actually drives the booking decision.
 *
 * Two rules make the number worth anything:
 *  1. A review can only be written by the customer of a booking that reached
 *     `completed`. That anchors every score to work that really happened, and
 *     makes "review bombing a competitor" impossible without first paying for
 *     their services.
 *  2. One review per booking, enforced here rather than by a uniqueness index
 *     (Convex has no unique constraints and a racing double-tap would otherwise
 *     land two rows).
 */

const MAX_RATING = 5;
const MIN_RATING = 1;

/** Tag vocabulary. Kept closed so the chip UI and the stored data agree. */
export const REVIEW_TAGS = [
  "on_time",
  "clean_work",
  "fair_price",
  "polite",
] as const;

async function requireUser(ctx: QueryCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("Not authenticated");
  return userId;
}
/**
 * Recompute an artisan's denormalised rating from the reviews table.
 *
 * Called inside the same transaction as the review insert, so the average on the
 * public profile can never drift away from the reviews that produced it.
 */
async function recomputeRating(ctx: MutationCtx, artisanId: Id<"artisans">) {
  const all = await ctx.db
    .query("reviews")
    .withIndex("by_artisan", (q) => q.eq("artisanId", artisanId))
    .collect();
  const count = all.length;
  const avg =
    count === 0
      ? undefined
      : Math.round(
          (all.reduce((sum, r) => sum + r.rating, 0) / count) * 10,
        ) / 10;
  await ctx.db.patch(artisanId, { ratingAvg: avg, ratingCount: count });
}

/* ── write ── */

export const submit = mutation({
  args: {
    bookingId: v.id("bookings"),
    rating: v.number(),
    comment: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const b = await ctx.db.get(args.bookingId);
    if (!b) throw new Error("Booking not found");
    // The review is a statement about a specific piece of work this customer
    // paid for. Anything other than that customer, or any status short of a
    // finished job, is refused.
    if (b.customerId !== userId) throw new Error("Not your booking");
    if (b.status !== "completed" && b.status !== "settled") {
      throw new Error("You can review once the work is completed.");
    }
    if (!Number.isInteger(args.rating)) throw new Error("Invalid rating");
    if (args.rating < MIN_RATING || args.rating > MAX_RATING) {
      throw new Error("Invalid rating");
    }
    // A completed job always has an assigned worker, but the booking row can be
    // written directly by an admin action or a test, so a review is never
    // allowed to become an orphan with no artisan to attach to.
    if (!b.workerId) throw new Error("This booking has no worker to review");
    const artisanId = b.workerId;

    const existing = await ctx.db
      .query("reviews")
      .withIndex("by_booking", (q) => q.eq("bookingId", args.bookingId))
      .first();
    if (existing) throw new Error("You have already reviewed this work");

    // Reviews are cheap to write but they move a worker's public reputation, so
    // they get the same per-person budget as listings.
    await consume(ctx, "review", userId);

    const tags = (args.tags ?? []).filter((t) =>
      (REVIEW_TAGS as readonly string[]).includes(t),
    );

    const reviewId = await ctx.db.insert("reviews", {
      bookingId: args.bookingId,
      customerId: userId,
      artisanId,
      rating: args.rating,
      comment: args.comment?.trim().slice(0, 500) || undefined,
      tags: tags.length ? tags : undefined,
      createdAt: Date.now(),
    });

    await recomputeRating(ctx, artisanId);
    return reviewId;
  },
});

/* ── read ── */

/** Public review feed for a worker, newest first. */
export const forArtisan = query({
  args: { artisanId: v.id("artisans") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("reviews")
      .withIndex("by_artisan", (q) => q.eq("artisanId", args.artisanId))
      .order("desc")
      .take(50);
    // Reviewer identity is reduced to a display name: a public reputation feed
    // must not be a directory of customer email addresses or ids.
    const out = [];
    for (const r of rows) {
      out.push({
        _id: r._id,
        rating: r.rating,
        comment: r.comment,
        tags: r.tags,
        createdAt: r.createdAt,
        reviewerName: firstNameOf(await ctx.db.get(r.customerId)),
      });
    }
    return out;
  },
});

function firstNameOf(user: Doc<"users"> | null): string {
  const name = user?.name?.trim();
  if (!name) return "Customer";
  return name.split(/\s+/)[0];
}

/** The single review attached to a booking, if any. */
export const forBooking = query({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const b = await ctx.db.get(args.bookingId);
    if (!b) return null;
    const isParty =
      b.customerId === userId ||
      b.workerUserId === userId ||
      (await isAdminUser(ctx, userId));
    if (!isParty) return null;
    return await ctx.db
      .query("reviews")
      .withIndex("by_booking", (q) => q.eq("bookingId", args.bookingId))
      .first();
  },
});

/** Reviews written by the signed-in customer, for their own history view. */
export const myReviews = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    return await ctx.db
      .query("reviews")
      .withIndex("by_customer", (q) => q.eq("customerId", userId))
      .order("desc")
      .take(50);
  },
});

/* ── admin ── */

export const listAll = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    if (!(await isAdminUser(ctx, userId))) throw new Error("Forbidden");
    return await ctx.db.query("reviews").order("desc").take(200);
  },
});
