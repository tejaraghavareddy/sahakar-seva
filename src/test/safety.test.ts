import { describe, expect, it } from "vitest";
import {
  setupTest,
  must,
  api,
  seedCustomer,
  seedWorker,
  seedArtisan,
  seedBooking,
} from "./convexHarness";

/* ── Swap Service ── */

describe("bookings: Swap Service", () => {
  async function acceptedJob(t: ReturnType<typeof setupTest>) {
    const customer = await seedCustomer(t, { email: "customer@example.com" });
    const first = await seedWorker(t, { email: "first@example.com" });
    const firstArtisan = await seedArtisan(t, first.id, { trade: "plumber" });
    const bookingId = await seedBooking(t, customer.id, {
      trade: "plumber",
      serviceId: "pl-tap",
      status: "accepted",
      workerId: firstArtisan,
      workerUserId: first.id,
    });
    return { customer, first, firstArtisan, bookingId };
  }

  it("keeps the job alive and re-offers it instead of cancelling", async () => {
    const t = setupTest();
    const { first, bookingId } = await acceptedJob(t);
    await first.as.mutation(api.bookings.releaseForSwap, { id: bookingId });

    const b = must(await t.run((ctx) => ctx.db.get(bookingId)), "booking");
    expect(b.status).toBe("pending");
    expect(b.workerUserId).toBeUndefined();
    expect(b.workerId).toBeUndefined();
    // The stood-down worker is remembered, so the job can come back to them.
    expect(b.originalWorkerId).toBeTruthy();
    expect(b.swapRequestedAt).toBeTruthy();
  });

  it("records a swap as a signal for the board, never a penalty", async () => {
    const t = setupTest();
    const { first, firstArtisan, bookingId } = await acceptedJob(t);
    await first.as.mutation(api.bookings.releaseForSwap, { id: bookingId });
    const a = must(await t.run((ctx) => ctx.db.get(firstArtisan)), "artisan");
    expect(a.declinedSwaps).toBe(1);
    // Nothing else about their standing is touched.
    expect(a.kycStatus).toBe("verified");
  });

  it("lets another verified worker of the same trade claim the job", async () => {
    const t = setupTest();
    const { first, bookingId } = await acceptedJob(t);
    await first.as.mutation(api.bookings.releaseForSwap, { id: bookingId });

    const second = await seedWorker(t, { email: "second@example.com" });
    const secondArtisan = await seedArtisan(t, second.id, { trade: "plumber" });
    await second.as.mutation(api.bookings.claimSwap, { id: bookingId });

    const b = must(await t.run((ctx) => ctx.db.get(bookingId)), "booking");
    expect(b.status).toBe("accepted");
    expect(b.workerId).toBe(secondArtisan);
    expect(b.swapRequestedAt).toBeUndefined();
    expect(b.originalWorkerId).toBeUndefined();
  });

  it("refuses a worker from another trade claiming the swap", async () => {
    const t = setupTest();
    const { first, bookingId } = await acceptedJob(t);
    await first.as.mutation(api.bookings.releaseForSwap, { id: bookingId });
    const sparky = await seedWorker(t, { email: "sparky@example.com" });
    await seedArtisan(t, sparky.id, { trade: "electrician" });
    await expect(
      sparky.as.mutation(api.bookings.claimSwap, { id: bookingId }),
    ).rejects.toThrow(/not in your trade/);
  });

  it("refuses an unverified worker claiming the swap", async () => {
    const t = setupTest();
    const { first, bookingId } = await acceptedJob(t);
    await first.as.mutation(api.bookings.releaseForSwap, { id: bookingId });
    const rookie = await seedWorker(t, { email: "rookie@example.com" });
    await seedArtisan(t, rookie.id, { trade: "plumber", kycStatus: "pending" });
    await expect(
      rookie.as.mutation(api.bookings.claimSwap, { id: bookingId }),
    ).rejects.toThrow(/Verified credential/);
  });

  it("refuses the stood-down worker re-claiming their own job", async () => {
    const t = setupTest();
    const { first, bookingId } = await acceptedJob(t);
    await first.as.mutation(api.bookings.releaseForSwap, { id: bookingId });
    await expect(
      first.as.mutation(api.bookings.claimSwap, { id: bookingId }),
    ).rejects.toThrow(/already your job/);
  });

  it("returns the job to the original worker once the swap window lapses", async () => {
    const t = setupTest();
    const { first, firstArtisan, bookingId } = await acceptedJob(t);
    await first.as.mutation(api.bookings.releaseForSwap, { id: bookingId });
    // Push the swap request into the past, beyond the window.
    await t.run(async (ctx) => {
      const b = must(await ctx.db.get(bookingId), "booking");
      await ctx.db.patch(b._id, { swapRequestedAt: Date.now() - 6 * 3600_000 });
    });

    expect(
      await first.as.mutation(api.bookings.expireSwap, { id: bookingId }),
    ).toBe(true);
    const b = must(await t.run((ctx) => ctx.db.get(bookingId)), "booking");
    expect(b.status).toBe("accepted");
    expect(b.workerId).toBe(firstArtisan);
    expect(b.swapRequestedAt).toBeUndefined();
  });

  it("leaves a swap alone until the window has actually passed", async () => {
    const t = setupTest();
    const { first, bookingId } = await acceptedJob(t);
    await first.as.mutation(api.bookings.releaseForSwap, { id: bookingId });
    expect(
      await first.as.mutation(api.bookings.expireSwap, { id: bookingId }),
    ).toBe(false);
    const b = must(await t.run((ctx) => ctx.db.get(bookingId)), "booking");
    expect(b.status).toBe("pending");
  });

  it("only lets the customer ask for a swap", async () => {
    const t = setupTest();
    const { bookingId } = await acceptedJob(t);
    const nosy = await seedCustomer(t, { email: "nosy@example.com" });
    await expect(
      nosy.as.mutation(api.bookings.requestSwap, { id: bookingId }),
    ).rejects.toThrow(/Not your booking/);
  });
});

/* ── Emergency Quick Help ── */

describe("bookings: Emergency Quick Help", () => {
  it("broadcasts an urgent job that carries no worker yet", async () => {
    const t = setupTest();
    const c = await seedCustomer(t, { email: "c@example.com" });
    const id = await c.as.mutation(api.bookings.createEmergency, {
      serviceId: "pl-block",
      address: "9 Ring Road",
      lat: 15.83,
      lng: 78.03,
      notes: "Water rising in the kitchen",
    });
    const b = must(await t.run((ctx) => ctx.db.get(id)), "booking");
    expect(b.emergency).toBe(true);
    expect(b.urgent).toBe(true);
    expect(b.status).toBe("pending");
    expect(b.workerUserId).toBeUndefined();
  });

  it("puts an emergency ahead of ordinary work on the trade's radar", async () => {
    const t = setupTest();
    const c = await seedCustomer(t, { email: "c@example.com" });
    const p = await seedWorker(t, { email: "p@example.com" });
    await seedArtisan(t, p.id, { trade: "plumber" });

    // A normal booking first, so the emergency genuinely has to jump it.
    await c.as.mutation(api.bookings.create, {
      serviceId: "pl-tap",
      address: "1 First Street",
      scheduledFor: Date.now() + 7200_000,
      urgent: false,
      welfareOptIn: true,
    });
    await c.as.mutation(api.bookings.createEmergency, {
      serviceId: "pl-block",
      address: "9 Ring Road",
    });

    const { radar } = await p.as.query(api.bookings.listForWorker);
    expect(radar).toHaveLength(2);
    expect(radar[0].emergency).toBe(true);
  });

  it("keeps an emergency out of another trade's radar", async () => {
    const t = setupTest();
    const c = await seedCustomer(t, { email: "c@example.com" });
    await c.as.mutation(api.bookings.createEmergency, {
      serviceId: "pl-block",
      address: "9 Ring Road",
    });
    const sparky = await seedWorker(t, { email: "sparky@example.com" });
    await seedArtisan(t, sparky.id, { trade: "electrician" });
    const { radar } = await sparky.as.query(api.bookings.listForWorker);
    expect(radar).toHaveLength(0);
  });

  it("refuses an emergency for a service that does not exist", async () => {
    const t = setupTest();
    const c = await seedCustomer(t, { email: "c@example.com" });
    await expect(
      c.as.mutation(api.bookings.createEmergency, {
        serviceId: "nope",
        address: "9 Ring Road",
      }),
    ).rejects.toThrow(/Unknown service/);
  });

  it("caps emergency broadcasts tightly, because they page real people", async () => {
    const t = setupTest();
    const c = await seedCustomer(t, { email: "c@example.com" });
    let limited = false;
    for (let i = 0; i < 6; i++) {
      try {
        await c.as.mutation(api.bookings.createEmergency, {
          serviceId: "pl-block",
          address: "9 Ring Road",
        });
      } catch (e) {
        expect((e as Error).message).toMatch(/Too many attempts/);
        limited = true;
        break;
      }
    }
    expect(limited).toBe(true);
  });
});

/* ── Safety Mode ── */

describe("bookings: Safety Mode address redaction", () => {
  async function safetyJob(t: ReturnType<typeof setupTest>) {
    const customer = await seedCustomer(t, { email: "customer@example.com" });
    const worker = await seedWorker(t, { email: "worker@example.com" });
    await seedArtisan(t, worker.id, { trade: "plumber" });
    const bookingId = await seedBooking(t, customer.id, {
      trade: "plumber",
      serviceId: "pl-tap",
      address: "12 Ring Road, Flat 4B",
      status: "accepted",
      workerUserId: worker.id,
    });
    return { customer, worker, bookingId };
  }

  it("withholds the address from the worker until they set off", async () => {
    const t = setupTest();
    const { customer, worker, bookingId } = await safetyJob(t);
    await customer.as.mutation(api.bookings.setSafetyMode, { enabled: true });

    const seen = must(
      await worker.as.query(api.bookings.getBooking, { id: bookingId }),
      "booking",
    );
    expect(seen.address).not.toContain("Ring Road");
  });

  it("always shows the address to the customer who owns the booking", async () => {
    const t = setupTest();
    const { customer, bookingId } = await safetyJob(t);
    await customer.as.mutation(api.bookings.setSafetyMode, { enabled: true });
    const seen = must(
      await customer.as.query(api.bookings.getBooking, { id: bookingId }),
      "booking",
    );
    expect(seen.address).toBe("12 Ring Road, Flat 4B");
  });

  it("reveals the address once the worker is enroute", async () => {
    const t = setupTest();
    const { customer, worker, bookingId } = await safetyJob(t);
    await customer.as.mutation(api.bookings.setSafetyMode, { enabled: true });
    await worker.as.mutation(api.bookings.advance, { id: bookingId });
    expect(
      must(await t.run((ctx) => ctx.db.get(bookingId)), "booking").status,
    ).toBe("enroute");

    const seen = must(
      await worker.as.query(api.bookings.getBooking, { id: bookingId }),
      "booking",
    );
    expect(seen.address).toBe("12 Ring Road, Flat 4B");
  });

  it("never redacts for a customer who has not asked for it", async () => {
    const t = setupTest();
    const { worker, bookingId } = await safetyJob(t);
    const seen = must(
      await worker.as.query(api.bookings.getBooking, { id: bookingId }),
      "booking",
    );
    expect(seen.address).toBe("12 Ring Road, Flat 4B");
  });

  it("leaves an unrelated stranger with nothing at all", async () => {
    const t = setupTest();
    const { bookingId } = await safetyJob(t);
    const nosy = await seedCustomer(t, { email: "nosy@example.com" });
    expect(
      await nosy.as.query(api.bookings.getBooking, { id: bookingId }),
    ).toBeNull();
  });
});
