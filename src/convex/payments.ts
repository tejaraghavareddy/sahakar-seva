"use node";

/**
 * Razorpay gateway bridge — order creation and checkout verification.
 *
 * The cooperative's default payment rail stays direct UPI — the worker's own
 * VPA, zero commission, no middleman. This module is the *verified*
 * alternative for households that want a gateway receipt: Razorpay Checkout in
 * the browser, a signature check, and the same 90/7/3 settlement the manual
 * UTR flow books.
 *
 * Everything money-critical happens server-side:
 *  - the key secret is only ever read here, in the node runtime,
 *  - the client callback trusts nothing until the HMAC of
 *    `${order_id}|${payment_id}` matches,
 *  - settlement itself is an idempotent internalMutation
 *    (internal.bookings.markGatewayPaid), so a replayed webhook and this
 *    handler racing each other cannot pay a worker twice.
 *
 * The webhook receiver lives in paymentsWebhook.ts, because Convex HTTP
 * actions run in the V8 runtime and cannot import from a "use node" module.
 *
 * Until RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET / RAZORPAY_WEBHOOK_SECRET are
 * set in the deployment's environment, the client falls back to the manual UPI
 * QR + UTR flow and these functions are never reachable from the UI.
 */

import { v } from "convex/values";
import { action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api, internal } from "./_generated/api";
import { gatewayEnabled } from "./bookings";
import { hmacHex, timingSafeEqualHex } from "./cryptoHex";

const RAZORPAY_API = "https://api.razorpay.com/v1";

/** Basic auth header for the Razorpay REST API. */
function apiAuthHeader(): string {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error("Razorpay is not configured for this deployment");
  }
  return `Basic ${btoa(`${keyId}:${keySecret}`)}`;
}

/**
 * Create a Razorpay order for a booking. The booking id travels in `notes` so
 * the webhook can find the booking without trusting any client-supplied id.
 * The amount is taken from the booking record server-side — the client never
 * gets to name a price.
 */
export const createOrder = action({
  args: { bookingId: v.id("bookings") },
  handler: async (
    ctx,
    args,
  ): Promise<{ orderId: string; amount: number }> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const b = await ctx.runQuery(api.bookings.getBooking, { id: args.bookingId });
    if (!b) throw new Error("Booking not found");
    if (b.customerId !== userId) throw new Error("Not your booking");
    if (!gatewayEnabled()) {
      throw new Error("Card/UPI gateway is not enabled — pay by UPI scan");
    }
    if (b.status !== "payment") throw new Error("Not awaiting payment");

    const res = await fetch(`${RAZORPAY_API}/orders`, {
      method: "POST",
      headers: {
        Authorization: apiAuthHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: b.total * 100, // paise — Razorpay amounts are integers
        currency: "INR",
        receipt: b._id,
        notes: { bookingId: b._id },
      }),
    });
    if (!res.ok) {
      throw new Error(`Razorpay order failed (${res.status})`);
    }
    const order = (await res.json()) as { id: string };
    await ctx.runMutation(api.bookings.attachGatewayOrder, {
      id: b._id,
      rpOrderId: order.id,
    });
    return { orderId: order.id, amount: b.total };
  },
});

/**
 * Client-side callback path. Razorpay Checkout hands the browser a
 * razorpay_payment_id / razorpay_order_id / razorpay_signature triple; the
 * signature is an HMAC-SHA256 of `${order_id}|${payment_id}` keyed with the
 * key secret. Verifying it here lets the booking complete without waiting for
 * the webhook — the webhook stays as the durable backstop either way, and
 * settlement is idempotent, so whichever lands first wins and the second is a
 * no-op.
 */
export const verifyAndPay = action({
  args: {
    bookingId: v.id("bookings"),
    rpOrderId: v.string(),
    rpPaymentId: v.string(),
    rpSignature: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ applied: boolean }> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      throw new Error("Razorpay is not configured for this deployment");
    }
    const b = await ctx.runQuery(api.bookings.getBooking, {
      id: args.bookingId,
    });
    if (!b) throw new Error("Booking not found");
    if (b.customerId !== userId) throw new Error("Not your booking");

    const expected = await hmacHex(`${args.rpOrderId}|${args.rpPaymentId}`, keySecret);
    if (!timingSafeEqualHex(expected, args.rpSignature)) {
      throw new Error("Payment signature verification failed");
    }
    return await ctx.runMutation(internal.bookings.markGatewayPaid, {
      bookingId: args.bookingId,
      rpOrderId: args.rpOrderId,
      rpPaymentId: args.rpPaymentId,
    });
  },
});
