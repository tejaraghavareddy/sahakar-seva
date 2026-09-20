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

/** Save a forecast or stabilization snapshot produced by the AI engine. */
export const save = mutation({
  args: {
    kind: v.string(),
    district: v.string(),
    demandIndex: v.number(),
    primaryDeficitTrades: v.array(v.string()),
    priceRecommendation: v.string(),
    welfarePoolAllocation: v.number(),
    advisories: v.array(v.string()),
    summary: v.optional(v.string()),
    source: v.string(),
    model: v.optional(v.string()),
    context: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    if (!(await isAdminUser(ctx, userId))) throw new Error("Forbidden");
    const id = await ctx.db.insert("forecasts", {
      ...args,
      createdBy: userId,
      createdAt: Date.now(),
    });
    return id;
  },
});

/** Most recent forecast for the admin console. */
export const latest = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    if (!(await isAdminUser(ctx, userId))) return null;
    return await ctx.db
      .query("forecasts")
      .withIndex("by_created")
      .order("desc")
      .first();
  },
});

/** Recent forecast history (last 12). */
export const history = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    if (!(await isAdminUser(ctx, userId))) return null;
    return await ctx.db
      .query("forecasts")
      .withIndex("by_created")
      .order("desc")
      .take(12);
  },
});
