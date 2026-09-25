import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation, QueryCtx, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { v } from "convex/values";

/**
 * DEMO ADMIN — this account exists only for demo/testing purposes and can be
 * removed at any time by deleting the DEMO_ADMIN_EMAILS entry below.
 */
export const DEMO_ADMIN_EMAILS = ["demo.admin@sahakar.demo"];

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
  // Demo admin (removable — see DEMO_ADMIN_EMAILS above)
  if (DEMO_ADMIN_EMAILS.includes(user.email ?? "")) return true;
  return user.role === "admin";
}

/* ── Security: audit ledger + passcode brute-force lockout ── */

const MAX_FAILS = 5;
const LOCKOUT_MS = 10 * 60 * 1000; // 10 minutes

type Ctx = MutationCtx;

async function audit(
  ctx: Ctx,
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

async function getLockout(ctx: Ctx) {
  return await ctx.db
    .query("adminLockout")
    .withIndex("by_key", (q) => q.eq("key", "global"))
    .first();
}

async function recordFail(ctx: MutationCtx) {
  const now = Date.now();
  const lock = await getLockout(ctx);
  const fails = (lock?.fails ?? 0) + 1;
  const lockedUntil =
    fails >= MAX_FAILS ? now + LOCKOUT_MS : lock?.lockedUntil;
  if (lock) {
    await ctx.db.patch(lock._id, { fails, lockedUntil, updatedAt: now });
  } else {
    await ctx.db.insert("adminLockout", {
      key: "global",
      fails,
      lockedUntil,
      updatedAt: now,
    });
  }
  return { fails, lockedUntil };
}

/**
 * Emergency clearance: master admin email OR the offline federation
 * passcode for local testing (fixed emergency code). Grants admin role.
 *
 * Security hardening:
 *  - every attempt (success or failure) is written to the adminAuditLog
 *  - 5 wrong passcodes lock attempts for 10 minutes (brute-force protection)
 *  - a correct passcode converts a guest session into the shared demo admin
 *    account (demo.admin@sahakar.demo) so the passcode alone can grant clearance
 */
export const emergencyUnlock = mutation({
  args: { passcode: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("Not authenticated");

    // Brute-force lockout check
    const lock = await getLockout(ctx);
    const now = Date.now();
    if (lock?.lockedUntil && lock.lockedUntil > now) {
      await audit(ctx, {
        actorId: userId,
        email: user.email,
        kind: "clearance_denied",
        method: "passcode",
        ok: false,
        detail: "Attempt while locked out",
      });
      const mins = Math.ceil((lock.lockedUntil - now) / 60_000);
      throw new Error(
        `Too many failed attempts — locked for ${mins} more minute${mins === 1 ? "" : "s"}`,
      );
    }

    const EMERGENCY = "SAHAKAR-BOARD-2026";
    if (args.passcode.trim() !== EMERGENCY) {
      const { fails, lockedUntil } = await recordFail(ctx);
      await audit(ctx, {
        actorId: userId,
        email: user.email,
        kind: "clearance_denied",
        method: "passcode",
        ok: false,
        detail: lockedUntil ? "Wrong passcode — now locked out" : `Wrong passcode (${fails}/${MAX_FAILS})`,
      });
      throw new Error(
        lockedUntil
          ? "Too many failed attempts — locked for 10 minutes"
          : `Invalid emergency passcode (${MAX_FAILS - fails} attempt${MAX_FAILS - fails === 1 ? "" : "s"} remaining)`,
      );
    }

    // Success — reset lockout, grant role, audit.
    if (lock) {
      await ctx.db.patch(lock._id, { fails: 0, lockedUntil: undefined, updatedAt: now });
    }

    // First-time officer still on a guest session? Convert the guest into the
    // shared demo admin account so the passcode alone grants clearance.
    if (user.isAnonymous) {
      await ctx.db.patch(userId, {
        isAnonymous: false,
        email: DEMO_ADMIN_EMAILS[0],
        name: "Demo Federation Officer",
        role: "admin",
      });
      await audit(ctx, {
        actorId: userId,
        email: DEMO_ADMIN_EMAILS[0],
        kind: "clearance_granted",
        method: "passcode",
        ok: true,
        detail: "Guest session converted to demo admin via emergency passcode",
      });
      return { ok: true };
    }

    if (user.role !== "admin") {
      await ctx.db.patch(userId, { role: "admin" });
    }
    await audit(ctx, {
      actorId: userId,
      email: user.email,
      kind: "clearance_granted",
      method: "passcode",
      ok: true,
      detail: "Emergency passcode accepted — admin role granted",
    });
    return { ok: true };
  },
});

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
    for (const b of bookings) {
      if (!b.workerId) continue;
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

/** Removed workers for the admin console history view. */
export const removedWorkers = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    if (!(await isAdminUser(ctx, userId))) throw new Error("Forbidden");
    const all = await ctx.db.query("artisans").order("desc").take(200);
    return all.filter((a) => !!a.removedAt);
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

    return users.map((u) => {
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
