import { query } from "./_generated/server";

/**
 * Which sign-in methods this deployment can actually deliver.
 *
 * The OTP providers throw when their delivery credentials are absent, and an
 * exception thrown inside `sendVerificationRequest` propagates all the way out
 * of `auth:signIn`. To a worker that surfaces as
 * `[CONVEX A(auth:signIn)] Server Error` — an opaque failure with no idea
 * what went wrong, on a screen whose only option was the one that failed.
 *
 * The screen needs to know in advance so it can offer a method that will
 * actually work. This returns booleans and nothing else: reporting *whether* a
 * key exists is not the same as revealing it, so it is safe to make public.
 */
export const delivery = query({
  args: {},
  handler: async () => {
    return {
      emailOtp: Boolean(process.env.EMAIL_OTP_API_KEY),
      phoneOtp: Boolean(
        process.env.VONAGE_API_KEY && process.env.VONAGE_API_SECRET,
      ),
    };
  },
});
