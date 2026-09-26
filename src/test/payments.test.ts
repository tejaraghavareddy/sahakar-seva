/**
 * Gateway checkout: the Razorpay-facing surface of the bookings backend.
 *
 * The two things worth pinning down here are the *money* invariants, because a
 * bug in either is invisible in the UI and expensive in the field:
 *   1. settling a booking is idempotent — a replayed webhook or a
 *      double-submitted checkout handler must not credit welfare twice;
 *   2. a payment captured for order A can never mark booking B as paid.
 */
import { describe, expect, it } from "vitest";
import { internal } from "@/convex/_generated/api";
import {
  api,
  must,
  seedArtisan,
  seedBooking,
  seedCustomer,
  seedWorker,
  setupTest,
  type Id,
} from "./convexHarness";

/** A booking sitting at the "awaiting payment" step, with a worker attached. */
async function awaitingPayment(t: ReturnType<typeof setupTest>) {
  const customer = await seedCustomer(t);
  const worker = await seedWorker(t);
  const artisanId = await seedArtisan(t, worker.id);
  const bookingId = await seedBooking(t, customer.id, {
    status: "payment",
    workerId: artisanId,
    rpOrderId: "order_abc",
  });
  return { customer, worker, artisanId, bookingId };
}

const welfareOf = (t: ReturnType<typeof setupTest>, artisanId: Id<"artisans">) =>
  t.run(async (ctx) => must(await ctx.db.get(artisanId), "artisan row").welfareBalance ?? 0);

const bookingRow = (t: ReturnType<typeof setupTest>, bookingId: Id<"bookings">) =>
  t.run(async (ctx) => must(await ctx.db.get(bookingId), "booking row"));

describe("bookings:gatewayStatus", () => {
  it("reports the gateway as off when no keys are configured", async () => {
    const t = setupTest();
    const { as } = await seedCustomer(t);
    const status = await as.query(api.bookings.gatewayStatus);
    // The checkout button stays hidden until the keys are actually present, so
    // an unconfigured deployment must not leak a half-built button.
    expect(status.enabled).toBe(false);
  });
});

describe("bookings:attachGatewayOrder", () => {
  it("refuses a signed-out caller", async () => {
    const t = setupTest();
    const customer = await seedCustomer(t);
    const bookingId = await seedBooking(t, customer.id, { status: "payment" });
    await expect(
      t.mutation(api.bookings.attachGatewayOrder, {
        id: bookingId,
        rpOrderId: "order_abc",
      }),
    ).rejects.toThrow("Not authenticated");
  });

  it("refuses a user who cannot see the booking", async () => {
    const t = setupTest();
    const customer = await seedCustomer(t);
    const stranger = await seedCustomer(t, { email: "stranger@example.com" });
    const bookingId = await seedBooking(t, customer.id, { status: "payment" });
    await expect(
      stranger.as.mutation(api.bookings.attachGatewayOrder, {
        id: bookingId,
        rpOrderId: "order_abc",
      }),
    ).rejects.toThrow("Not allowed");
  });

  it("lets the customer record the order id on their own booking", async () => {
    const t = setupTest();
    const { id, as } = await seedCustomer(t);
    const bookingId = await seedBooking(t, id, { status: "payment" });
    await as.mutation(api.bookings.attachGatewayOrder, {
      id: bookingId,
      rpOrderId: "order_xyz",
    });
    expect((await bookingRow(t, bookingId)).rpOrderId).toBe("order_xyz");
  });
});

describe("bookings:findByGatewayOrder", () => {
  it("resolves the booking a Razorpay order was opened for", async () => {
    const t = setupTest();
    const { bookingId } = await awaitingPayment(t);
    expect(await t.query(internal.bookings.findByGatewayOrder, { rpOrderId: "order_abc" }))
      .toBe(bookingId);
  });

  it("returns null for an order we never opened", async () => {
    const t = setupTest();
    await awaitingPayment(t);
    expect(
      await t.query(internal.bookings.findByGatewayOrder, { rpOrderId: "order_unknown" }),
    ).toBeNull();
  });
});

describe("bookings:markGatewayPaid", () => {
  it("completes the booking and credits the worker's welfare share", async () => {
    const t = setupTest();
    const { artisanId, bookingId } = await awaitingPayment(t);
    const result = await t.mutation(internal.bookings.markGatewayPaid, {
      bookingId,
      rpOrderId: "order_abc",
      rpPaymentId: "pay_1",
    });
    expect(result).toEqual({ applied: true });

    const b = await bookingRow(t, bookingId);
    expect(b.status).toBe("completed");
    expect(b.paymentMethod).toBe("gateway");
    expect(b.utr).toBe("pay_1");
    expect(b.paidAt).toBeTypeOf("number");
    expect(await welfareOf(t, artisanId)).toBe(70);
  });

  it("is idempotent — a replayed webhook does not pay twice", async () => {
    const t = setupTest();
    const { artisanId, bookingId } = await awaitingPayment(t);
    const args = { bookingId, rpOrderId: "order_abc", rpPaymentId: "pay_1" };

    await t.mutation(internal.bookings.markGatewayPaid, args);
    const second = await t.mutation(internal.bookings.markGatewayPaid, args);

    expect(second).toEqual({ applied: false });
    // The whole point: welfare is credited exactly once, not once per webhook.
    expect(await welfareOf(t, artisanId)).toBe(70);
  });

  it("rejects a payment captured against a different order", async () => {
    const t = setupTest();
    const { bookingId } = await awaitingPayment(t);
    await expect(
      t.mutation(internal.bookings.markGatewayPaid, {
        bookingId,
        rpOrderId: "order_someone_elses",
        rpPaymentId: "pay_2",
      }),
    ).rejects.toThrow("Payment does not match this booking");
    expect((await bookingRow(t, bookingId)).status).toBe("payment");
  });

  it("refuses to settle a booking that is not awaiting payment", async () => {
    const t = setupTest();
    const customer = await seedCustomer(t);
    const worker = await seedWorker(t);
    const artisanId = await seedArtisan(t, worker.id);
    const bookingId = await seedBooking(t, customer.id, {
      status: "assigned",
      workerId: artisanId,
      rpOrderId: "order_abc",
    });
    await expect(
      t.mutation(internal.bookings.markGatewayPaid, {
        bookingId,
        rpOrderId: "order_abc",
        rpPaymentId: "pay_3",
      }),
    ).rejects.toThrow("Not awaiting payment");
  });

  it("credits no welfare when the booking has no worker yet", async () => {
    const t = setupTest();
    const customer = await seedCustomer(t);
    const bookingId = await seedBooking(t, customer.id, {
      status: "payment",
      rpOrderId: "order_abc",
    });
    const result = await t.mutation(internal.bookings.markGatewayPaid, {
      bookingId,
      rpOrderId: "order_abc",
      rpPaymentId: "pay_4",
    });
    expect(result).toEqual({ applied: true });
    expect((await bookingRow(t, bookingId)).status).toBe("completed");
  });
});
