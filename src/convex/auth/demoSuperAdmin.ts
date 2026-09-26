/**
 * Demo SUPER admin provider — platform-tier demo door (judges / testing).
 *
 * Same security posture as demoAdmin.ts, one tier up: the fixed code ships in
 * the client bundle, so this is a convenience door. It accepts exactly one
 * address (the DEMO_SUPERADMIN_EMAILS entry) and nothing else, so it cannot be
 * used to reach the owner, a federation admin, or any real officer account.
 */
import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import { DataModel, Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { DEMO_SUPERADMIN_EMAILS } from "../identity";

/** Fixed demo code for the platform-tier demo account. */
export const DEMO_SUPER_CODE = "000000";

export const demoSuperAdmin = ConvexCredentials<DataModel>({
  id: "demo-superadmin",
  authorize: async (
    credentials,
    ctx,
  ): Promise<{ userId: Id<"users">; sessionId?: Id<"authSessions"> } | null> => {
    const email =
      typeof credentials?.email === "string" ? credentials.email.trim() : "";
    const code = typeof credentials?.code === "string" ? credentials.code : "";

    if (!DEMO_SUPERADMIN_EMAILS.includes(email)) return null;
    if (code !== DEMO_SUPER_CODE) return null;

    // Action context: no ctx.db here — provision via internal mutation. The
    // annotation breaks the api-object circular inference (TS7022).
    const userId: Id<"users"> = await ctx.runMutation(
      internal.demoSuperAdminUser.ensureDemoSuperAdminUser,
      { email },
    );
    return { userId };
  },
});
