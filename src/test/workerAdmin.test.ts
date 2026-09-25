import { describe, expect, it } from "vitest";
import {
  api,
  must,
  seedAdmin,
  seedArtisan,
  seedBooking,
  seedCustomer,
  seedUser,
  seedWorker,
  setupTest,
} from "./convexHarness";

const workerArgs = {
  fullName: "Ramesh Kumar",
  phone: "9000000000",
  trade: "mason",
  district: "Kurnool",
  state: "Andhra Pradesh",
  experienceYears: 8,
  dailyRate: 900,
};

describe("workerAdmin:addWorker", () => {
  it("refuses a non-officer", async () => {
    const t = setupTest();
    const c = await seedCustomer(t);
    await expect(
      c.as.mutation(api.workerAdmin.addWorker, { userId: c.id, ...workerArgs }),
    ).rejects.toThrow("Forbidden");
  });

  it("refuses an unknown member", async () => {
    const t = setupTest();
    const a = await seedAdmin(t);
    const ghost = await seedUser(t, {});
    await t.run((ctx) => ctx.db.delete(ghost));
    await expect(
      a.as.mutation(api.workerAdmin.addWorker, { userId: ghost, ...workerArgs }),
    ).rejects.toThrow("Member account not found");
  });

  it("refuses to promote a guest session", async () => {
    const t = setupTest();
    const a = await seedAdmin(t);
    const guest = await seedUser(t, { isAnonymous: true });
    await expect(
      a.as.mutation(api.workerAdmin.addWorker, { userId: guest, ...workerArgs }),
    ).rejects.toThrow("Cannot add a guest session");
  });

  it("creates the profile with KYC pending and notifies the worker", async () => {
    const t = setupTest();
    const a = await seedAdmin(t);
    const member = await seedCustomer(t, { email: "new@x.com" });

    const res = await a.as.mutation(api.workerAdmin.addWorker, {
      userId: member.id,
      ...workerArgs,
    });
    expect(res.reactivated).toBe(false);

    const row = must(await t.run((ctx) => ctx.db.get(res.artisanId)), "artisan");
    expect(row.userId).toBe(member.id);
    expect(row.fullName).toBe("Ramesh Kumar");
    expect(row.kycStatus).toBe("pending");
    expect(row.quizPassed).toBe(false);
    expect(row.isOnline).toBe(false);

    const notices = await member.as.query(api.workerAdmin.myNotifications);
    expect(notices).toHaveLength(1);
    expect(notices[0].kind).toBe("worker_added");
    expect(notices[0].readAt).toBeUndefined();
    expect(await member.as.query(api.workerAdmin.unreadCount)).toBe(1);
  });

  it("refuses to register the same member twice", async () => {
    const t = setupTest();
    const a = await seedAdmin(t);
    const member = await seedCustomer(t, { email: "dup@x.com" });
    await a.as.mutation(api.workerAdmin.addWorker, { userId: member.id, ...workerArgs });
    await expect(
      a.as.mutation(api.workerAdmin.addWorker, { userId: member.id, ...workerArgs }),
    ).rejects.toThrow("already a registered worker");
  });

  it("reactivates a previously removed profile instead of duplicating it", async () => {
    const t = setupTest();
    const a = await seedAdmin(t);
    const member = await seedCustomer(t, { email: "back@x.com" });
    const first = await a.as.mutation(api.workerAdmin.addWorker, {
      userId: member.id,
      ...workerArgs,
    });
    await a.as.mutation(api.workerAdmin.removeWorker, { artisanId: first.artisanId });

    const again = await a.as.mutation(api.workerAdmin.addWorker, {
      userId: member.id,
      ...workerArgs,
    });
    expect(again.reactivated).toBe(true);
    expect(again.artisanId).toBe(first.artisanId);

    const row = must(await t.run((ctx) => ctx.db.get(first.artisanId)), "artisan");
    expect(row.removedAt).toBeUndefined();
    expect(row.removalNote).toBeUndefined();
    expect(row.kycStatus).toBe("pending");
  });
});

describe("workerAdmin:removeWorker", () => {
  it("refuses a non-officer and an unknown worker", async () => {
    const t = setupTest();
    const a = await seedAdmin(t);
    const c = await seedCustomer(t);
    const w = await seedWorker(t);
    const artisan = await seedArtisan(t, w.id);
    const ghost = await seedArtisan(t, (await seedWorker(t, { email: "g@x.com" })).id);
    await t.run((ctx) => ctx.db.delete(ghost));
    expect(c).toBeDefined();

    await expect(
      c.as.mutation(api.workerAdmin.removeWorker, { artisanId: artisan }),
    ).rejects.toThrow("Forbidden");
    await expect(
      a.as.mutation(api.workerAdmin.removeWorker, { artisanId: ghost }),
    ).rejects.toThrow("Worker not found");
  });

  it("soft-deletes, keeps history and notifies the worker", async () => {
    const t = setupTest();
    const a = await seedAdmin(t);
    const w = await seedWorker(t);
    const artisan = await seedArtisan(t, w.id, { trade: "mason" });
    const booking = await seedBooking(t, (await seedCustomer(t)).id, {
      status: "completed",
      workerId: artisan,
      workerUserId: w.id,
    });

    const res = await a.as.mutation(api.workerAdmin.removeWorker, {
      artisanId: artisan,
      note: "Repeated quality complaints",
    });
    expect(res.cancelled).toBe(0);

    const row = must(await t.run((ctx) => ctx.db.get(artisan)), "artisan");
    expect(row.removedAt).toBeGreaterThan(0);
    expect(row.removedBy).toBe(a.id);
    expect(row.removalNote).toBe("Repeated quality complaints");
    expect(row.isOnline).toBe(false);
    // History is preserved.
    expect(await t.run((ctx) => ctx.db.get(booking))).not.toBeNull();

    const notices = await w.as.query(api.workerAdmin.myNotifications);
    expect(notices[0].kind).toBe("worker_removed");
    expect(notices[0].body).toContain("Repeated quality complaints");
  });

  it("cancels only the worker's own in-flight jobs", async () => {
    const t = setupTest();
    const a = await seedAdmin(t);
    const w = await seedWorker(t);
    const artisan = await seedArtisan(t, w.id);
    const other = await seedWorker(t);
    const otherArtisan = await seedArtisan(t, other.id);
    const customer = await seedCustomer(t);

    const inFlight = await seedBooking(t, customer.id, {
      status: "inprogress",
      workerId: artisan,
      workerUserId: w.id,
    });
    const settled = await seedBooking(t, customer.id, {
      status: "settled",
      workerId: artisan,
      workerUserId: w.id,
    });
    const othersJob = await seedBooking(t, customer.id, {
      status: "inprogress",
      workerId: otherArtisan,
      workerUserId: other.id,
    });

    const res = await a.as.mutation(api.workerAdmin.removeWorker, { artisanId: artisan });
    expect(res.cancelled).toBe(1);

    expect(must(await t.run((ctx) => ctx.db.get(inFlight)), "booking").status).toBe("cancelled");
    expect(must(await t.run((ctx) => ctx.db.get(inFlight)), "booking").cancelBy).toBe("admin");
    expect(must(await t.run((ctx) => ctx.db.get(settled)), "booking").status).toBe("settled");
    expect(must(await t.run((ctx) => ctx.db.get(othersJob)), "booking").status).toBe(
      "inprogress",
    );
  });

  it("is not idempotent — removing twice is refused", async () => {
    const t = setupTest();
    const a = await seedAdmin(t);
    const w = await seedWorker(t);
    const artisan = await seedArtisan(t, w.id);
    await a.as.mutation(api.workerAdmin.removeWorker, { artisanId: artisan });
    await expect(
      a.as.mutation(api.workerAdmin.removeWorker, { artisanId: artisan }),
    ).rejects.toThrow("already removed");
  });

  it("keeps a removed worker off the dispatch radar", async () => {
    const t = setupTest();
    const a = await seedAdmin(t);
    const w = await seedWorker(t);
    await seedArtisan(t, w.id, { trade: "electrician" });
    await seedBooking(t, (await seedCustomer(t)).id, { trade: "electrician" });

    const artisan = must(
      await t.run((ctx) => ctx.db.query("artisans").first()),
      "artisan",
    );
    await a.as.mutation(api.workerAdmin.removeWorker, { artisanId: artisan._id });

    const stats = await t.query(api.artisans.federationStats);
    expect(stats.total).toBe(0);
    expect(await t.query(api.artisans.listArtisans)).toEqual([]);
  });
});

describe("workerAdmin notifications", () => {
  it("myNotifications refuses a signed-out caller", async () => {
    const t = setupTest();
    await expect(t.query(api.workerAdmin.myNotifications)).rejects.toThrow("Not authenticated");
    await expect(t.mutation(api.workerAdmin.markAllRead)).rejects.toThrow("Not authenticated");
  });

  it("unreadCount is 0 when signed out and after markAllRead", async () => {
    const t = setupTest();
    expect(await t.query(api.workerAdmin.unreadCount)).toBe(0);

    const a = await seedAdmin(t);
    const member = await seedCustomer(t, { email: "n@x.com" });
    await a.as.mutation(api.workerAdmin.addWorker, { userId: member.id, ...workerArgs });
    await a.as.mutation(api.workerAdmin.addWorker, {
      userId: (await seedCustomer(t, { email: "n2@x.com" })).id,
      ...workerArgs,
    });

    expect(await member.as.query(api.workerAdmin.unreadCount)).toBe(1);
    expect(await member.as.mutation(api.workerAdmin.markAllRead)).toEqual({ marked: 1 });
    expect(await member.as.query(api.workerAdmin.unreadCount)).toBe(0);
    // Marking again is a no-op.
    expect(await member.as.mutation(api.workerAdmin.markAllRead)).toEqual({ marked: 0 });
  });

  it("notifications are private to their recipient", async () => {
    const t = setupTest();
    const a = await seedAdmin(t);
    const m1 = await seedCustomer(t, { email: "one@x.com" });
    const m2 = await seedCustomer(t, { email: "two@x.com" });
    await a.as.mutation(api.workerAdmin.addWorker, { userId: m1.id, ...workerArgs });

    expect(await m1.as.query(api.workerAdmin.myNotifications)).toHaveLength(1);
    expect(await m2.as.query(api.workerAdmin.myNotifications)).toHaveLength(0);
    expect(await m2.as.query(api.workerAdmin.unreadCount)).toBe(0);
  });
});
