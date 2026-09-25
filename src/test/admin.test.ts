import { describe, expect, it } from "vitest";
import {
  api,
  must,
  seedAdmin,
  seedArtisan,
  seedBooking,
  seedCustomer,
  seedOwner,
  seedUser,
  seedWorker,
  setupTest,
} from "./convexHarness";

const PASSCODE = "SAHAKAR-BOARD-2026";

describe("admin:amAdmin", () => {
  it("is false when signed out", async () => {
    const t = setupTest();
    expect(await t.query(api.admin.amAdmin)).toBe(false);
  });

  it("is true for role=admin, the owner email and the demo officer email", async () => {
    const t = setupTest();
    expect(await (await seedAdmin(t)).as.query(api.admin.amAdmin)).toBe(true);
    expect(await (await seedOwner(t)).as.query(api.admin.amAdmin)).toBe(true);
    const demo = await seedUser(t, { email: "demo.admin@sahakar.demo" });
    expect(await t.withIdentity({ subject: demo }).query(api.admin.amAdmin)).toBe(true);
  });

  it("is false for an ordinary member", async () => {
    const t = setupTest();
    const c = await seedCustomer(t);
    expect(await c.as.query(api.admin.amAdmin)).toBe(false);
  });
});

describe("admin-gated queries", () => {
  const gated = [
    "auditLog",
    "earningsLedger",
    "overview",
    "workerDirectory",
    "removedWorkers",
    "memberList",
    "verificationQueue",
  ] as const;

  it("rejects a signed-out caller", async () => {
    const t = setupTest();
    for (const name of gated) {
      await expect(t.query(api.admin[name])).rejects.toThrow("Not authenticated");
    }
  });

  it("rejects a plain member with Forbidden", async () => {
    const t = setupTest();
    const c = await seedCustomer(t);
    for (const name of gated) {
      await expect(c.as.query(api.admin[name])).rejects.toThrow("Forbidden");
    }
  });
});

describe("admin:emergencyUnlock", () => {
  it("refuses a signed-out caller", async () => {
    const t = setupTest();
    await expect(t.mutation(api.admin.emergencyUnlock, { passcode: PASSCODE })).rejects.toThrow(
      "Not authenticated",
    );
  });

  it("grants admin to a signed-in member with the correct passcode and audits it", async () => {
    const t = setupTest();
    const u = await seedCustomer(t, { email: "officer@x.com" });
    expect(await u.as.mutation(api.admin.emergencyUnlock, { passcode: PASSCODE })).toEqual({
      ok: true,
    });
    expect(must(await t.run((ctx) => ctx.db.get(u.id)), "user").role).toBe("admin");
    expect(await u.as.query(api.admin.amAdmin)).toBe(true);

    const log = await u.as.query(api.admin.auditLog);
    const granted = log.filter((r) => r.kind === "clearance_granted");
    expect(granted).toHaveLength(1);
    expect(granted[0].ok).toBe(true);
    expect(granted[0].actor).toBe("officer@x.com");
  });

  it("converts a guest session into the shared demo officer account", async () => {
    const t = setupTest();
    const guest = await seedUser(t, { name: "Guest", isAnonymous: true });
    const as = t.withIdentity({ subject: guest });
    expect(await as.query(api.admin.amAdmin)).toBe(false);

    await as.mutation(api.admin.emergencyUnlock, { passcode: PASSCODE });
    const row = must(await t.run((ctx) => ctx.db.get(guest)), "user");
    expect(row.isAnonymous).toBe(false);
    expect(row.email).toBe("demo.admin@sahakar.demo");
    expect(row.role).toBe("admin");
    expect(await as.query(api.admin.amAdmin)).toBe(true);
  });

  it("counts down the remaining attempts on a wrong passcode", async () => {
    const t = setupTest();
    const u = await seedCustomer(t, { email: "u@x.com" });
    expect(await u.as.mutation(api.admin.emergencyUnlock, { passcode: "nope" })).toEqual({
      ok: false,
      message: expect.stringContaining("4 attempts remaining"),
    });
    expect(await u.as.mutation(api.admin.emergencyUnlock, { passcode: "nope" })).toEqual({
      ok: false,
      message: expect.stringContaining("3 attempts remaining"),
    });
    expect(must(await t.run((ctx) => ctx.db.get(u.id)), "user").role).not.toBe("admin");
  });

  it("persists every denied attempt in the audit ledger", async () => {
    const t = setupTest();
    const u = await seedCustomer(t, { email: "u@x.com" });
    await u.as.mutation(api.admin.emergencyUnlock, { passcode: "nope" });
    await u.as.mutation(api.admin.emergencyUnlock, { passcode: "nope" });

    // Only a cleared officer can read the ledger back.
    const officer = await seedAdmin(t);
    const log = await officer.as.query(api.admin.auditLog);
    expect(log.filter((r) => r.kind === "clearance_denied")).toHaveLength(2);
  });

  it("locks out for 10 minutes after 5 wrong passcodes", async () => {
    const t = setupTest();
    const u = await seedCustomer(t, { email: "u@x.com" });
    for (let i = 0; i < 4; i++) {
      expect((await u.as.mutation(api.admin.emergencyUnlock, { passcode: "nope" })).ok).toBe(
        false,
      );
    }
    const fifth = await u.as.mutation(api.admin.emergencyUnlock, { passcode: "nope" });
    expect(fifth.ok).toBe(false);
    if (!fifth.ok) expect(fifth.message).toContain("locked for 10 minutes");

    // Even the correct passcode is refused while the lockout is active.
    const locked = await u.as.mutation(api.admin.emergencyUnlock, { passcode: PASSCODE });
    expect(locked.ok).toBe(false);
    if (!locked.ok) expect(locked.message).toContain("locked for");
    expect(must(await t.run((ctx) => ctx.db.get(u.id)), "user").role).not.toBe("admin");

    const officer = await seedAdmin(t);
    const log = await officer.as.query(api.admin.auditLog);
    expect(log.filter((r) => r.kind === "clearance_denied").length).toBeGreaterThanOrEqual(5);
  });

  it("resets the failure counter after a successful unlock", async () => {
    const t = setupTest();
    const u = await seedCustomer(t, { email: "u@x.com" });
    await u.as.mutation(api.admin.emergencyUnlock, { passcode: "nope" });
    await u.as.mutation(api.admin.emergencyUnlock, { passcode: PASSCODE });
    const lock = must(await t.run((ctx) => ctx.db.query("adminLockout").first()), "lockout row");
    expect(lock.fails).toBe(0);
    expect(lock.lockedUntil).toBeUndefined();
  });
});

describe("admin:auditLog", () => {
  it("resolves the actor name and marks unattributed rows as anonymous", async () => {
    const t = setupTest();
    const u = await seedCustomer(t, { email: "u@x.com" });
    await t.run((ctx) =>
      ctx.db.insert("adminAuditLog", { kind: "legacy", ok: true, at: Date.now() }),
    );
    await u.as.mutation(api.admin.emergencyUnlock, { passcode: "nope" });

    const officer = await seedAdmin(t);
    const log = await officer.as.query(api.admin.auditLog);
    const legacy = log.filter((r) => r.kind === "legacy");
    const denied = log.filter((r) => r.kind === "clearance_denied");
    expect(legacy[0].actor).toBe("anonymous");
    expect(denied[0].actor).toBe("u@x.com");
  });
});

describe("admin:overview", () => {
  it("aggregates pipeline, workers and the three-way revenue pool", async () => {
    const t = setupTest();
    const a = await seedAdmin(t);
    const w = await seedWorker(t);
    const artisan = await seedArtisan(t, w.id, {
      trade: "electrician",
      isOnline: true,
      kycStatus: "verified",
      quizPassed: true,
    });
    await seedBooking(t, (await seedCustomer(t)).id, {
      status: "settled",
      workerId: artisan,
      base: 1000,
      workerShare: 900,
      welfareAmt: 70,
      opsAmt: 30,
    });
    await seedBooking(t, (await seedCustomer(t)).id, { status: "pending" });
    // Removed workers are excluded from every headcount.
    await seedArtisan(t, (await seedWorker(t)).id, { removedAt: Date.now() });

    const o = await a.as.query(api.admin.overview);
    expect(o.bookings).toBe(2);
    expect(o.byStatus).toEqual({ settled: 1, pending: 1 });
    expect(o.revenueSettled).toBe(1000);
    expect(o.welfarePool).toBe(70);
    expect(o.workerPayouts).toBe(900);
    expect(o.opsPool).toBe(30);
    expect(o.workers).toBe(1);
    expect(o.online).toBe(1);
    expect(o.verified).toBe(1);
    expect(o.credentials).toBe(1);
    expect(o.byTrade).toEqual({ electrician: 1 });
    expect(o.workerPayouts + o.welfarePool + o.opsPool).toBe(o.revenueSettled);
  });

  it("reconciles the split for legacy rows with missing fields", async () => {
    const t = setupTest();
    const a = await seedAdmin(t);
    const w = await seedWorker(t);
    const artisan = await seedArtisan(t, w.id);
    await seedBooking(t, (await seedCustomer(t)).id, {
      status: "completed",
      workerId: artisan,
      base: 333,
      workerShare: undefined,
      welfareAmt: undefined,
      opsAmt: undefined,
    });

    const o = await a.as.query(api.admin.overview);
    expect(o.workerPayouts).toBe(Math.round(333 * 0.9));
    expect(o.welfarePool).toBe(0);
    expect(o.workerPayouts + o.welfarePool + o.opsPool).toBe(o.revenueSettled);
  });
});

describe("admin:earningsLedger", () => {
  it("ranks settled work by worker payout and totals welfare", async () => {
    const t = setupTest();
    const a = await seedAdmin(t);
    const w1 = await seedWorker(t);
    const a1 = await seedArtisan(t, w1.id, { fullName: "Ramesh", trade: "electrician" });
    const w2 = await seedWorker(t);
    const a2 = await seedArtisan(t, w2.id, { fullName: "Suresh", trade: "plumber" });

    await seedBooking(t, (await seedCustomer(t)).id, {
      status: "settled",
      workerId: a1,
      workerShare: 900,
      welfareAmt: 70,
    });
    await seedBooking(t, (await seedCustomer(t)).id, {
      status: "completed",
      workerId: a1,
      workerShare: 450,
      welfareAmt: 35,
    });
    await seedBooking(t, (await seedCustomer(t)).id, {
      status: "settled",
      workerId: a2,
      workerShare: 400,
      welfareAmt: 30,
    });
    await seedBooking(t, (await seedCustomer(t)).id, { status: "pending", workerId: a2 });

    const ledger = await a.as.query(api.admin.earningsLedger);
    expect(ledger.map((r) => r.name)).toEqual(["Ramesh", "Suresh"]);
    expect(ledger[0]).toMatchObject({ jobs: 2, earnings: 1350, welfare: 105 });
    expect(ledger[1]).toMatchObject({ jobs: 1, earnings: 400, welfare: 30 });
  });

  it("returns an empty ledger when nothing has settled", async () => {
    const t = setupTest();
    const a = await seedAdmin(t);
    expect(await a.as.query(api.admin.earningsLedger)).toEqual([]);
  });
});

describe("admin:memberList", () => {
  it("labels every account and links it to its worker profile", async () => {
    const t = setupTest();
    const a = await seedAdmin(t);
    const guest = await seedUser(t, { name: "Guest", isAnonymous: true });
    const customer = await seedCustomer(t, { email: "c@x.com", name: "C" });
    const w = await seedWorker(t, { email: "w@x.com", name: "W" });
    await seedArtisan(t, w.id, { trade: "mason", district: "Kurnool", kycStatus: "verified" });

    const members = await a.as.query(api.admin.memberList);
    const byId = new Map(members.map((m) => [m._id, m]));

    expect(must(byId.get(guest), "guest row").isAnonymous).toBe(true);
    expect(must(byId.get(customer.id), "customer row").workerId).toBeUndefined();
    const workerRow = must(byId.get(w.id), "worker row");
    expect(workerRow.workerId).toBeDefined();
    expect(workerRow.workerTrade).toBe("mason");
    expect(workerRow.workerDistrict).toBe("Kurnool");
    expect(workerRow.kycStatus).toBe("verified");
  });
});

describe("admin:workerDirectory / removedWorkers", () => {
  it("splits active and removed workers", async () => {
    const t = setupTest();
    const a = await seedAdmin(t);
    const w1 = await seedWorker(t);
    const w2 = await seedWorker(t);
    await seedArtisan(t, w1.id, { fullName: "Active", removedAt: undefined });
    await seedArtisan(t, w2.id, { fullName: "Removed", removedAt: Date.now() });

    const dir = await a.as.query(api.admin.workerDirectory);
    expect(dir).toHaveLength(2);
    const removed = await a.as.query(api.admin.removedWorkers);
    expect(removed.map((r) => r.fullName)).toEqual(["Removed"]);
  });
});

describe("admin:verificationQueue", () => {
  it("lists only pending-KYC workers", async () => {
    const t = setupTest();
    const a = await seedAdmin(t);
    const w1 = await seedWorker(t);
    const w2 = await seedWorker(t);
    await seedArtisan(t, w1.id, { fullName: "Pending", kycStatus: "pending" });
    await seedArtisan(t, w2.id, { fullName: "Done", kycStatus: "verified" });

    const q = await a.as.query(api.admin.verificationQueue);
    expect(q.map((x) => x.fullName)).toEqual(["Pending"]);
  });
});

describe("admin:reviewKyc", () => {
  it("refuses a non-officer", async () => {
    const t = setupTest();
    const c = await seedCustomer(t);
    const w = await seedWorker(t);
    const artisan = await seedArtisan(t, w.id, { kycStatus: "pending" });
    await expect(
      c.as.mutation(api.admin.reviewKyc, { artisanId: artisan, approve: true }),
    ).rejects.toThrow("Forbidden");
  });

  it("refuses an already-reviewed worker", async () => {
    const t = setupTest();
    const a = await seedAdmin(t);
    const w = await seedWorker(t);
    const artisan = await seedArtisan(t, w.id, { kycStatus: "verified" });
    await expect(
      a.as.mutation(api.admin.reviewKyc, { artisanId: artisan, approve: true }),
    ).rejects.toThrow("not pending review");
  });

  it("refuses to review a worker removed from the federation", async () => {
    const t = setupTest();
    const a = await seedAdmin(t);
    const w = await seedWorker(t);
    const artisan = await seedArtisan(t, w.id, { kycStatus: "pending", removedAt: Date.now() });
    await expect(
      a.as.mutation(api.admin.reviewKyc, { artisanId: artisan, approve: true }),
    ).rejects.toThrow("removed from the federation");
  });

  it("approves, issues a background-check reference and audits the action", async () => {
    const t = setupTest();
    const a = await seedAdmin(t);
    const w = await seedWorker(t);
    const artisan = await seedArtisan(t, w.id, { kycStatus: "pending" });

    await a.as.mutation(api.admin.reviewKyc, { artisanId: artisan, approve: true });
    const row = must(await t.run((ctx) => ctx.db.get(artisan)), "artisan");
    expect(row.kycStatus).toBe("verified");
    expect(row.kycVerifiedAt).toBeGreaterThan(0);
    expect(row.kycRef).toMatch(/^BGC-/);

    const log = await a.as.query(api.admin.auditLog);
    expect(log.filter((r) => r.kind === "kyc_review")).toHaveLength(1);
  });

  it("persists the officer's rejection reason so the worker can read it", async () => {
    const t = setupTest();
    const a = await seedAdmin(t);
    const w = await seedWorker(t);
    const artisan = await seedArtisan(t, w.id, { kycStatus: "pending" });

    await a.as.mutation(api.admin.reviewKyc, {
      artisanId: artisan,
      approve: false,
      note: "Blurred document photo",
    });
    const row = must(
      await t.run((ctx) => ctx.db.get(artisan)),
      "artisan",
    ) as { kycStatus: string; reviewNote?: string };
    expect(row.kycStatus).toBe("rejected");
    expect(row.reviewNote).toBe("Blurred document photo");
  });
});

describe("admin:adminCancelBooking", () => {
  it("refuses a non-officer and a closed booking", async () => {
    const t = setupTest();
    const a = await seedAdmin(t);
    const c = await seedCustomer(t);
    const open = await seedBooking(t, c.id, { status: "accepted" });
    const closed = await seedBooking(t, c.id, { status: "settled" });

    await expect(
      c.as.mutation(api.admin.adminCancelBooking, { id: open }),
    ).rejects.toThrow("Forbidden");
    await expect(a.as.mutation(api.admin.adminCancelBooking, { id: closed })).rejects.toThrow(
      "already closed",
    );
  });

  it("cancels an active booking and records the override", async () => {
    const t = setupTest();
    const a = await seedAdmin(t);
    const c = await seedCustomer(t);
    const b = await seedBooking(t, c.id, { status: "inprogress" });

    await a.as.mutation(api.admin.adminCancelBooking, { id: b });
    const row = must(await t.run((ctx) => ctx.db.get(b)), "booking");
    expect(row.status).toBe("cancelled");
    expect(row.cancelBy).toBe("admin");

    const log = await a.as.query(api.admin.auditLog);
    expect(log.filter((r) => r.kind === "admin_cancel")).toHaveLength(1);
  });
});
