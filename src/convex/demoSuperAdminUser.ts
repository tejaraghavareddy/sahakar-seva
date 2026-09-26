/**
 * Server-side bookkeeping for the demo SUPER admin (platform tier).
 *
 * Same pattern as demoAdminUser.ts: the demo provider's authorize callback
 * runs in an action context without database access, so this internal mutation
 * provisions the account. It refuses every address except the entry in
 * DEMO_SUPERADMIN_EMAILS.
 */
import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { DEMO_SUPERADMIN_EMAILS } from "./identity";

export const ensureDemoSuperAdminUser = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    if (!DEMO_SUPERADMIN_EMAILS.includes(args.email)) {
      throw new Error("Not a demo super admin address");
    }
    const existing = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .first();

    if (existing) {
      // Keep the role honest if the row predates the demo flow.
      if (existing.role !== "superadmin") {
        await ctx.db.patch(existing._id, { role: "superadmin" });
      }
      return existing._id;
    }

    return await ctx.db.insert("users", {
      email: args.email,
      emailVerificationTime: Date.now(),
      name: "Demo Super Admin",
      role: "superadmin",
      // No societyId: a super admin's view spans every federation. To revoke,
      // delete the entry from DEMO_SUPERADMIN_EMAILS in identity.ts and remove
      // this user row in the Convex dashboard.
    });
  },
});
