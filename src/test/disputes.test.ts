import { describe, expect, it } from "vitest";
import {
  api,
  must,
  seedAdmin,
  seedArtisan,
  seedBooking,
  seedCustomer,
  seedWorker,
  setupTest,
} from "./convexHarness";

describe("disputes:raise", () => {
  it("refuses a signed-out caller", async () => {
    const t = setupTest();
    const c = await seedCustomer(t);
    const b = await seedBooking(t, c.id);
    await expect(
      t.mutation(api.disputes.raise, { bookingId: b, category: "late", details: "x" }),
    ).rejects.toThrow("Not authenticated");
  });

  it("refuses a member with no relationship to the booking", async () => {
    const t = setupTest();
    const c = await seedCustomer(t);
    const stranger = await seedCustomer(t, { email: "s@x.com" });
    const b = await seedBooking(t, c.id);
    await expect(
      stranger.as.mutation(api.disputes.raise, {
        bookingId: b,
        category: "late",
        details: "x",
      }),
    ).rejects.toThrow("Only the customer or assigned worker");
  });

  it("refuses an empty description", async () => {
    const t = setupTest();
    const c = await seedCustomer(t);
    const b = await seedBooking(t, c.id);
    await expect(
      c.as.mutation(api.disputes.raise, { bookingId: b, category: "late", details: "   " }),
    ).rejects.toThrow("Please describe the issue");
  });

  it("records the customer flag with its category", async () => {
    const t = setupTest();
    const c = await seedCustomer(t);
    const b = await seedBooking(t, c.id);
    const id = await c.as.mutation(api.disputes.raise, {
      bookingId: b,
      category: "quality",
      details: "  the fan still rattles  ",
    });
    const row = must(await t.run((ctx) => ctx.db.get(id)), "dispute");
    expect(row.bookingId).toBe(b);
    expect(row.raisedBy).toBe(c.id);
    expect(row.raisedByRole).toBe("customer");
    expect(row.category).toBe("quality");
    expect(row.details).toBe("the fan still rattles");
    expect(row.status).toBe("open");
  });

  it("records the assigned worker's flag as a worker flag", async () => {
    const t = setupTest();
    const c = await seedCustomer(t);
    const w = await seedWorker(t);
    const artisan = await seedArtisan(t, w.id);
    const b = await seedBooking(t, c.id, { workerId: artisan, workerUserId: w.id });

    const id = await w.as.mutation(api.disputes.raise, {
      bookingId: b,
      category: "payment",
      details: "customer did not pay",
    });
    expect(must(await t.run((ctx) => ctx.db.get(id)), "dispute").raisedByRole).toBe("worker");
  });
});

describe("disputes:listForAdmin", () => {
  it("is admin-only", async () => {
    const t = setupTest();
    await expect(t.query(api.disputes.listForAdmin)).rejects.toThrow("Not authenticated");
    const c = await seedCustomer(t);
    await expect(c.as.query(api.disputes.listForAdmin)).rejects.toThrow("Forbidden");
  });

  it("returns the board's case list", async () => {
    const t = setupTest();
    const a = await seedAdmin(t);
    const c = await seedCustomer(t);
    const b = await seedBooking(t, c.id);
    await c.as.mutation(api.disputes.raise, { bookingId: b, category: "late", details: "x" });
    expect(await a.as.query(api.disputes.listForAdmin)).toHaveLength(1);
  });
});

describe("disputes:myDisputeForBooking / myDisputes", () => {
  it("return null / [] with no session", async () => {
    const t = setupTest();
    const c = await seedCustomer(t);
    const b = await seedBooking(t, c.id);
    expect(await t.query(api.disputes.myDisputeForBooking, { bookingId: b })).toBeNull();
    expect(await t.query(api.disputes.myDisputes)).toEqual([]);
  });

  it("return only the caller's own flags", async () => {
    const t = setupTest();
    const c1 = await seedCustomer(t, { email: "a@x.com" });
    const c2 = await seedCustomer(t, { email: "b@x.com" });
    const b1 = await seedBooking(t, c1.id);
    const b2 = await seedBooking(t, c2.id);

    const d1 = await c1.as.mutation(api.disputes.raise, {
      bookingId: b1,
      category: "late",
      details: "mine",
    });

    expect(must(await c1.as.query(api.disputes.myDisputeForBooking, { bookingId: b1 }), "d")._id).toBe(
      d1,
    );
    expect(await c1.as.query(api.disputes.myDisputeForBooking, { bookingId: b2 })).toBeNull();
    expect(await c2.as.query(api.disputes.myDisputeForBooking, { bookingId: b1 })).toBeNull();
    expect((await c1.as.query(api.disputes.myDisputes)).map((d) => d._id)).toEqual([d1]);
    expect(await c2.as.query(api.disputes.myDisputes)).toEqual([]);
  });

  it("lets the raiser read the arbitration outcome", async () => {
    const t = setupTest();
    const a = await seedAdmin(t);
    const c = await seedCustomer(t);
    const b = await seedBooking(t, c.id);
    const d = await c.as.mutation(api.disputes.raise, {
      bookingId: b,
      category: "late",
      details: "x",
    });

    await a.as.mutation(api.disputes.resolve, {
      id: d,
      status: "resolved",
      resolution: "Refund issued",
    });

    const mine = must(
      await c.as.query(api.disputes.myDisputeForBooking, { bookingId: b }),
      "dispute",
    );
    expect(mine.status).toBe("resolved");
    expect(mine.resolution).toBe("Refund issued");
  });
});

describe("disputes:resolve", () => {
  it("is admin-only and refuses double arbitration", async () => {
    const t = setupTest();
    const a = await seedAdmin(t);
    const c = await seedCustomer(t);
    const b = await seedBooking(t, c.id);
    const d = await c.as.mutation(api.disputes.raise, {
      bookingId: b,
      category: "late",
      details: "x",
    });

    await expect(
      c.as.mutation(api.disputes.resolve, { id: d, status: "resolved" }),
    ).rejects.toThrow("Forbidden");
    await a.as.mutation(api.disputes.resolve, { id: d, status: "dismissed" });
    await expect(
      a.as.mutation(api.disputes.resolve, { id: d, status: "resolved" }),
    ).rejects.toThrow("already been arbitrated");
  });

  it("stamps the resolving officer and their note", async () => {
    const t = setupTest();
    const a = await seedAdmin(t);
    const c = await seedCustomer(t);
    const b = await seedBooking(t, c.id);
    const d = await c.as.mutation(api.disputes.raise, {
      bookingId: b,
      category: "late",
      details: "x",
    });

    await a.as.mutation(api.disputes.resolve, {
      id: d,
      status: "resolved",
      resolution: "  Party A refunded  ",
    });
    const row = must(await t.run((ctx) => ctx.db.get(d)), "dispute");
    expect(row.status).toBe("resolved");
    expect(row.resolution).toBe("Party A refunded");
    expect(row.resolvedBy).toBe(a.id);
    expect(row.resolvedAt).toBeGreaterThan(0);
  });

  it("blacklisting an abusive worker takes them off the radar", async () => {
    const t = setupTest();
    const a = await seedAdmin(t);
    const c = await seedCustomer(t);
    const w = await seedWorker(t);
    const artisan = await seedArtisan(t, w.id, { isOnline: true, kycStatus: "verified" });
    const b = await seedBooking(t, c.id, { workerId: artisan, workerUserId: w.id });
    const d = await w.as.mutation(api.disputes.raise, {
      bookingId: b,
      category: "behavior",
      details: "abusive",
    });

    await a.as.mutation(api.disputes.resolve, { id: d, status: "blacklisted" });
    const row = must(await t.run((ctx) => ctx.db.get(artisan)), "artisan");
    expect(row.isOnline).toBe(false);
    expect(row.kycStatus).toBe("rejected");
  });

  it("does not blacklist when the customer is the one blacklisted", async () => {
    const t = setupTest();
    const a = await seedAdmin(t);
    const c = await seedCustomer(t);
    const w = await seedWorker(t);
    const artisan = await seedArtisan(t, w.id, { isOnline: true, kycStatus: "verified" });
    const b = await seedBooking(t, c.id, { workerId: artisan, workerUserId: w.id });
    const d = await c.as.mutation(api.disputes.raise, {
      bookingId: b,
      category: "late",
      details: "x",
    });

    await a.as.mutation(api.disputes.resolve, { id: d, status: "blacklisted" });
    const row = must(await t.run((ctx) => ctx.db.get(artisan)), "artisan");
    expect(row.isOnline).toBe(true);
    expect(row.kycStatus).toBe("verified");
  });
});
