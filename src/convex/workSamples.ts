import { query, mutation, MutationCtx } from "./_generated/server";
import { isAdminUser, requireUser } from "./identity";
import { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";

const MAX_SAMPLES = 6;
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB per image

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

/* ── worker: request an upload URL ── */

/** Generate a short-lived upload URL for a work-sample image. */
export const generateUploadUrl = mutation({
  args: { mimeType: v.string() },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
    if (!allowed.includes(args.mimeType)) {
      throw new Error("Only JPG, PNG, WebP or HEIC images are allowed");
    }
    return await ctx.storage.generateUploadUrl();
  },
});

/** Register an uploaded image as a pending work sample for review. */
export const completeUpload = mutation({
  args: {
    storageId: v.id("_storage"),
    mimeType: v.string(),
    caption: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);

    const artisan = await ctx.db
      .query("artisans")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    if (!artisan) throw new Error("Complete your trade profile first.");
    if (artisan.removedAt) throw new Error("This account was removed from the federation");

    const meta = await ctx.db.system.get(args.storageId);
    if (!meta) throw new Error("Upload not found — please retry");
    if (meta.size > MAX_BYTES) throw new Error("Image is larger than 5 MB");

    const existing = await ctx.db
      .query("workSamples")
      .withIndex("by_artisan", (q) => q.eq("artisanId", artisan._id))
      .collect();
    if (existing.length >= MAX_SAMPLES) {
      throw new Error(`You can upload up to ${MAX_SAMPLES} work photos`);
    }

    const id = await ctx.db.insert("workSamples", {
      artisanId: artisan._id,
      userId,
      storageId: args.storageId,
      mimeType: args.mimeType,
      caption: args.caption?.trim() || undefined,
      status: "pending",
      uploadedAt: Date.now(),
    });
    return id;
  },
});

/** Delete one of my own pending samples (not reviewed ones). */
export const deleteSample = mutation({
  args: { sampleId: v.id("workSamples") },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const sample = await ctx.db.get(args.sampleId);
    if (!sample) throw new Error("Sample not found");
    if (sample.userId !== userId) throw new Error("Forbidden");
    if (sample.status !== "pending") throw new Error("Reviewed samples cannot be deleted");

    await ctx.storage.delete(sample.storageId);
    await ctx.db.delete(args.sampleId);
  },
});

/** My samples with playable URLs. */
export const mySamples = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const artisan = await ctx.db
      .query("artisans")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    if (!artisan) return [];
    const rows = await ctx.db
      .query("workSamples")
      .withIndex("by_artisan", (q) => q.eq("artisanId", artisan._id))
      .collect();
    const withUrls = await Promise.all(
      rows.map(async (r) => ({
        ...r,
        url: await ctx.storage.getUrl(r.storageId),
      })),
    );
    return withUrls.sort((a, b) => b.uploadedAt - a.uploadedAt);
  },
});

/* ── admin: review queue + verdict ── */

/** All samples pending board review, with worker details and URLs. */
export const reviewQueue = query({
  args: {},
  handler: async (ctx) => {
    const adminId = await requireUser(ctx);
    if (!(await isAdminUser(ctx, adminId))) throw new Error("Forbidden");

    const rows = await ctx.db
      .query("workSamples")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    const artisanCache = new Map<string, Doc<"artisans">>();
    const artisans = await ctx.db.query("artisans").collect();
    for (const a of artisans) artisanCache.set(a._id, a);

    const out = await Promise.all(
      rows.map(async (r) => {
        const artisan = artisanCache.get(r.artisanId);
        return {
          _id: r._id,
          url: await ctx.storage.getUrl(r.storageId),
          mimeType: r.mimeType,
          caption: r.caption,
          uploadedAt: r.uploadedAt,
          artisanId: r.artisanId,
          userId: r.userId,
          fullName: artisan?.fullName ?? "Unknown",
          trade: artisan?.trade ?? "—",
          district: artisan?.district ?? "—",
          phone: artisan?.phone ?? "—",
          kycStatus: artisan?.kycStatus ?? "pending",
        };
      }),
    );
    return out.sort((a, b) => a.uploadedAt - b.uploadedAt);
  },
});

/**
 * Board verdict on one sample. When the decision is an approval AND the
 * worker's KYC is verified, both skill verification and KYC are set to
 * "verified" and the cooperative trade credential is issued.
 * A rejection records the reason and notifies the worker to re-upload.
 */
export const reviewSample = mutation({
  args: {
    sampleId: v.id("workSamples"),
    approve: v.boolean(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const adminId = await requireUser(ctx);
    if (!(await isAdminUser(ctx, adminId))) throw new Error("Forbidden");

    const sample = await ctx.db.get(args.sampleId);
    if (!sample) throw new Error("Sample not found");
    if (sample.status !== "pending") throw new Error("Sample already reviewed");

    const artisan = await ctx.db.get(sample.artisanId);
    if (!artisan) throw new Error("Worker profile not found");

    const now = Date.now();
    await ctx.db.patch(sample._id, {
      status: args.approve ? "approved" : "rejected",
      reviewedBy: adminId,
      reviewedAt: now,
      reviewNote: args.note?.trim() || undefined,
    });

    if (args.approve) {
      const now = Date.now();
      const skillRef = `SKC-${now.toString(36).toUpperCase().slice(-8)}`;
      const patch: Record<string, unknown> = {
        skillStatus: "verified",
        skillVerifiedAt: now,
        skillRef,
      };
      // Board approval of real work evidence satisfies both verifications.
      if (artisan.kycStatus === "verified") {
        if (!artisan.quizPassed) {
          const rand = Math.floor(Math.random() * 0xffff)
            .toString(16)
            .toUpperCase()
            .padStart(4, "0");
          patch.quizPassed = true;
          patch.credentialId = `SSC-${new Date(now).getFullYear()}-${rand}`;
          patch.credentialIssuedAt = now;
        }
      }
      await ctx.db.patch(artisan._id, patch);
      await notify(
        ctx,
        artisan.userId,
        "worker_added",
        "Skill verification approved",
        `The federation board verified your work evidence${artisan.kycStatus === "verified" ? " — your skill verification and KYC are both VERIFIED and your trade credential is issued. You can now accept jobs." : ". Your skill verification is complete — finish KYC approval to accept jobs."}`,
      );
      return { skillVerified: true };
    }

    await notify(
      ctx,
      artisan.userId,
      "worker_removed",
      "Work sample needs another attempt",
      `The board could not verify this work sample. Reason: ${args.note?.trim() || "unclear evidence"}. Please upload clearer photos of your work (tools in use, finished jobs, you at work) and resubmit.`,
    );
    return { skillVerified: false };
  },
});

/** Admin: approve/reject a worker's KYC directly from the skill review tab. */
export const reviewKycFromSkillTab = mutation({
  args: {
    artisanId: v.id("artisans"),
    approve: v.boolean(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const adminId = await requireUser(ctx);
    if (!(await isAdminUser(ctx, adminId))) throw new Error("Forbidden");

    const artisan = await ctx.db.get(args.artisanId);
    if (!artisan) throw new Error("Worker not found");
    if (artisan.kycStatus !== "pending") throw new Error("KYC is not pending");

    const now = Date.now();
    if (args.approve) {
      const kycRef = `BGC-${now.toString(36).toUpperCase().slice(-8)}`;
      await ctx.db.patch(artisan._id, {
        kycStatus: "verified",
        kycVerifiedAt: now,
        kycRef,
      });
      await notify(
        ctx,
        artisan.userId,
        "worker_added",
        "KYC verification approved",
        "Your identity verification is approved by the federation board. Complete skill verification (upload work photos) to receive your credential and accept jobs.",
      );
    } else {
      await ctx.db.patch(artisan._id, {
        kycStatus: "rejected",
      });
      await notify(
        ctx,
        artisan.userId,
        "worker_removed",
        "KYC verification declined",
        `Your identity verification was declined. Reason: ${args.note?.trim() || "documents unclear"}. Update your ID details and resubmit from onboarding.`,
      );
    }
  },
});
