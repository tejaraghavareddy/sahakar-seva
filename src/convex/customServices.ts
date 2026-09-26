/**
 * Worker-created work listings.
 *
 * The cooperative runs six standard trades, but a worker often does work that
 * does not fit neatly into one of them. A worker can therefore publish their
 * own listing ("Terrace waterproofing", "Solar panel installation") either
 * inside one of the six standard trades or inside a category they name
 * themselves. Everything goes to the board first; only approved listings reach
 * the customer catalog.
 */
import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation, QueryCtx, MutationCtx } from "./_generated/server";
import { DEMO_ADMIN_EMAILS } from "./admin";
import { consume } from "./rateLimit";
import { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";

/** Route/service id prefix for a worker-created listing: `cs_<docId>`. */
export const CUSTOM_PREFIX = "cs_";

/** The six cooperative trades a listing can dispatch against. */
const TRADES = [
  "electrician",
  "plumber",
  "carpenter",
  "mason",
  "painter",
  "appliance",
] as const;

const MAX_LISTINGS = 8;
const MAX_NAME = 60;
const MAX_DESC = 240;
const MAX_CATEGORY = 40;
const MAX_BASE = 20000;
const MAX_HOURLY = 2000;

export function customServiceId(id: string): string {
  return `${CUSTOM_PREFIX}${id}`;
}

export function parseCustomServiceId(serviceId: string): string | null {
  if (!serviceId.startsWith(CUSTOM_PREFIX)) return null;
  const raw = serviceId.slice(CUSTOM_PREFIX.length);
  return raw.length > 0 ? raw : null;
}

async function requireUser(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("Not authenticated");
  return userId;
}

async function isAdminUser(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<boolean> {
  const user = await ctx.db.get(userId);
  if (!user) return false;
  if (user.email === "teja200822@gmail.com") return true;
  if (DEMO_ADMIN_EMAILS.includes(user.email ?? "")) return true;
  return user.role === "admin";
}

async function myArtisan(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<Doc<"artisans">> {
  const artisan = await ctx.db
    .query("artisans")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .first();
  if (!artisan) throw new Error("Complete your trade profile first.");
  if (artisan.removedAt)
    throw new Error("This account was removed from the federation");
  return artisan;
}

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

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/* ── worker: publish their own work ── */

export const create = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    // Either one of the six trade ids, or the worker's own category name.
    category: v.string(),
    isCustomCategory: v.boolean(),
    base: v.number(),
    hourly: v.optional(v.number()),
    urgent: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    // Publishing puts work in front of the board's review queue, so the
    // submission rate is bounded per worker as well as by the listing cap.
    await consume(ctx, "listing", userId);
    const artisan = await myArtisan(ctx, userId);

    const name = clean(args.name);
    if (name.length < 3 || name.length > MAX_NAME) {
      throw new Error(`Work name must be 3-${MAX_NAME} characters`);
    }
    const description = clean(args.description);
    if (description.length < 10 || description.length > MAX_DESC) {
      throw new Error(`Describe the work in 10-${MAX_DESC} characters`);
    }

    // Dispatch always happens inside one of the six trades, even when the
    // worker names their own display category.
    const trade = artisan.trade;
    if (!(TRADES as readonly string[]).includes(trade)) {
      throw new Error("Your trade profile is not one of the six cooperative trades");
    }

    const category = clean(args.category);
    if (args.isCustomCategory) {
      if (category.length < 3 || category.length > MAX_CATEGORY) {
        throw new Error(`Category name must be 3-${MAX_CATEGORY} characters`);
      }
    } else if (!(TRADES as readonly string[]).includes(category)) {
      throw new Error("Pick one of the six trades for this work");
    }

    const base = Math.round(args.base);
    if (!Number.isFinite(base) || base < 50 || base > MAX_BASE) {
      throw new Error(`Visit charge must be between ₹50 and ₹${MAX_BASE}`);
    }
    const hourly = Math.round(args.hourly ?? 0);
    if (!Number.isFinite(hourly) || hourly < 0 || hourly > MAX_HOURLY) {
      throw new Error(`Hourly rate must be between ₹0 and ₹${MAX_HOURLY}`);
    }

    const mine = await ctx.db
      .query("customServices")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    if (mine.length >= MAX_LISTINGS) {
      throw new Error(`You can publish up to ${MAX_LISTINGS} works`);
    }

    const id = await ctx.db.insert("customServices", {
      artisanId: artisan._id,
      userId,
      name,
      description,
      trade,
      category: args.isCustomCategory ? category : trade,
      isCustomCategory: args.isCustomCategory,
      base,
      hourly,
      urgent: args.urgent ?? false,
      district: artisan.district,
      status: "pending",
      createdAt: Date.now(),
    });
    return id;
  },
});

/** Withdraw one of my own listings (any state). */
export const remove = mutation({
  args: { serviceId: v.id("customServices") },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const row = await ctx.db.get(args.serviceId);
    if (!row) throw new Error("Listing not found");
    if (row.userId !== userId) throw new Error("Forbidden");
    await ctx.db.delete(args.serviceId);
  },
});

/* ── reads ── */

/** My own listings, newest first. */
export const myListings = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const rows = await ctx.db
      .query("customServices")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return rows
      .map((r) => ({ ...r, routeId: customServiceId(r._id) }))
      // _creationTime breaks ties: two listings published in the same
      // millisecond would otherwise come back in index order.
      .sort((a, b) => b._creationTime - a._creationTime);
  },
});

export interface CatalogListing {
  _id: Id<"customServices">;
  routeId: string;
  name: string;
  description: string;
  trade: string;
  category: string;
  isCustomCategory: boolean;
  base: number;
  hourly: number;
  urgent: boolean;
  district: string;
  workerName: string;
  createdAt: number;
}

/** Board-approved listings for the customer catalog. */
export const approvedCatalog = query({
  args: { trade: v.optional(v.string()) },
  handler: async (ctx, args): Promise<CatalogListing[]> => {
    const rows = await ctx.db
      .query("customServices")
      .withIndex("by_status", (q) => q.eq("status", "approved"))
      .collect();
    const filtered = args.trade
      ? rows.filter((r) => r.trade === args.trade)
      : rows;
    const out: CatalogListing[] = [];
    for (const r of filtered) {
      const artisan = await ctx.db.get(r.artisanId);
      if (!artisan || artisan.removedAt) continue; // never advertise removed workers
      out.push({
        _id: r._id,
        routeId: customServiceId(r._id),
        name: r.name,
        description: r.description,
        trade: r.trade,
        category: r.category,
        isCustomCategory: r.isCustomCategory,
        base: r.base,
        hourly: r.hourly,
        urgent: r.urgent,
        district: r.district,
        workerName: artisan.fullName,
        createdAt: r.createdAt,
      });
    }
    return out.sort((a, b) => b.createdAt - a.createdAt);
  },
});

/** One approved listing, looked up by its `cs_<id>` route id. */
export const approvedByRouteId = query({
  args: { serviceId: v.string() },
  handler: async (ctx, args): Promise<CatalogListing | null> => {
    const raw = parseCustomServiceId(args.serviceId);
    if (!raw) return null;
    // A hand-edited URL can carry an id that is not a real document id; get()
    // throws on those, and a missing listing is simply "not found".
    let row: Doc<"customServices"> | null = null;
    try {
      row = await ctx.db.get(raw as Id<"customServices">);
    } catch {
      return null;
    }
    if (!row || row.status !== "approved") return null;
    const artisan = await ctx.db.get(row.artisanId);
    if (!artisan || artisan.removedAt) return null;
    return {
      _id: row._id,
      routeId: customServiceId(row._id),
      name: row.name,
      description: row.description,
      trade: row.trade,
      category: row.category,
      isCustomCategory: row.isCustomCategory,
      base: row.base,
      hourly: row.hourly,
      urgent: row.urgent,
      district: row.district,
      workerName: artisan.fullName,
      createdAt: row.createdAt,
    };
  },
});

/* ── admin: board review ── */

export const reviewQueue = query({
  args: {},
  handler: async (ctx) => {
    const adminId = await requireUser(ctx);
    if (!(await isAdminUser(ctx, adminId))) throw new Error("Forbidden");

    const rows = await ctx.db
      .query("customServices")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    const out = [];
    for (const r of rows) {
      const artisan = await ctx.db.get(r.artisanId);
      out.push({
        _id: r._id,
        name: r.name,
        description: r.description,
        trade: r.trade,
        category: r.category,
        isCustomCategory: r.isCustomCategory,
        base: r.base,
        hourly: r.hourly,
        urgent: r.urgent,
        district: r.district,
        artisanId: r.artisanId,
        createdAt: r.createdAt,
        fullName: artisan?.fullName ?? "Unknown",
        kycStatus: artisan?.kycStatus ?? "pending",
        skillStatus: artisan?.skillStatus ?? "pending",
      });
    }
    return out.sort((a, b) => a.createdAt - b.createdAt);
  },
});

/** Board verdict on a worker-created listing; the worker is notified either way. */
export const review = mutation({
  args: {
    serviceId: v.id("customServices"),
    approve: v.boolean(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const adminId = await requireUser(ctx);
    if (!(await isAdminUser(ctx, adminId))) throw new Error("Forbidden");

    const row = await ctx.db.get(args.serviceId);
    if (!row) throw new Error("Listing not found");
    if (row.status !== "pending") throw new Error("Listing already reviewed");

    const now = Date.now();
    await ctx.db.patch(args.serviceId, {
      status: args.approve ? "approved" : "rejected",
      reviewNote: args.note?.trim() || undefined,
      reviewedBy: adminId,
      reviewedAt: now,
    });

    if (args.approve) {
      await notify(
        ctx,
        row.userId,
        "worker_added",
        `Your work "${row.name}" is live`,
        `The federation board approved your work "${row.name}" under "${row.category}". Customers can now book it directly and 90% of every rupee goes to you.`,
      );
      return { published: true };
    }

    await notify(
      ctx,
      row.userId,
      "worker_removed",
      `Your work "${row.name}" needs a change`,
      `The board could not publish this listing. Reason: ${args.note?.trim() || "details unclear"}. Update the description or price and publish it again.`,
    );
    return { published: false };
  },
});
