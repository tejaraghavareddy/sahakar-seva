import { describe, expect, it } from "vitest";
import {
  setupTest,
  must,
  api,
  seedCustomer,
  seedWorker,
  seedBooking,
  seedArtisan,
} from "./convexHarness";

/** A booking that has been paid for and finished — the only reviewable state. */
async function completedJob(t: ReturnType<typeof setupTest>) {
  const customer = await seedCustomer(t, { email: "buyer@example.com" });
  const worker = await seedWorker(t, { email: "plumber@example.com" });
  const artisanId = await seedArtisan(t, worker.id, { trade: "plumber" });
  const bookingId = await seedBooking(t, customer.id, {
    trade: "plumber",
    serviceId: "pl-tap",
    status: "completed",
    workerId: artisanId,
    workerUserId: worker.id,
    total: 129,
  });
  return { customer, worker, artisanId, bookingId };
}

describe("reviews:submit", () => {
  it("records a review and updates the artisan's average", async () => {
    const t = setupTest();
    const { customer, artisanId, bookingId } = await completedJob(t);

    const id = await customer.as.mutation(api.reviews.submit, {
      bookingId,
      rating: 5,
      comment: "Came on time and cleaned up after.",
      tags: ["on_time", "clean_work"],
    });
    expect(id).toBeTruthy();

    const artisan = must(await t.run((ctx) => ctx.db.get(artisanId)), "artisan");
    expect(artisan.ratingAvg).toBe(5);
    expect(artisan.ratingCount).toBe(1);
  });

  it("averages across several completed jobs", async () => {
    const t = setupTest();
    const { customer, worker, artisanId, bookingId } = await completedJob(t);
    await customer.as.mutation(api.reviews.submit, { bookingId, rating: 5 });

    const second = await seedBooking(t, customer.id, {
      trade: "plumber",
      status: "settled",
      workerId: artisanId,
      workerUserId: worker.id,
    });
    await customer.as.mutation(api.reviews.submit, {
      bookingId: second,
      rating: 4,
    });

    const artisan = must(await t.run((ctx) => ctx.db.get(artisanId)), "artisan");
    expect(artisan.ratingCount).toBe(2);
    expect(artisan.ratingAvg).toBe(4.5);
  });

  it("refuses a review before the work is completed", async () => {
    const t = setupTest();
    const c = await seedCustomer(t);
    const b = await seedBooking(t, c.id, { status: "inprogress" });
    await expect(
      c.as.mutation(api.reviews.submit, { bookingId: b, rating: 5 }),
    ).rejects.toThrow(/completed/i);
  });

  it("refuses a review from anyone but the booking's own customer", async () => {
    const t = setupTest();
    const { bookingId } = await completedJob(t);
    const stranger = await seedCustomer(t, { email: "stranger@example.com" });
    await expect(
      stranger.as.mutation(api.reviews.submit, { bookingId, rating: 1 }),
    ).rejects.toThrow(/Not your booking/);
  });

  it("refuses a second review on the same booking", async () => {
    const t = setupTest();
    const { customer, bookingId } = await completedJob(t);
    await customer.as.mutation(api.reviews.submit, { bookingId, rating: 4 });
    await expect(
      customer.as.mutation(api.reviews.submit, { bookingId, rating: 1 }),
    ).rejects.toThrow(/already reviewed/i);
  });

  it("rejects a rating outside 1-5", async () => {
    const t = setupTest();
    const { customer, bookingId } = await completedJob(t);
    for (const rating of [0, 6, -1, 3.5]) {
      await expect(
        customer.as.mutation(api.reviews.submit, { bookingId, rating }),
      ).rejects.toThrow(/Invalid rating/);
    }
  });

  it("drops tags that are not in the published vocabulary", async () => {
    const t = setupTest();
    const { customer, bookingId } = await completedJob(t);
    await customer.as.mutation(api.reviews.submit, {
      bookingId,
      rating: 4,
      tags: ["on_time", "not_a_real_tag"],
    });
    const row = must(
      await t.run((ctx) =>
        ctx.db
          .query("reviews")
          .withIndex("by_booking", (q) => q.eq("bookingId", bookingId))
          .first(),
      ),
      "review",
    );
    expect(row.tags).toEqual(["on_time"]);
  });

  it("refuses to review a booking that has no assigned worker", async () => {
    const t = setupTest();
    const c = await seedCustomer(t);
    const b = await seedBooking(t, c.id, { status: "completed" });
    await expect(
      c.as.mutation(api.reviews.submit, { bookingId: b, rating: 5 }),
    ).rejects.toThrow(/no worker/i);
  });

  it("caps how many reviews one customer can write", async () => {
    const t = setupTest();
    const { customer, worker, artisanId } = await completedJob(t);
    let limited = false;
    for (let i = 0; i < 14; i++) {
      const b = await seedBooking(t, customer.id, {
        trade: "plumber",
        status: "completed",
        workerId: artisanId,
        workerUserId: worker.id,
      });
      try {
        await customer.as.mutation(api.reviews.submit, {
          bookingId: b,
          rating: 5,
        });
      } catch (e) {
        // The limiter is the point of this test: the first rejection is the 11th
        // attempt against a budget of 10.
        expect((e as Error).message).toMatch(/Too many attempts/);
        limited = true;
        break;
      }
    }
    expect(limited).toBe(true);
  });
});

describe("reviews:read", () => {
  it("shows a reviewer's first name but never their account", async () => {
    const t = setupTest();
    const { customer, artisanId, bookingId } = await completedJob(t);
    await customer.as.mutation(api.reviews.submit, {
      bookingId,
      rating: 5,
      comment: "Great work",
    });
    const list = await t.query(api.reviews.forArtisan, { artisanId });
    expect(list).toHaveLength(1);
    expect(list[0].reviewerName).toBe("Test");
    const serialized = JSON.stringify(list);
    expect(serialized).not.toContain("buyer@example.com");
  });

  it("hides a booking's review from an unrelated customer", async () => {
    const t = setupTest();
    const { bookingId } = await completedJob(t);
    const stranger = await seedCustomer(t, { email: "nosy@example.com" });
    expect(
      await stranger.as.query(api.reviews.forBooking, { bookingId }),
    ).toBeNull();
  });

  it("lists the signed-in customer's own reviews", async () => {
    const t = setupTest();
    const { customer, bookingId } = await completedJob(t);
    await customer.as.mutation(api.reviews.submit, { bookingId, rating: 5 });
    expect(await customer.as.query(api.reviews.myReviews)).toHaveLength(1);
  });

  it("keeps the review feed away from non-admins", async () => {
    const t = setupTest();
    const c = await seedCustomer(t);
    await expect(c.as.query(api.reviews.listAll)).rejects.toThrow(/Forbidden/);
  });
});
