import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation, QueryCtx } from "./_generated/server";
import { DEMO_ADMIN_EMAILS } from "./admin";
import { Id } from "./_generated/dataModel";
import { v } from "convex/values";

/* ── helpers ── */

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

/** ISO-3166 style state code used to compose society registration codes. */
function stateCode(state: string): string {
  const map: Record<string, string> = {
    telangana: "TS",
    "andhra pradesh": "AP",
    karnataka: "KA",
    "tamil nadu": "TN",
    kerala: "KL",
    maharashtra: "MH",
    delhi: "DL",
    "west bengal": "WB",
    "uttar pradesh": "UP",
    gujarat: "GJ",
    rajasthan: "RJ",
  };
  return map[state.trim().toLowerCase()] ?? state.slice(0, 2).toUpperCase();
}

function districtCode(district: string): string {
  return district.trim().slice(0, 3).toUpperCase();
}

async function nextSequence(ctx: QueryCtx, state: string, district: string) {
  const all = await ctx.db.query("societies").collect();
  const prefix = `${stateCode(state)}-${districtCode(district)}-`;
  let max = 0;
  for (const s of all) {
    if (s.code.startsWith(prefix)) {
      const n = Number(s.code.slice(prefix.length));
      if (!Number.isNaN(n) && n > max) max = n;
    }
  }
  return max + 1;
}

/* ── public directory ── */

/** Active societies for the onboarding picker & public pages, with member counts. */
export const directory = query({
  args: {},
  handler: async (ctx) => {
    const societies = await ctx.db
      .query("societies")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .take(100);
    const artisans = await ctx.db.query("artisans").collect();
    const counts: Record<string, number> = {};
    for (const a of artisans) {
      counts[a.societyId] = (counts[a.societyId] ?? 0) + 1;
    }
    return societies.map((s) => ({ ...s, memberCount: counts[s._id] ?? 0 }));
  },
});

/* ── admin: registration pipeline ── */

export const listForAdmin = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    if (!(await isAdminUser(ctx, userId))) throw new Error("Forbidden");
    const societies = await ctx.db.query("societies").order("desc").take(200);
    const artisans = await ctx.db.query("artisans").collect();
    const counts: Record<string, number> = {};
    for (const a of artisans) {
      counts[a.societyId] = (counts[a.societyId] ?? 0) + 1;
    }
    return societies.map((s) => ({ ...s, memberCount: counts[s._id] ?? 0 }));
  },
});

/** Register a new district cooperative society (enters the pipeline as pending). */
export const register = mutation({
  args: {
    name: v.string(),
    district: v.string(),
    state: v.string(),
    jurisdiction: v.optional(v.string()),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    address: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    if (!(await isAdminUser(ctx, userId))) throw new Error("Forbidden");
    if (!args.name.trim()) throw new Error("Society name is required");
    if (!args.district.trim()) throw new Error("District is required");
    if (!args.state.trim()) throw new Error("State is required");

    const seq = await nextSequence(ctx, args.state, args.district);
    const code = `${stateCode(args.state)}-${districtCode(args.district)}-${String(seq).padStart(2, "0")}`;
    const year = new Date().getFullYear();
    const registrationNo = `SSC/REG/${year}/${String(seq).padStart(3, "0")}`;

    const id = await ctx.db.insert("societies", {
      name: args.name.trim(),
      district: args.district.trim(),
      state: args.state.trim(),
      code,
      registrationNo,
      jurisdiction: args.jurisdiction?.trim() || undefined,
      lat: args.lat,
      lng: args.lng,
      address: args.address?.trim() || undefined,
      contactPhone: args.contactPhone?.trim() || undefined,
      status: "pending",
      registeredBy: userId,
      createdAt: Date.now(),
    });
    return { id, code, registrationNo };
  },
});

/** Review a pending society: charter (activate), suspend, or reject. */
export const review = mutation({
  args: { id: v.id("societies"), status: v.string(), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    if (!(await isAdminUser(ctx, userId))) throw new Error("Forbidden");
    const society = await ctx.db.get(args.id);
    if (!society) throw new Error("Society not found");
    if (!["active", "suspended", "rejected", "pending"].includes(args.status)) {
      throw new Error("Invalid status");
    }
    await ctx.db.patch(args.id, {
      status: args.status,
      reviewNote: args.note?.trim() || undefined,
      reviewedAt: Date.now(),
    });
  },
});
