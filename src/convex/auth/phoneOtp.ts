import { Phone } from "@convex-dev/auth/providers/Phone";
import axios from "axios";

/**
 * Phone sign-in for gig workers.
 *
 * A worker registering with the federation is far more likely to have a phone
 * in their hand than an inbox, so the worker portal accepts a mobile number as
 * its identifier alongside email.
 *
 * Delivery uses Vonage's Messages API rather than their Verify product on
 * purpose: Convex Auth generates the code and stores it against the session,
 * and its `Phone` provider verifies the code the worker types against that
 * stored value. Verify would have Vonage generate its own code, which we then
 * could not match. Sending the token ourselves keeps the two in sync and works
 * with any SMS gateway.
 *
 * Keys are read from the deployment environment, never inlined here, because
 * this file ships with the deployment.
 *
 * Set in the project's Keys/API keys tab:
 *   VONAGE_API_KEY     — Vonage API key id
 *   VONAGE_API_SECRET  — Vonage API secret
 *   VONAGE_SMS_SENDER  — registered alphanumeric sender id (default below)
 *
 * Abuse note: as with email, the Auth.js provider hands this callback only the
 * request params and no database context, so throttling cannot live here. It is
 * enforced one layer out by `authThrottle.requestPhoneOtp`, which every screen
 * must call before asking for a code.
 */

const MESSAGES_URL = "https://messages.nexmo.com/v1/messages";

/**
 * Normalise a user-typed Indian mobile number to E.164 (+91XXXXXXXXXX).
 *
 * Workers type this every which way — "9876543210", "+91 98765 43210",
 * "09876543210" — and the verification step compares the string against the
 * account id, so a mismatch would lock out a worker who typed their own number
 * correctly. Normalising at the edge is what makes the comparison stable.
 */
export function normalisePhone(raw: string): string {
  // Strip the separators people type for legibility.
  let digits = (raw ?? "").replace(/[\s\-()]/g, "");
  // A leading "+" means the number is already international.
  const hasPlus = digits.startsWith("+");
  digits = digits.replace(/\D/g, "");
  if (!hasPlus) {
    // "09876543210" — a leading trunk zero is how Indians write a mobile number
    // locally; internationally it is dropped.
    if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
    // A bare 10-digit number is assumed Indian, which is the only market this
    // federation operates in.
    if (digits.length === 10) return `+91${digits}`;
  }
  if (digits.length < 8 || digits.length > 15) {
    throw new Error("Enter a valid mobile number.");
  }
  return `+${digits}`;
}

/** A short, human-readable form for logs, so a failure never leaks a full number. */
function maskPhone(e164: string): string {
  return `••••• ${e164.slice(-5)}`;
}

export const phoneOtp = Phone({
  id: "phone-otp",
  // A code that takes 20 minutes to type is not a code, it is a lost session.
  maxAge: 60 * 10,
  async sendVerificationRequest({ identifier, token }) {
    const apiKey = process.env.VONAGE_API_KEY;
    const apiSecret = process.env.VONAGE_API_SECRET;
    if (!apiKey || !apiSecret) {
      // Surface the misconfiguration in the server log instead of letting it
      // look to the worker like their phone number is unreachable.
      throw new Error(
        "VONAGE_API_KEY / VONAGE_API_SECRET are not set — add them in the project's Keys/API keys tab.",
      );
    }
    const to = normalisePhone(identifier);
    const from = process.env.VONAGE_SMS_SENDER || "SahakarSeva";
    try {
      await axios.post(
        MESSAGES_URL,
        {
          messageType: "text",
          text: `${token} is your Sahakar Seva worker sign-in code. It expires in 10 minutes. Do not share it with anyone.`,
          to,
          from,
        },
        {
          auth: { username: apiKey, password: apiSecret },
          headers: { "Content-Type": "application/json" },
        },
      );
    } catch (error) {
      const detail =
        axios.isAxiosError(error)
          ? `${error.response?.status ?? ""} ${JSON.stringify(error.response?.data ?? "")}`
          : String(error);
      throw new Error(`SMS delivery failed for ${maskPhone(to)}: ${detail}`);
    }
  },
});
