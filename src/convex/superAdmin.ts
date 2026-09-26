/**
 * Super-admin portal backend — the platform governance tier.
 *
 * A super admin sits ABOVE the federation admins: they charter and suspend
 * whole federations (societies), appoint and remove the federation admins who
 * run them, and see platform-wide statistics. They do not run day-to-day
 * operations — that is what the federation admins do, scoped to the one
 * federation each was appointed to.
 *
 * Every function here re-checks `isSuperAdmin` server-side; nothing trusts the
 * client's picture of who is calling.
 */
import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { isSuperAdmin, requireUser } from "./identity";

/** Throw unless the caller is a platform super admin. */
async function requireSuperAdmin(ctx: MutationCtx) {
  const userId = await requireUser(ctx);
  if (!(await isSuperAdmin(ctx, userId))) throw new Error("Forbidden");
  return userId;
}

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

/* ── session helper ── */

/** Client-side gate check: is the caller a platform super admin? */
export const amSuperAdmin = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return false;
    return isSuperAdmin(ctx, userId);
  },
});

/* ── platform overview ── */

/** Whole-platform numbers for the super-admin landing tab. */
export const platformOverview = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    if (!(await isSuperAdmin(ctx, userId))) throw new Error("Forbidden");

    const societies = await ctx.db.query("societies").collect();
    // The users table has no role index; the officer count is small, so
    // collect-and-filter is the honest shape here.
    const admins = (await ctx.db.query("users").collect()).filter(
      (u) => u.role === "admin",
    );
    const workers = await ctx.db.query("artisans").collect();
    const bookings = await ctx.db.query("bookings").collect();

    const byStatus: Record<string, number> = {};
    for (const s of societies) byStatus[s.status] = (byStatus[s.status] ?? 0) + 1;

    const settled = bookings.filter(
      (b) => b.status === "settled" || b.status === "completed",
    );
    const revenueSettled = settled.reduce((s, b) => s + b.base, 0);
    const welfarePool = settled.reduce((s, b) => s + (b.welfareAmt ?? 0), 0);

    return {
      federations: societies.length,
      byStatus,
      federationAdmins: admins.filter((a) => a.societyId).length,
      unscopedAdmins: admins.filter((a) => !a.societyId).length,
      workers: workers.filter((w) => !w.removedAt).length,
      bookings: bookings.length,
      revenueSettled,
      welfarePool,
    };
  },
});

/* ── federation (society) management ── */

/** Every federation with its appointed admins and worker count. */
export const listFederations = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    if (!(await isSuperAdmin(ctx, userId))) throw new Error("Forbidden");

    const societies = await ctx.db.query("societies").order("desc").take(500);
    // The users table has no role index; the officer count is small, so
    // collect-and-filter is the honest shape here.
    const admins = (await ctx.db.query("users").collect()).filter(
      (u) => u.role === "admin",
    );
    const workers = await ctx.db.query("artisans").collect();

    const counts: Record<string, number> = {};
    for (const w of workers) {
      if (!w.removedAt) counts[w.societyId] = (counts[w.societyId] ?? 0) + 1;
    }

    return societies.map((s) => ({
      _id: s._id,
      name: s.name,
      code: s.code,
      district: s.district,
      state: s.state,
      status: s.status,
      registrationNo: s.registrationNo,
      createdAt: s.createdAt,
      memberCount: counts[s._id] ?? 0,
      admins: admins
        .filter((a) => a.societyId === s._id)
        .map((a) => ({ _id: a._id, name: a.name, email: a.email })),
    }));
  },
});

/** Charter a new federation directly (active, skipping the pending pipeline). */
export const createFederation = mutation({
  args: {
    name: v.string(),
    district: v.string(),
    state: v.string(),
    jurisdiction: v.optional(v.string()),
    address: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireSuperAdmin(ctx);
    if (!args.name.trim()) throw new Error("Federation name is required");
    if (!args.district.trim()) throw new Error("District is required");
    if (!args.state.trim()) throw new Error("State is required");

    // Reuse the society code/registration generator by inlining the same
    // scheme: a super-admin charter is a first-class registration, so the
    // code format must stay identical for the directory and ID cards.
    const all = await ctx.db.query("societies").collect();
    const stateMap: Record<string, string> = {
      telangana: "TS", "andhra pradesh": "AP", karnataka: "KA",
      "tamil nadu": "TN", kerala: "KL", maharashtra: "MH", delhi: "DL",
      "west bengal": "WB", "uttar pradesh": "UP", gujarat: "GJ", rajasthan: "RJ",
    };
    const st = stateMap[args.state.trim().toLowerCase()] ?? args.state.slice(0, 2).toUpperCase();
    const dc = args.district.trim().slice(0, 3).toUpperCase();
    const prefix = `${st}-${dc}-`;
    let max = 0;
    for (const s of all) {
      if (s.code.startsWith(prefix)) {
        const n = Number(s.code.slice(prefix.length));
        if (!Number.isNaN(n) && n > max) max = n;
      }
    }
    const seq = max + 1;
    const code = `${prefix}${String(seq).padStart(2, "0")}`;
    const registrationNo = `SSC/REG/${new Date().getFullYear()}/${String(seq).padStart(3, "0")}`;

    const id = await ctx.db.insert("societies", {
      name: args.name.trim(),
      district: args.district.trim(),
      state: args.state.trim(),
      code,
      registrationNo,
      jurisdiction: args.jurisdiction?.trim() || undefined,
      address: args.address?.trim() || undefined,
      contactPhone: args.contactPhone?.trim() || undefined,
      status: "active", // chartered directly by the platform, not pending
      registeredBy: userId,
      createdAt: Date.now(),
    });
    await audit(ctx, {
      actorId: userId,
      kind: "federation_create",
      method: "superadmin",
      ok: true,
      detail: `${code} ${args.name.trim()}`,
    });
    return { id, code, registrationNo };
  },
});

/** Suspend or reactivate a whole federation. */
export const setFederationStatus = mutation({
  args: {
    id: v.id("societies"),
    status: v.union(v.literal("active"), v.literal("suspended")),
  },
  handler: async (ctx, args) => {
    const userId = await requireSuperAdmin(ctx);
    const society = await ctx.db.get(args.id);
    if (!society) throw new Error("Federation not found");
    await ctx.db.patch(args.id, { status: args.status });
    await audit(ctx, {
      actorId: userId,
      kind: "federation_status",
      method: "superadmin",
      ok: true,
      detail: `${society.code} -> ${args.status}`,
    });
  },
});

/* ── federation admin appointments ── */

/**
 * Every federation admin, with the federation each is scoped to (or null).
 * `candidates` carries the members who could be appointed next.
 */
export const listFederationAdmins = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    if (!(await isSuperAdmin(ctx, userId))) throw new Error("Forbidden");

    // The users table has no role index; the officer count is small, so
    // collect-and-filter is the honest shape here.
    const admins = (await ctx.db.query("users").collect()).filter(
      (u) => u.role === "admin",
    );
    const societies = await ctx.db.query("societies").collect();
    const byId = new Map(societies.map((s) => [s._id, s]));

    return admins.map((a) => ({
      _id: a._id,
      email: a.email,
      name: a.name,
      societyId: a.societyId ?? null,
      societyName: a.societyId ? byId.get(a.societyId)?.name ?? null : null,
      createdAt: a._creationTime,
    }));
  },
});

/**
 * Appoint a federation admin for one federation.
 *
 * The member may already exist (they signed up earlier) or is provisioned on
 * the spot from an email — their account completes when they first sign in
 * through the normal OTP flow, and the verified email links into this row.
 * The appointment carries the scope: THIS admin governs THIS federation and
 * no other.
 */
export const appointFederationAdmin = mutation({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
    societyId: v.id("societies"),
  },
  handler: async (ctx, args) => {
    const actorId = await requireSuperAdmin(ctx);
    const email = args.email.trim().toLowerCase();
    if (!email.includes("@")) throw new Error("Enter a valid email address");
    const society = await ctx.db.get(args.societyId);
    if (!society) throw new Error("Federation not found");

    const existing = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .first();

    let adminUserId: Id<"users">;
    if (existing) {
      if (existing.role === "superadmin") {
        throw new Error("That account is a platform super admin");
      }
      adminUserId = existing._id;
      await ctx.db.patch(existing._id, {
        role: "admin",
        societyId: args.societyId,
      });
    } else {
      adminUserId = await ctx.db.insert("users", {
        email,
        name: args.name?.trim() || email.split("@")[0],
        role: "admin",
        societyId: args.societyId,
        emailVerificationTime: undefined,
      });
    }

    await audit(ctx, {
      actorId,
      kind: "federation_admin_appoint",
      method: "superadmin",
      ok: true,
      detail: `${email} -> ${society.code}`,
    });
    return { adminUserId };
  },
});

/** Remove a federation admin's access (and their federation scope). */
export const removeFederationAdmin = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const actorId = await requireSuperAdmin(ctx);
    const target = await ctx.db.get(args.userId);
    if (!target) throw new Error("Account not found");
    if (target.role === "superadmin") {
      throw new Error("A super admin cannot be removed here");
    }
    // The owner email is untouchable through this door — demoting it would
    // lock the platform's founder out of their own console.
    const OWNER_EMAIL = "teja200822@gmail.com";
    if (target.email === OWNER_EMAIL) {
      throw new Error("The federation owner account cannot be removed");
    }
    if (target.role !== "admin") {
      throw new Error("That account is not a federation admin");
    }

    await ctx.db.patch(args.userId, { role: "user", societyId: undefined });
    await audit(ctx, {
      actorId,
      kind: "federation_admin_remove",
      method: "superadmin",
      ok: true,
      detail: target.email ?? args.userId,
    });
  },
});
