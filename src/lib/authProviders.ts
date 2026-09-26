/**
 * Convex Auth provider ids, shared by the sign-in screens and the server-side
 * provider definitions.
 *
 * This lives outside `src/convex/` on purpose: the provider modules import
 * server-only code (Convex Auth's `Phone` factory and axios), and pulling that
 * into the browser bundle would be both wasteful and wrong. A plain constants
 * module is the one file both sides can import.
 *
 * The ids are asserted in src/test/workerAuth.test.ts, because a mismatch is
 * silent at build time and fails at runtime as "Provider `x` is not
 * configured" — the screen would simply never work.
 */
export const PHONE_PROVIDER_ID = "phone-otp";
export const EMAIL_PROVIDER_ID = "email-otp";
