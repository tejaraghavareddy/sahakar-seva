/**
 * Demo federation-officer account — for judges and testing only.
 *
 * The officer console normally requires a 6-digit code mailed to a real inbox
 * (see ./emailOtp.ts). A demo address like `demo.admin@sahakar.demo` has no
 * inbox, so that flow can never complete — this provider signs the demo
 * officer in with a fixed code instead.
 *
 * Security posture, stated plainly:
 *  - the demo code ships in the client bundle the moment the modal offers the
 *    demo button, so this is a *convenience* door, not a security boundary;
 *  - the door is narrow: one fixed address in the DEMO_ADMIN_EMAILS list, which
 *    is revoked by deleting that entry in identity.ts;
 *  - every other address is refused here, so this provider cannot be used to
 *    sign in as the owner or any real officer — their mail still goes through
 *    the OTP flow;
 *  - admin rights come from the DEMO_ADMIN_EMAILS check in isAdminUser, which
 *    is re-evaluated on every admin query/mutation server-side, not from
 *    anything this file does client-side.
 */
import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import { DataModel, Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { DEMO_ADMIN_EMAILS } from "../identity";

/** The fixed demo code. Deliberately obvious — it is a demo door. */
export const DEMO_CODE = "000000";

export const demoAdmin = ConvexCredentials<DataModel>({
  id: "demo-admin",
  authorize: async (
    credentials,
    ctx,
  ): Promise<{ userId: Id<"users">; sessionId?: Id<"authSessions"> } | null> => {
    const email =
      typeof credentials?.email === "string" ? credentials.email.trim() : "";
    const code = typeof credentials?.code === "string" ? credentials.code : "";

    if (!DEMO_ADMIN_EMAILS.includes(email)) {
      // Not the demo address: this provider does not know you. Real officers
      // sign in through the email-otp provider.
      return null;
    }
    if (code !== DEMO_CODE) {
      return null;
    }

    // The authorize callback runs in an action context — no ctx.db — so the
    // row is found or created by an internal mutation in demoAdminUser.ts.
    // The annotation breaks the api-object circular inference (TS7022).
    const userId: Id<"users"> = await ctx.runMutation(
      internal.demoAdminUser.ensureDemoAdminUser,
      { email },
    );

    return { userId };
  },
});
