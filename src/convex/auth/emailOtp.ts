import { Email } from "@convex-dev/auth/providers/Email";
import axios from "axios";
import { RandomReader, generateRandomString } from "@oslojs/crypto/random";

/**
 * Delivery endpoint for the 6-digit sign-in code, and the credential that
 * authorises sending it.
 *
 * The API key is read from the deployment environment rather than inlined
 * here: anything written in this file is committed to the repository and
 * shipped in the deployment, so a literal key here is a key everyone with
 * repo access can use to send mail as this application.
 *
 * Set in the project's Keys/API keys tab:
 *   EMAIL_OTP_API_KEY  — the x-api-key value for auth.freebuff.app
 *
 * Note on abuse: the Auth.js email provider hands this callback only the
 * request params, with no database context, so send throttling cannot be
 * enforced here. It is enforced one layer out instead, by the
 * `authThrottle.requestOtp` mutation the sign-in screens must call before
 * asking for a code (see src/convex/authThrottle.ts).
 */
const SEND_OTP_URL = "https://auth.freebuff.app/send_otp";

export const emailOtp = Email({
  id: "email-otp",
  maxAge: 60 * 15, // 15 minutes
  // This function can be asynchronous
  async generateVerificationToken() {
    const random: RandomReader = {
      read(bytes: Uint8Array) {
        crypto.getRandomValues(bytes);
      },
    };
    const alphabet = "0123456789";
    return generateRandomString(random, alphabet, 6);
  },
  async sendVerificationRequest({ identifier: email, token }) {
    const apiKey = process.env.EMAIL_OTP_API_KEY;
    if (!apiKey) {
      // Fail loudly rather than silently dropping sign-in codes: a missing
      // key is a configuration error, and the thrown error surfaces in the
      // server log instead of looking like a delivery failure to the user.
      throw new Error(
        "EMAIL_OTP_API_KEY is not set — add it in the project's Keys/API keys tab.",
      );
    }
    try {
      await axios.post(
        SEND_OTP_URL,
        {
          to: email,
          otp: token,
          appName: process.env.VLY_APP_NAME || "a freebuff.com application",
        },
        {
          headers: { "x-api-key": apiKey },
        },
      );
    } catch (error) {
      throw new Error(JSON.stringify(error));
    }
  },
});
