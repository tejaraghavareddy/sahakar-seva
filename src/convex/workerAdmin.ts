import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation, QueryCtx, MutationCtx } from "./_generated/server";
import { DEMO_ADMIN_EMAILS } from "./admin";
import { Id } from "./_generated/dataModel";
import { v } from "convex/values";

/* ── helpers (mirrors other modules) ── */

async function requireUser(ctx: QueryCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("Not authenticated");
  return userId;
}

async function isAdminUser(ctx: QueryCtx, userId: Id<"users">): Promise<boolean> {
  const user = await ctx.db.get(userId);
  if (!user) return false;
  if (user.email === "teja200822@gmail.com") return true;
  if (DEMO_ADMIN_EMAILS.includes(user.email ?? "")) return true;
  return user.role === "admin";
}

async function requireAdmin(ctx: QueryCtx) {
  const userId = await requireUser(ctx);
  if (!(await isAdminUser(ctx, userId))) throw new Error("Forbidden");
  return userId;
}

/** Insert a notification row for a user. */
async function notify(
  ctx: MutationCtx,
  userId: Id<"users">,
  kind: string,
  title: string,
  body: string,
) {
  await ctx.db.insert("notifications", {
    userId,
    kind,
    title,
    body,
    createdAt: Date.now(),
  });
}

/* ── admin: add a worker from an existing signed-up member ── */

/**
 * Promote a signed-up member into a worker by creating their artisan profile.
 * The member must have an account (they see the notification next time they
 * open the worker dashboard). Admin provides name/phone/trade basics; KYC
 * starts as pending so the standard verification pipeline still applies.
 */
export const addWorker = mutation({
  args: {
    userId: v.id("users"),
    fullName: v.string(),
    phone: v.string(),
    trade: v.string(),
    district: v.string(),
    state: v.string(),
    societyId: v.optional(v.string()),
    experienceYears: v.number(),
    dailyRate: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("Member account not found");
    if (user.isAnonymous) throw new Error("Cannot add a guest session as a worker");

    const existing = await ctx.db
      .query("artisans")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();
    if (existing) {
      if (existing.removedAt) {
        // Reactivate the previously removed profile.
        await ctx.db.patch(existing._id, {
          removedAt: undefined,
          removedBy: undefined,
          removalNote: undefined,
          fullName: args.fullName.trim(),
          phone: args.phone.trim(),
          trade: args.trade,
          district: args.district,
          state: args.state,
          societyId: args.societyId ?? existing.societyId,
          experienceYears: args.experienceYears,
          dailyRate: args.dailyRate,
          kycStatus: "pending",
        });
        await notify(
          ctx,
          args.userId,
          "worker_added",
          "Welcome back to the federation",
          `Your worker registration was reactivated by the federation board. Trade: ${args.trade}. KYC verification restarts now — complete it to accept jobs.`,
        );
        return { artisanId: existing._id, reactivated: true };
      }
      throw new Error("This member is already a registered worker");
    }

    const now = Date.now();
    const artisanId = await ctx.db.insert("artisans", {
      userId: args.userId,
      fullName: args.fullName.trim(),
      phone: args.phone.trim(),
      trade: args.trade,
      district: args.district,
      state: args.state,
      societyId: args.societyId ?? "",
      experienceYears: args.experienceYears,
      dailyRate: args.dailyRate,
      idType: "aadhaar",
      idLast4: "0000",
      kycStatus: "pending",
      quizPassed: false,
      isOnline: false,
      welfareBalance: 0,
      dividendBalance: 0,
      createdAt: now,
    });

    await notify(
      ctx,
      args.userId,
      "worker_added",
      "You've been added to the federation",
      `The federation board registered you as a ${args.trade} artisan. Open your worker hub to complete KYC verification and the skill quiz before accepting jobs.`,
    );

    return { artisanId, reactivated: false };
  },
});

/* ── admin: remove a worker (soft delete + notification) ── */

export const removeWorker = mutation({
  args: {
    artisanId: v.id("artisans"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);

    const artisan = await ctx.db.get(args.artisanId);
    if (!artisan) throw new Error("Worker not found");
    if (artisan.removedAt) throw new Error("Worker is already removed");

    const now = Date.now();
    const note = args.note?.trim() || "Removed by federation board";

    // Soft-delete the profile and take them off the dispatch radar.
    await ctx.db.patch(artisan._id, {
      removedAt: now,
      removedBy: adminId,
      removalNote: note,
      isOnline: false,
    });

    // Cancel any active bookings assigned to this worker.
    const activeStatuses = ["accepted", "enroute", "inprogress"];
    const assigned = await ctx.db
      .query("bookings")
      .withIndex("by_worker", (q) => q.eq("workerUserId", artisan.userId))
      .take(100);
    let cancelled = 0;
    for (const b of assigned) {
      if (!b.workerId || b.workerId !== artisan._id) continue;
      if (!activeStatuses.includes(b.status)) continue;
      await ctx.db.patch(b._id, {
        status: "cancelled",
        cancelledAt: now,
        cancelBy: "admin",
      });
      cancelled += 1;
    }

    await notify(
      ctx,
      artisan.userId,
      "worker_removed",
      "Your federation membership was revoked",
      `A federation officer removed you from the artisan registry. Reason: ${note}.${cancelled > 0 ? ` ${cancelled} active job(s) were cancelled and customers will be reassigned.` : ""} Contact your district society board if you believe this is a mistake.`,
    );

    return { cancelled };
  },
});

/* ── worker: notification center ── */

export const myNotifications = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    return await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(50);
  },
});

export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return 0;
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(200);
    return rows.filter((n) => !n.readAt).length;
  },
});

export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const now = Date.now();
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(200);
    for (const n of rows) {
      if (!n.readAt) await ctx.db.patch(n._id, { readAt: now });
    }
    return { marked: rows.filter((n) => !n.readAt).length };
  },
});
