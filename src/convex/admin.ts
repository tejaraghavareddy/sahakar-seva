import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import {
  DEMO_ADMIN_EMAILS,
  adminSocietyScope,
  inSocietyScope,
  isAdminUser,
  requireUser,
} from "./identity";

/**
 * Resolve the caller's federation scope, or throw for non-officers.
 * Every worker-row read/write in this module goes through here, so the
 * "federation admins govern only their own federation" rule is applied in
 * exactly one place.
 */
async function scopedSociety(
  ctx: MutationCtx | Parameters<typeof requireUser>[0],
  userId: Id<"users">,
): Promise<"all" | Id<"societies"> | null> {
  if (!(await isAdminUser(ctx, userId))) throw new Error("Forbidden");
  return adminSocietyScope(ctx, userId);
}

/**
 * Re-exported so existing imports keep working. The rule itself now lives in
 * identity.ts, which every function module shares.
 */
export { DEMO_ADMIN_EMAILS };

/* ── Audit ledger ───────────────────────────────────────────── */

/**
 * Write one row to the privileged-action audit ledger. Every board decision
 * (KYC review, admin cancel, dispute resolution) records who did it.
 */
async function audit(
  ctx: MutationCtx,
  entry: {
    actorId?: Id<"users"> | null;
    email?: string;
    kind: string;
    method?: string;
    ok: boolean;
    detail?: string;
  },
) {
  await ctx.db.insert("adminAuditLog", {
    actorId: entry.actorId ?? undefined,
    email: entry.email,
    kind: entry.kind,
    method: entry.method,
    ok: entry.ok,
    detail: entry.detail,
    at: Date.now(),
  });
}

/** Audit trail of security events — cleared officers only. */
export const auditLog = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    if (!(await isAdminUser(ctx, userId))) throw new Error("Forbidden");
    const rows = await ctx.db.query("adminAuditLog").order("desc").take(100);
    const actorNames: Record<string, string> = {};
    for (const r of rows) {
      if (r.actorId && !(r.actorId in actorNames)) {
        const u = await ctx.db.get(r.actorId);
        actorNames[r.actorId] = u?.email ?? u?.name ?? "unknown user";
      }
    }
    return rows.map((r) => ({
      _id: r._id,
      kind: r.kind,
      method: r.method,
      ok: r.ok,
      detail: r.detail,
      at: r.at,
      actor: r.actorId ? (actorNames[r.actorId] ?? "unknown") : "anonymous",
    }));
  },
});

/** Per-artisan earnings ledger for the annual patronage dividend calculator. */
export const earningsLedger = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    if (!(await isAdminUser(ctx, userId))) throw new Error("Forbidden");

    const artisans = await ctx.db.query("artisans").collect();
    const bookings = await ctx.db
      .query("bookings")
      .filter((q) =>
        q.or(q.eq(q.field("status"), "settled"), q.eq(q.field("status"), "completed")),
      )
      .collect();

    const per: Record<string, { name: string; trade: string; jobs: number; earnings: number; welfare: number }> = {};
    // A shared visit is one job split across households, and every participant
    // row carries the same visit-level amounts. Counting rows would report one
    // visit as N jobs worth N times the earnings, so each group is counted once.
    const countedGroups = new Set<string>();
    for (const b of bookings) {
      if (!b.workerId) continue;
      if (b.groupId) {
        if (countedGroups.has(b.groupId)) continue;
        countedGroups.add(b.groupId);
      }
      const a = artisans.find((x) => x._id === b.workerId);
      const entry = per[b.workerId] ?? {
        name: a?.fullName ?? "Unknown artisan",
        trade: a?.trade ?? "—",
        jobs: 0,
        earnings: 0,
        welfare: 0,
      };
      entry.jobs += 1;
      entry.earnings += b.workerShare ?? Math.round(b.base * 0.9);
      entry.welfare += b.welfareAmt ?? 0;
      per[b.workerId] = entry;
    }

    return Object.entries(per)
      .map(([artisanId, e]) => ({ artisanId, ...e }))
      .sort((a, b) => b.earnings - a.earnings);
  },
});

/** Admin overview — booking pipeline, workers, welfare pool. */
export const overview = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    if (!(await isAdminUser(ctx, userId))) throw new Error("Forbidden");

    const bookings = await ctx.db.query("bookings").collect();
    const allArtisans = await ctx.db.query("artisans").collect();
    const artisans = allArtisans.filter((a) => !a.removedAt);

    const byStatus: Record<string, number> = {};
    let revenueSettled = 0;
    let welfarePool = 0;
    let workerPayouts = 0;
    let opsPool = 0;
    // A shared visit is one job split across households. The pipeline counts
    // every household (they are real rows a dispatcher can see), but the money
    // totals must count the visit once — the split is applied to the visit
    // price once, so summing the per-row amounts would triple the federation's
    // reported revenue and welfare.
    const moneyCounted = new Set<string>();
    for (const b of bookings) {
      byStatus[b.status] = (byStatus[b.status] ?? 0) + 1;
      if (b.status === "settled" || b.status === "completed") {
        if (b.groupId) {
          if (moneyCounted.has(b.groupId)) continue;
          moneyCounted.add(b.groupId);
        }
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
    const scope = await scopedSociety(ctx, userId);
    const rows = await ctx.db.query("artisans").order("desc").take(200);
    // A federation admin governs one federation: only its workers appear.
    return rows.filter(inSocietyScope(scope));
  },
});

/** Removed workers for the admin console history view. */
export const removedWorkers = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const scope = await scopedSociety(ctx, userId);
    const all = await ctx.db.query("artisans").order("desc").take(200);
    return all.filter((a) => !!a.removedAt).filter(inSocietyScope(scope));
  },
});

/** Every registered member account — visible to cleared officers. */
export const memberList = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    if (!(await isAdminUser(ctx, userId))) throw new Error("Forbidden");

    const users = await ctx.db.query("users").order("desc").take(500);
    const artisanRows = await ctx.db.query("artisans").collect();
    const byUser = new Map(artisanRows.map((a) => [a.userId, a]));
    // A scoped federation admin sees their own federation's members (workers
    // plus their own officers' accounts); super admins see the platform.
    const scope = await adminSocietyScope(ctx, userId);
    const inScope = inSocietyScope(scope);

    return users
      .filter((u) => {
        const artisan = byUser.get(u._id);
        if (artisan) return inScope(artisan);
        // Non-worker accounts: fully visible to platform-level callers (and
        // to unscoped officers, who keep the legacy global view until a super
        // admin scopes them). A scoped federation admin sees only their own
        // federation's officer accounts.
        if (scope === "all" || scope === null) return true;
        if (u.role === "admin" || u.role === "superadmin") {
          return u.societyId === scope;
        }
        return false;
      })
      .map((u) => {
        const artisan = byUser.get(u._id);
        return {
          _id: u._id,
          email: u.email,
          name: u.name,
          role: u.role,
          isAnonymous: u.isAnonymous ?? false,
          createdAt: u._creationTime,
          workerId: artisan?._id,
          workerName: artisan?.fullName,
          workerTrade: artisan?.trade,
          workerDistrict: artisan?.district,
          kycStatus: artisan?.kycStatus,
        };
      });
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
    const scope = await scopedSociety(ctx, userId);
    const rows = await ctx.db
      .query("artisans")
      .withIndex("by_kyc", (q) => q.eq("kycStatus", "pending"))
      .take(200);
    return rows.filter(inSocietyScope(scope));
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
    const scope = await scopedSociety(ctx, userId);
    const artisan = await ctx.db.get(args.artisanId);
    if (!artisan) throw new Error("Artisan not found");
    // A scoped federation admin can only review their own federation's workers.
    if (!inSocietyScope(scope)(artisan)) throw new Error("Not in your federation");
    if (artisan.removedAt) throw new Error("This worker has been removed from the federation");
    if (artisan.kycStatus !== "pending") {
      throw new Error("This artisan's KYC is not pending review");
    }
    const now = Date.now();
    const kycRef = `BGC-${now.toString(36).toUpperCase().slice(-8)}`;
    await audit(ctx, {
      actorId: userId,
      kind: "kyc_review",
      ok: true,
      detail: `${args.approve ? "Approved" : "Rejected"} ${artisan.fullName} (${args.artisanId})`,
    });
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
    await audit(ctx, {
      actorId: userId,
      kind: "admin_cancel",
      ok: true,
      detail: `Cancelled booking ${b.serviceName} (${b._id})`,
    });
    await ctx.db.patch(b._id, {
      status: "cancelled",
      cancelledAt: Date.now(),
      cancelBy: "admin",
    });
  },
});
