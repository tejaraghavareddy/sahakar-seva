/**
 * Razorpay webhook receiver — V8 runtime.
 *
 * This is deliberately its own file: Convex HTTP actions run in the V8
 * runtime, which cannot import from a "use node" module, so the webhook can't
 * live beside the node actions in payments.ts. The crypto needed here is the
 * Web Crypto API, which V8 provides.
 *
 * Register this route in the Razorpay dashboard with the `payment.captured`
 * event and the same secret as RAZORPAY_WEBHOOK_SECRET. The signature header
 * covers the raw request body — which is why the body is read as text here and
 * never re-serialised before verification.
 */

import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { hmacHex, timingSafeEqualHex } from "./cryptoHex";

export const razorpayWebhook = httpAction(async (ctx, request) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    return new Response("Webhook not configured", { status: 503 });
  }
  const raw = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  const expected = await hmacHex(raw, secret);
  if (!timingSafeEqualHex(expected, signature)) {
    return new Response("Invalid signature", { status: 401 });
  }

  let event: {
    event?: string;
    payload?: {
      payment?: {
        entity?: {
          id?: string;
          order_id?: string;
          notes?: { bookingId?: string };
        };
      };
    };
  };
  try {
    event = JSON.parse(raw);
  } catch {
    return new Response("Bad payload", { status: 400 });
  }

  if (event.event === "payment.captured") {
    const entity = event.payload?.payment?.entity;
    const orderId = entity?.order_id;
    const paymentId = entity?.id;
    if (orderId && paymentId) {
      // Razorpay copies an order's notes onto the payment entity, but not on
      // every event shape, so fall back to looking the booking up by the order
      // id we stored when opening checkout. Either way the order id is
      // re-checked against the booking by markGatewayPaid, so a payload that
      // names the wrong order cannot settle the wrong booking.
      const bookingId =
        (await ctx
          .runQuery(internal.bookings.findByGatewayOrder, { rpOrderId: orderId })
          .catch(() => null)) ??
        // The id arrives from a signed-but-untyped payload; markGatewayPaid
        // re-validates it against the database and any bad id is swallowed by
        // the catch below rather than surfaced as a 500.
        (entity?.notes?.bookingId as Id<"bookings"> | undefined);
      if (bookingId) {
        // Settlement is idempotent and refuses a mismatched order id, so a
        // replayed, duplicated, or out-of-order delivery cannot double-book the
        // money. A failure here must not 500: Razorpay retries on 5xx, and a
        // booking that no longer awaits payment is a normal state, not an error
        // worth retrying.
        await ctx
          .runMutation(internal.bookings.markGatewayPaid, {
            bookingId,
            rpOrderId: orderId,
            rpPaymentId: paymentId,
          })
          .catch(() => {});
      }
    }
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
