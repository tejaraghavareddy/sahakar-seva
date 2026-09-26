/**
 * End-to-end workflows.
 *
 * The unit suites each pin one function. This file walks the journeys a real
 * member takes, across features, so that a change which keeps every individual
 * test green but breaks the actual product still fails here.
 */
import { describe, expect, it } from "vitest";
import {
  setupTest,
  must,
  api,
  seedCustomer,
  seedWorker,
  seedArtisan,
  seedAdmin,
} from "./convexHarness";

const WHEN = () => Date.now() + 3600_000;

/** A booked, unassigned job waiting on the workers' radar. */
async function freshJob(t: ReturnType<typeof setupTest>, email = "c@example.com") {
  const customer = await seedCustomer(t, { email });
  const bookingId = await customer.as.mutation(api.bookings.create, {
    serviceId: "el-fan",
    address: "12 Gandhi Street, Kurnool",
    lat: 15.83,
    lng: 78.03,
    scheduledFor: WHEN(),
    urgent: false,
    welfareOptIn: true,
  });
  return { customer, bookingId };
}

describe("workflow: a customer books, a verified worker does the job, they get paid", () => {
  it("runs the whole lifecycle and pays both parties correctly", async () => {
    const t = setupTest();

    const { customer, bookingId } = await freshJob(t);
    const worker = await seedWorker(t, { email: "sparky@example.com" });
    const artisanId = await seedArtisan(t, worker.id, { trade: "electrician" });

    // 1. The job starts on the radar, unpaid and unassigned.
    const radar = await worker.as.query(api.bookings.listForWorker);
    expect(radar.radar.map((b) => b._id)).toContain(bookingId);
    expect(radar.mine).toHaveLength(0);

    // 2. A worker of the wrong trade cannot take it.
    const wrongTrade = await seedWorker(t, { email: "plumb@example.com" });
    await seedArtisan(t, wrongTrade.id, { trade: "plumber" });
    await expect(
      wrongTrade.as.mutation(api.bookings.accept, { id: bookingId }),
    ).rejects.toThrow();

    // 3. The right worker accepts, and the customer sees the job with the
    //    worker's UPI id for the money to go to directly.
    await worker.as.mutation(api.bookings.accept, { id: bookingId });
    const accepted = must(
      await customer.as.query(api.bookings.getBooking, { id: bookingId }),
      "booking",
    );
    expect(accepted.status).toBe("accepted");
    expect(accepted.workerId).toBe(artisanId);

    // 4. Work progresses to the payment step.
    for (const stage of ["enroute", "inprogress", "payment"]) {
      expect(await worker.as.mutation(api.bookings.advance, { id: bookingId })).toBe(
        stage,
      );
    }

    // 5. The customer pays and confirms the reference.
    const quote = must(
      await customer.as.query(api.bookings.getBooking, { id: bookingId }),
      "booking",
    );
    await customer.as.mutation(api.bookings.confirmUtr, {
      id: bookingId,
      utr: "UTR99887766",
    });
    const paid = must(
      await customer.as.query(api.bookings.getBooking, { id: bookingId }),
      "booking",
    );
    expect(paid.status).toBe("completed");
    expect(paid.paymentMethod).toBe("upi_manual");
    expect(paid.utr).toBe("UTR99887766");

    // 6. The worker's welfare ledger was credited the 7% share, once.
    const artisan = must(
      await t.run(async (ctx) => (await ctx.db.get(artisanId))?.welfareBalance),
      "welfare balance",
    );
    expect(artisan).toBe(quote.welfareAmt);
    expect(artisan).toBe(Math.round(quote.base * 0.07));

    // 7. The job settles and the customer can review the finished work.
    expect(await worker.as.mutation(api.bookings.advance, { id: bookingId })).toBe(
      "settled",
    );
    await customer.as.mutation(api.reviews.submit, {
      bookingId,
      rating: 5,
      comment: "Came on time, fixed it properly.",
    });
    const forBooking = await customer.as.query(api.reviews.forBooking, {
      bookingId,
    });
    expect(forBooking?.rating).toBe(5);

    // 8. The welfare credit is not re-applied by any later step.
    expect(
      must(
        await t.run(async (ctx) => (await ctx.db.get(artisanId))?.welfareBalance),
        "welfare balance",
      ),
    ).toBe(quote.welfareAmt);
  });

  it("does not let one customer pay for another customer's booking", async () => {
    const t = setupTest();
    const { bookingId } = await freshJob(t);
    const worker = await seedWorker(t);
    const artisanId = await seedArtisan(t, worker.id, { trade: "electrician" });
    await worker.as.mutation(api.bookings.accept, { id: bookingId });
    // A completed job always has a worker bound to it, so give it one.
    await t.run(async (ctx) => {
      await ctx.db.patch(bookingId, {
        status: "payment",
        workerId: artisanId,
        workerUserId: worker.id,
      });
    });

    const stranger = await seedCustomer(t, { email: "nosy@example.com" });
    await expect(
      stranger.as.mutation(api.bookings.confirmUtr, { id: bookingId, utr: "UTR123456" }),
    ).rejects.toThrow("Not your booking");
  });
});

describe("workflow: a job is swapped to another worker", () => {
  it("hands the job over and keeps the new worker bound to it", async () => {
    const t = setupTest();
    const { customer, bookingId } = await freshJob(t);

    const first = await seedWorker(t, { email: "first@example.com" });
    const firstArtisan = await seedArtisan(t, first.id, { trade: "electrician" });
    const second = await seedWorker(t, { email: "second@example.com" });
    const secondArtisan = await seedArtisan(t, second.id, { trade: "electrician" });

    await first.as.mutation(api.bookings.accept, { id: bookingId });
    // The customer asks for a different worker...
    await customer.as.mutation(api.bookings.requestSwap, { id: bookingId });
    // ...and the original stands down.
    await first.as.mutation(api.bookings.releaseForSwap, { id: bookingId });

    // The second worker takes it, and is now the one bound to the job.
    await second.as.mutation(api.bookings.claimSwap, { id: bookingId });
    const swapped = must(
      await customer.as.query(api.bookings.getBooking, { id: bookingId }),
      "booking",
    );
    expect(swapped.status).toBe("accepted");
    expect(swapped.workerId).toBe(secondArtisan);
    expect(swapped.workerId).not.toBe(firstArtisan);

    // The worker who stood down can no longer advance or release it.
    await expect(
      first.as.mutation(api.bookings.releaseForSwap, { id: bookingId }),
    ).rejects.toThrow("Not your job");
  });
});

describe("workflow: a customer cancels", () => {
  it("frees the job and stops it being worked", async () => {
    const t = setupTest();
    const { customer, bookingId } = await freshJob(t);
    const worker = await seedWorker(t);
    await seedArtisan(t, worker.id, { trade: "electrician" });
    await worker.as.mutation(api.bookings.accept, { id: bookingId });

    await customer.as.mutation(api.bookings.cancel, {
      id: bookingId,
      by: "customer",
    });
    const cancelled = must(
      await customer.as.query(api.bookings.getBooking, { id: bookingId }),
      "booking",
    );
    expect(cancelled.status).toBe("cancelled");

    // A cancelled job is dead: the worker cannot keep pushing it along, and a
    // payment cannot be bolted onto it afterwards.
    await expect(
      worker.as.mutation(api.bookings.advance, { id: bookingId }),
    ).rejects.toThrow("Cannot advance from cancelled");
    await expect(
      customer.as.mutation(api.bookings.confirmUtr, { id: bookingId, utr: "UTR123456" }),
    ).rejects.toThrow("Not awaiting payment");
  });
});

describe("workflow: the federation board oversees the marketplace", () => {
  it("reports revenue and welfare that match the jobs actually done", async () => {
    const t = setupTest();
    const admin = await seedAdmin(t, { email: "board@sahakar.test" });

    // Two ordinary jobs, run to completion.
    let totalWelfare = 0;
    for (const email of ["one@example.com", "two@example.com"]) {
      const { customer, bookingId } = await freshJob(t, email);
      const worker = await seedWorker(t, { email: `w-${email}` });
      await seedArtisan(t, worker.id, { trade: "electrician" });
      await worker.as.mutation(api.bookings.accept, { id: bookingId });
      for (const stage of ["enroute", "inprogress", "payment"]) {
        expect(await worker.as.mutation(api.bookings.advance, { id: bookingId })).toBe(
          stage,
        );
      }
      const quote = must(
        await customer.as.query(api.bookings.getBooking, { id: bookingId }),
        "booking",
      );
      totalWelfare += quote.welfareAmt;
      await customer.as.mutation(api.bookings.confirmUtr, {
        id: bookingId,
        utr: "UTR123456",
      });
    }

    const overview = await admin.as.query(api.admin.overview);
    expect(overview.welfarePool).toBe(totalWelfare);
    expect(overview.bookings).toBe(2);
    // The 90/7/3 split must account for every rupee of revenue.
    expect(overview.workerPayouts + overview.welfarePool + overview.opsPool).toBe(
      overview.revenueSettled,
    );

    // The earnings ledger counts each finished job once.
    const ledger = await admin.as.query(api.admin.earningsLedger);
    expect(ledger.reduce((n, e) => n + e.jobs, 0)).toBe(2);
    expect(ledger.reduce((n, e) => n + e.welfare, 0)).toBe(totalWelfare);
  });

  it("keeps the admin console closed to ordinary members", async () => {
    const t = setupTest();
    const { customer } = await freshJob(t);
    await expect(customer.as.query(api.admin.overview)).rejects.toThrow("Forbidden");
    await expect(
      customer.as.mutation(api.admin.adminCancelBooking, {
        id: (await customer.as.query(api.bookings.listForCustomer))[0]._id,
      }),
    ).rejects.toThrow("Forbidden");
  });
});
