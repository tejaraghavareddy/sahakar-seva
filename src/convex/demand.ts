import { query } from "./_generated/server";
import { isAdminUser, requireUser } from "./identity";
import { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import {
  SLOT_DAYS,
  SLOT_PARTS,
  countSlots,
  isSlotSet,
  upcomingDays,
  type SlotPart,
} from "../lib/slots";

/**
 * Matching demand to the people who can meet it.
 *
 * The statement asks for AI prediction to "suggest workers" and "match skills
 * with demand". A forecast that names a trade but leaves the dispatch to chance
 * is only half useful: what a trade union officer actually wants on a Monday
 * morning is a shortlist of who to call, and what a worker wants is to know
 * whether this week is worth turning up.
 *
 * Both are served from the same ranking, which is deliberately simple and
 * explainable rather than clever: available now, then bookable soon, then
 * proven. A board officer has to be able to say out loud why person A is above
 * person B, and "a model said so" is not an answer they can defend to a
 * cooperative member.
 */

/** How many open working slots a worker has left in the coming week. */
function openSlots(slots: number | undefined): number {
  return countSlots(slots);
}

/** The soonest open slot, as a day offset, or null if none is set. */
function soonestSlot(slots: number | undefined): number | null {
  for (let day = 0; day < SLOT_DAYS; day++) {
    for (const part of SLOT_PARTS) {
      if (isSlotSet(slots, day, part as SlotPart)) return day;
    }
  }
  return null;
}

/**
 * Rank the workers best placed to take work in a trade.
 *
 * Ordering, in priority:
 *  1. available right now — a dispatch problem is a dispatch problem
 *  2. more open slots in the coming week — capacity, not reputation
 *  3. completed jobs — proof they finish
 *  4. rating — the tie-breaker between two equally available people
 */
export const suggestWorkers = query({
  args: {
    trade: v.string(),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    if (!(await isAdminUser(ctx, userId))) throw new Error("Forbidden");

    const all = await ctx.db
      .query("artisans")
      .withIndex("by_trade", (q) => q.eq("trade", args.trade))
      .collect();

    const bookings = await ctx.db.query("bookings").collect();
    const done = new Map<Id<"artisans">, number>();
    for (const b of bookings) {
      if (!b.workerId) continue;
      if (b.status !== "completed" && b.status !== "settled") continue;
      done.set(b.workerId, (done.get(b.workerId) ?? 0) + 1);
    }

    return all
      .filter((a) => !a.removedAt)
      // A worker who cannot legally accept a job is not a suggestion.
      .filter((a) => a.kycStatus === "verified" && a.quizPassed)
      .map((a) => ({
        _id: a._id,
        fullName: a.fullName,
        district: a.district,
        isOnline: a.isOnline,
        slots: a.slots ?? 0,
        openSlots: openSlots(a.slots),
        soonestDay: soonestSlot(a.slots),
        completedJobs: done.get(a._id) ?? 0,
        ratingAvg: a.ratingAvg ?? null,
        ratingCount: a.ratingCount ?? 0,
        // Why this person is on the list, in words the officer can repeat.
        reason: a.isOnline
          ? "online_now"
          : (a.slots ?? 0) > 0
            ? "has_slots"
            : "no_slots_listed",
      }))
      .sort(
        (x, y) =>
          Number(y.isOnline) - Number(x.isOnline) ||
          y.openSlots - x.openSlots ||
          y.completedJobs - x.completedJobs ||
          (y.ratingAvg ?? 0) - (x.ratingAvg ?? 0),
      )
      .slice(0, 15);
  },
});

/**
 * A worker's own read on their trade this week.
 *
 * The other half of prediction is telling the supply side, not just the office.
 * A plumber who can see that the week is wet will keep a drain-clearing kit
 * ready; that is a real behavioural change and it costs one card.
 */
export const myOutlook = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const me = await ctx.db
      .query("artisans")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    if (!me) return null;

    const recent = await ctx.db
      .query("bookings")
      .withIndex("by_worker", (q) => q.eq("workerUserId", userId))
      .collect();
    const mine = recent.filter(
      (b) => b.trade === me.trade && ["completed", "settled"].includes(b.status),
    );

    const latest = await ctx.db
      .query("forecasts")
      .order("desc")
      .first();
    const predictsMyTrade = latest?.primaryDeficitTrades?.includes(me.trade);
    const isTopTrade = latest?.topTrade === me.trade;

    return {
      trade: me.trade,
      isOnline: me.isOnline,
      openSlots: openSlots(me.slots),
      // Concrete dates rather than "7 days", so the worker can plan around them.
      slots: upcomingDays().map((d) => ({
        label: d.label,
        parts: SLOT_PARTS.filter((p) =>
          isSlotSet(me.slots, d.offset, p as SlotPart),
        ),
      })),
      completedJobs: mine.length,
      ratingAvg: me.ratingAvg ?? null,
      ratingCount: me.ratingCount ?? 0,
      outlook: {
        predictsMyTrade: !!predictsMyTrade,
        isTopTrade,
        reason: latest?.topTradeReason ?? null,
        summary: latest?.summary ?? null,
        // Set the worker is expected to see, not a guarantee.
        expectedDemand: isTopTrade ? "high" : predictsMyTrade ? "elevated" : "normal",
      },
    };
  },
});
