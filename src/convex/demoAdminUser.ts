/**
 * Server-side bookkeeping for the demo federation officer.
 *
 * The demo provider's `authorize` callback runs in an action context, which
 * cannot touch the database directly, so the user lookup/creation lives in
 * this internal function. It refuses every address except the entries in
 * DEMO_ADMIN_EMAILS, so it cannot be driven into minting a second admin.
 */
import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { DEMO_ADMIN_EMAILS } from "./identity";

export const ensureDemoAdminUser = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    if (!DEMO_ADMIN_EMAILS.includes(args.email)) {
      throw new Error("Not a demo officer address");
    }
    const existing = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .first();

    if (existing) {
      // The /admin route gate reads the user's role field (see the session
      // resolution in App.tsx), so make sure a pre-existing row carries it.
      if (existing.role !== "admin") {
        await ctx.db.patch(existing._id, { role: "admin" });
      }
      return existing._id;
    }

    return await ctx.db.insert("users", {
      email: args.email,
      emailVerificationTime: Date.now(),
      name: "Demo Federation Officer",
      role: "admin",
      // The role field is what the frontend session gate reads; the backend
      // also re-checks DEMO_ADMIN_EMAILS on every admin call. To revoke the
      // demo account entirely, delete this user row from the Convex dashboard
      // after removing the address from DEMO_ADMIN_EMAILS in identity.ts.
    });
  },
});
