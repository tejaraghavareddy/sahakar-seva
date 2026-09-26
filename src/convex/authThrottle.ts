import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { consume, otpSubject } from "./rateLimit";
import { normalisePhone } from "./auth/phoneOtp";

/**
 * Outbound sign-in-code throttle.
 *
 * Each requested code costs a real outbound email through a paid provider, and
 * the request may name *any* address — so without a limit, one caller can
 * mail codes to an arbitrary third party as fast as the provider allows.
 *
 * The Auth.js email provider only receives the request params (no database
 * context), so the limit cannot live inside the provider itself. Instead every
 * sign-in screen calls `requestOtp` before invoking `signIn("email-otp", …)`;
 * the mutation spends part of the per-address budget and throws once it is
 * spent.
 *
 * Honest limitation: this is client-mediated. It stops the ordinary client and
 * any script that reuses this flow, but a caller invoking the auth signIn
 * endpoint directly bypasses it. It raises cost and friction rather than
 * providing a hard server-side guarantee. A hard guarantee would need a custom
 * provider or an edge function in front of the auth routes.
 */
export const requestOtp = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const email = args.email.trim();
    // Keep the throttle from being used as a free database for junk keys.
    if (!email || email.length > 254 || !email.includes("@")) {
      throw new Error("Enter a valid email address.");
    }
    await consume(ctx, "otp", otpSubject(email));
    return { ok: true };
  },
});

/**
 * Outbound sign-in-SMS throttle — the phone twin of `requestOtp`.
 *
 * An SMS costs real money per message and, unlike an email, it lands on a
 * handset the caller may not own. Without this, one script could bill the
 * cooperative for a flood of texts to an arbitrary mobile number.
 *
 * The number is normalised first so that "9876543210", "+919876543210" and
 * "098765 43210" all spend the *same* budget. Without that, a caller would get
 * a fresh allowance per spelling and the limit would be trivially bypassed.
 *
 * As with email, this is client-mediated: it raises cost and friction rather
 * than being a hard server-side guarantee.
 */
export const requestPhoneOtp = mutation({
  args: { phone: v.string() } ,
  handler: async (ctx, args) => {
    // Throws "Enter a valid mobile number." before any budget is spent, so a
    // malformed number cannot be used to probe the limiter.
    const phone = normalisePhone(args.phone);
    await consume(ctx, "otp", otpSubject(`phone:${phone}`));
    return { ok: true, phone };
  },
});
