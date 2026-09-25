import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation, QueryCtx, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { v } from "convex/values";

/** Federation owner — granted admin role on first verification. */
export const OWNER_EMAIL = "teja200822@gmail.com";

const QUIZ_PASS_MARK = 60;

async function requireUserId(ctx: QueryCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("Not authenticated");
  return userId;
}

async function getMyArtisanInternal(ctx: QueryCtx, userId: Id<"users">) {
  return await ctx.db
    .query("artisans")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .first();
}

/**
 * Promote the federation owner email to admin role. Called opportunistically
 * after sign-in gated mutations; harmless no-op for everyone else.
 */
async function ensureOwnerRole(ctx: MutationCtx, userId: Id<"users">) {
  const user = await ctx.db.get(userId);
  if (!user || user.email !== OWNER_EMAIL) return;
  if (user.role === "admin") return;
  await ctx.db.patch(userId, { role: "admin" });
}

export const getMyArtisan = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    return await getMyArtisanInternal(ctx, userId);
  },
});

/** Public federation directory (used by the landing page ticker). */
export const listArtisans = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("artisans").order("desc").take(200);
    return all.filter((a) => !a.removedAt).slice(0, 50);
  },
});

export const federationStats = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("artisans").collect();
    const artisans = all.filter((a) => !a.removedAt);
    const byTrade: Record<string, number> = {};
    let online = 0;
    let verified = 0;
    for (const a of artisans) {
      byTrade[a.trade] = (byTrade[a.trade] ?? 0) + 1;
      if (a.isOnline) online += 1;
      if (a.kycStatus === "verified") verified += 1;
    }
    return { total: artisans.length, online, verified, byTrade };
  },
});

export const saveProfile = mutation({
  args: {
    fullName: v.string(),
    phone: v.string(),
    trade: v.string(),
    district: v.string(),
    state: v.string(),
    societyId: v.string(),
    experienceYears: v.number(),
    dailyRate: v.number(),
    upiVpa: v.optional(v.string()),
    idType: v.string(),
    idNumber: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await ensureOwnerRole(ctx, userId);

    if (args.idNumber.replace(/\D/g, "").length < 4) {
      throw new Error("Enter a valid ID number (min 4 digits).");
    }

    const existing = await getMyArtisanInternal(ctx, userId);
    const now = Date.now();

    const fields = {
      fullName: args.fullName.trim(),
      phone: args.phone.trim(),
      trade: args.trade,
      district: args.district,
      state: args.state,
      societyId: args.societyId,
      experienceYears: args.experienceYears,
      dailyRate: args.dailyRate,
      upiVpa: args.upiVpa?.trim() || undefined,
      idType: args.idType,
      idLast4: args.idNumber.replace(/\D/g, "").slice(-4),
      kycStatus: "pending" as const,
    };

    if (existing) {
      // Credential is immutable: preserve any issued credential fields.
      await ctx.db.patch(existing._id, fields);
      return existing._id;
    }
    return await ctx.db.insert("artisans", {
      userId,
      ...fields,
      quizPassed: false,
      isOnline: false,
      welfareBalance: 0,
      dividendBalance: 0,
      createdAt: now,
    });
  },
});

export const submitQuiz = mutation({
  args: { score: v.number() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const artisan = await getMyArtisanInternal(ctx, userId);
    if (!artisan) throw new Error("Complete your trade profile first.");
    // Idempotent: a double-submit or stale retry after the credential was
    // already issued resolves to the existing credential — never an error.
    if (artisan.quizPassed && artisan.credentialId) {
      return { ok: true, alreadyIssued: true, credentialId: artisan.credentialId };
    }
    if (args.score < QUIZ_PASS_MARK) {
      await ctx.db.patch(artisan._id, {
        quizScore: args.score,
        quizTakenAt: Date.now(),
      });
      // Below-pass is a normal re-attempt outcome, not a server error:
      // return it as data so the client never logs CONVEX Server Error.
      return {
        ok: false as const,
        score: args.score,
        passMark: QUIZ_PASS_MARK,
        message: `Score ${args.score}% is below the ${QUIZ_PASS_MARK}% pass mark. Please re-attempt — you can retake the quiz.`,
      };
    }

    const now = Date.now();
    const year = new Date(now).getFullYear();
    const rand = Math.floor(Math.random() * 0xffff)
      .toString(16)
      .toUpperCase()
      .padStart(4, "0");
    const credentialId = `SSC-${year}-${rand}`;

    await ctx.db.patch(artisan._id, {
      quizScore: args.score,
      quizTakenAt: now,
      quizPassed: true,
      credentialId,
      credentialIssuedAt: now,
    });
    return { ok: true as const, credentialId };
  },
});

/**
 * Confirm skill & conduct (replaces the old voice quiz). Issues the
 * cooperative trade credential. Idempotent.
 */
export const confirmSkill = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const artisan = await getMyArtisanInternal(ctx, userId);
    if (!artisan) throw new Error("Complete your trade profile first.");
    if (artisan.quizPassed && artisan.credentialId) {
      return { credentialId: artisan.credentialId, alreadyIssued: true };
    }

    const now = Date.now();
    const year = new Date(now).getFullYear();
    const rand = Math.floor(Math.random() * 0xffff)
      .toString(16)
      .toUpperCase()
      .padStart(4, "0");
    const credentialId = `SSC-${year}-${rand}`;

    await ctx.db.patch(artisan._id, {
      quizPassed: true,
      credentialId,
      credentialIssuedAt: now,
    });
    return { credentialId, alreadyIssued: false };
  },
});

export const setPresence = mutation({
  args: {
    isOnline: v.boolean(),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const artisan = await getMyArtisanInternal(ctx, userId);
    if (!artisan) throw new Error("Complete onboarding first.");
    await ctx.db.patch(artisan._id, {
      isOnline: args.isOnline,
      ...(args.lat !== undefined && args.lng !== undefined
        ? { lat: args.lat, lng: args.lng }
        : {}),
      telemetryAt: Date.now(),
    });
  },
});
