import { describe, expect, it } from "vitest";
import { api, must, seedArtisan, seedBooking, seedCustomer, seedWorker, setupTest } from "./convexHarness";

/**
 * Rate limiting must be per-subject, never global: a shared counter lets one
 * caller exhaust the budget and lock out every legitimate member at once.
 */
describe("rate limiting", () => {
  it("throttles sign-in code requests per address", async () => {
    const t = setupTest();
    const email = "worker@sahakar.demo";
    for (let i = 0; i < 5; i++) {
      expect(await t.mutation(api.authThrottle.requestOtp, { email })).toEqual({ ok: true });
    }
    await expect(
      t.mutation(api.authThrottle.requestOtp, { email }),
    ).rejects.toThrow("Too many attempts");
  });

  it("keeps a second address unaffected when the first is throttled", async () => {
    const t = setupTest();
    for (let i = 0; i < 5; i++) {
      await t.mutation(api.authThrottle.requestOtp, { email: "noisy@sahakar.demo" });
    }
    await expect(
      t.mutation(api.authThrottle.requestOtp, { email: "noisy@sahakar.demo" }),
    ).rejects.toThrow("Too many attempts");

    // A different member must not be collateral damage.
    expect(
      await t.mutation(api.authThrottle.requestOtp, { email: "someone.else@sahakar.demo" }),
    ).toEqual({ ok: true });
  });

  it("normalises the address so casing and padding cannot buy extra budget", async () => {
    const t = setupTest();
    for (let i = 0; i < 5; i++) {
      await t.mutation(api.authThrottle.requestOtp, { email: "Case@Sahakar.Demo" });
    }
    await expect(
      t.mutation(api.authThrottle.requestOtp, { email: "  case@sahakar.demo  " }),
    ).rejects.toThrow("Too many attempts");
  });

  it("rejects an obviously invalid address without spending budget", async () => {
    const t = setupTest();
    await expect(t.mutation(api.authThrottle.requestOtp, { email: "nope" })).rejects.toThrow(
      "valid email",
    );
  });

  it("never stores the raw address in the rate-limit table", async () => {
    const t = setupTest();
    const email = "private.person@sahakar.demo";
    await t.mutation(api.authThrottle.requestOtp, { email });

    const rows = await t.run((ctx) => ctx.db.query("rateLimits").collect());
    expect(rows.length).toBeGreaterThan(0);
    // The limiter must not become a second, less-protected copy of the
    // member list — only a hash of the address is kept.
    for (const row of rows) {
      expect(row.key).not.toContain(email);
      expect(row.key).not.toContain("private.person");
    }
  });

  it("caps booking creation per customer", async () => {
    const t = setupTest();
    const c = await seedCustomer(t);
    const args = {
      serviceId: "ap-ac",
      address: "1 Test Street",
      scheduledFor: Date.now() + 3600_000,
      urgent: false,
      welfareOptIn: true,
    };
    for (let i = 0; i < 10; i++) {
      await c.as.mutation(api.bookings.create, args);
    }
    await expect(c.as.mutation(api.bookings.create, args)).rejects.toThrow(
      "Too many attempts",
    );
  });

  it("keeps one customer's booking flood off the rest of the federation", async () => {
    const t = setupTest();
    const noisy = await seedCustomer(t);
    const args = {
      serviceId: "ap-ac",
      address: "1 Test Street",
      scheduledFor: Date.now() + 3600_000,
      urgent: false,
      welfareOptIn: true,
    };
    for (let i = 0; i < 10; i++) {
      await noisy.as.mutation(api.bookings.create, args);
    }
    await expect(noisy.as.mutation(api.bookings.create, args)).rejects.toThrow(
      "Too many attempts",
    );

    const calm = await seedCustomer(t);
    expect(await calm.as.mutation(api.bookings.create, args)).toBeTruthy();
  });

  it("caps chat messages per sender", async () => {
    const t = setupTest();
    const c = await seedCustomer(t);
    const w = await seedWorker(t);
    await seedArtisan(t, w.id, { quizPassed: true, kycStatus: "verified" });
    const b = await seedBooking(t, c.id, { trade: "electrician", status: "pending" });
    await w.as.mutation(api.bookings.accept, { id: b });

    for (let i = 0; i < 40; i++) {
      await c.as.mutation(api.bookings.sendMessage, { bookingId: b, body: `hi ${i}` });
    }
    await expect(
      c.as.mutation(api.bookings.sendMessage, { bookingId: b, body: "one too many" }),
    ).rejects.toThrow("Too many attempts");
  });

  it("does not let a stranger drain a message budget they do not own", async () => {
    const t = setupTest();
    const c = await seedCustomer(t);
    const w = await seedWorker(t);
    await seedArtisan(t, w.id, { quizPassed: true, kycStatus: "verified" });
    const b = await seedBooking(t, c.id, { trade: "electrician", status: "pending" });
    await w.as.mutation(api.bookings.accept, { id: b });

    // A third party is refused before any budget is charged, so probing ids
    // they do not own is free to the attacker and harmless to the owner.
    const stranger = await seedCustomer(t);
    await expect(
      stranger.as.mutation(api.bookings.sendMessage, { bookingId: b, body: "hello" }),
    ).rejects.toThrow("Not allowed");

    const row = must(await t.run((ctx) => ctx.db.get(b)), "booking");
    expect(row.customerId).toBe(c.id);
  });
});
