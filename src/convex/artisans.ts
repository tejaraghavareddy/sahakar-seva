import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation, QueryCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { OWNER_EMAIL, ensureOwnerRole, requireUser } from "./identity";

/** Federation owner — granted admin role on first verification. */
export { OWNER_EMAIL };

const QUIZ_PASS_MARK = 60;

const requireUserId = requireUser;

async function getMyArtisanInternal(ctx: QueryCtx, userId: Id<"users">) {
  return await ctx.db
    .query("artisans")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .first();
}

export const getMyArtisan = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    return await getMyArtisanInternal(ctx, userId);
  },
});

/**
 * Public federation directory used by the catalog to show real, live
 * availability ("3 verified electricians nearby · 1.2 km away").
 *
 * This query is reachable with no session at all, so it must never return
 * whole artisan documents: those carry `phone`, `idType`, `idLast4` (identity
 * document digits), `upiVpa` (the worker's payout address), cooperative
 * balances and live GPS. Only the four fields the availability maths actually
 * reads are projected out — anything a new caller needs must be added here
 * deliberately rather than inherited by accident.
 *
 * `ratingAvg`/`ratingCount` are aggregates over completed work, not identity
 * data, and the catalog needs them to sort by reputation.
 */
export const listArtisans = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("artisans").order("desc").take(200);
    // Safety Mode narrows the directory to fully verified workers for a
    // customer who asked for it. It is a filter on the same projection, not a
    // second, differently-shaped query that could drift out of sync.
    const viewerId = await getAuthUserId(ctx);
    const viewer = viewerId ? await ctx.db.get(viewerId) : null;
    const safetyMode = viewer?.safetyMode === true;

    return all
      .filter((a) => !a.removedAt)
      .filter(
        (a) =>
          !safetyMode ||
          (a.kycStatus === "verified" && a.skillStatus === "verified"),
      )
      .slice(0, 50)
      .map((a) => ({
        trade: a.trade,
        kycStatus: a.kycStatus,
        lat: a.lat,
        lng: a.lng,
        // Reputation, so the catalog can sort by it. Derived from completed
        // work only — see reviews.ts.
        ratingAvg: a.ratingAvg ?? null,
        ratingCount: a.ratingCount ?? 0,
      }));
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
