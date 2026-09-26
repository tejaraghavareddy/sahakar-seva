import { describe, expect, it } from "vitest";
import {
  api,
  must,
  seedArtisan,
  seedCustomer,
  seedOwner,
  seedWorker,
  setupTest,
} from "./convexHarness";

describe("users:currentUser", () => {
  it("returns null when signed out", async () => {
    const t = setupTest();
    expect(await t.query(api.users.currentUser)).toBe(null);
  });

  it("returns the signed-in account", async () => {
    const t = setupTest();
    const { as } = await seedCustomer(t, { name: "Asha" });
    expect(must(await as.query(api.users.currentUser), "user").name).toBe("Asha");
  });
});

describe("artisans:getMyArtisan", () => {
  it("returns null for a signed-out visitor", async () => {
    const t = setupTest();
    expect(await t.query(api.artisans.getMyArtisan)).toBe(null);
  });

  it("returns null for a signed-in member with no worker profile", async () => {
    const t = setupTest();
    const { as } = await seedCustomer(t);
    expect(await as.query(api.artisans.getMyArtisan)).toBe(null);
  });

  it("returns the caller's own profile", async () => {
    const t = setupTest();
    const { id, as } = await seedWorker(t);
    await seedArtisan(t, id, { fullName: "Ramesh" });
    expect(must(await as.query(api.artisans.getMyArtisan), "artisan").fullName).toBe("Ramesh");
  });
});

describe("artisans:listArtisans", () => {
  it("hides removed workers from the public directory", async () => {
    const t = setupTest();
    const a = await seedWorker(t);
    const b = await seedWorker(t);
    await seedArtisan(t, a.id, { fullName: "Active" });
    await seedArtisan(t, b.id, { fullName: "Gone", removedAt: Date.now() });

    const list = await t.query(api.artisans.listArtisans);
    expect(list).toHaveLength(1);
  });

  it("is readable with no session at all", async () => {
    const t = setupTest();
    expect(await t.query(api.artisans.listArtisans)).toEqual([]);
  });

  it("never leaks worker PII to an unauthenticated caller", async () => {
    const t = setupTest();
    const w = await seedWorker(t);
    await seedArtisan(t, w.id, {
      fullName: "Asha",
      phone: "9876543210",
      upiVpa: "asha@upi",
      idType: "aadhaar",
      idLast4: "4321",
      welfareBalance: 700,
      lat: 15.83,
      lng: 78.03,
    });

    const list = await t.query(api.artisans.listArtisans);
    // Only what the availability maths reads may cross the public boundary.
    expect(Object.keys(list[0]).sort()).toEqual(["kycStatus", "lat", "lng", "trade"]);

    const serialized = JSON.stringify(list);
    for (const secret of ["9876543210", "asha@upi", "4321", "Asha", "700"]) {
      expect(serialized).not.toContain(secret);
    }
  });
});

describe("artisans:federationStats", () => {
  it("returns zeroed stats on an empty federation", async () => {
    const t = setupTest();
    expect(await t.query(api.artisans.federationStats)).toEqual({
      total: 0,
      online: 0,
      verified: 0,
      byTrade: {},
    });
  });

  it("counts online + verified workers per trade and ignores removed ones", async () => {
    const t = setupTest();
    const w1 = await seedWorker(t);
    const w2 = await seedWorker(t);
    const w3 = await seedWorker(t);
    await seedArtisan(t, w1.id, {
      trade: "plumber",
      isOnline: true,
      kycStatus: "verified",
    });
    await seedArtisan(t, w2.id, { trade: "plumber", isOnline: false, kycStatus: "pending" });
    await seedArtisan(t, w3.id, {
      trade: "mason",
      isOnline: true,
      kycStatus: "verified",
      removedAt: 1,
    });

    const s = await t.query(api.artisans.federationStats);
    expect(s.total).toBe(2);
    expect(s.online).toBe(1);
    expect(s.verified).toBe(1);
    expect(s.byTrade).toEqual({ plumber: 2 });
  });
});

describe("artisans:saveProfile", () => {
  const base = {
    fullName: "Ramesh Kumar",
    phone: "9000000000",
    trade: "electrician",
    district: "Kurnool",
    state: "Andhra Pradesh",
    societyId: "self",
    experienceYears: 6,
    dailyRate: 900,
    idType: "aadhaar",
    idNumber: "1234",
  };

  it("refuses a signed-out caller", async () => {
    const t = setupTest();
    await expect(t.mutation(api.artisans.saveProfile, base)).rejects.toThrow("Not authenticated");
  });

  it("rejects an ID number with fewer than 4 digits", async () => {
    const t = setupTest();
    const { as } = await seedWorker(t);
    await expect(
      as.mutation(api.artisans.saveProfile, { ...base, idNumber: "12" }),
    ).rejects.toThrow("valid ID number");
  });

  it("stores only the last 4 digits of the ID and starts KYC pending", async () => {
    const t = setupTest();
    const { id, as } = await seedWorker(t);
    const artisanId = await as.mutation(api.artisans.saveProfile, {
      ...base,
      idNumber: "ABCD 5678 9012",
      upiVpa: " ramesh@upi ",
    });
    const row = must(await t.run((ctx) => ctx.db.get(artisanId)), "artisan");
    expect(row.idLast4).toBe("9012");
    expect(row.kycStatus).toBe("pending");
    expect(row.quizPassed).toBe(false);
    expect(row.isOnline).toBe(false);
    expect(row.upiVpa).toBe("ramesh@upi");
    expect(row.userId).toBe(id);
    expect(row.welfareBalance).toBe(0);
  });

  it("updates the existing profile instead of creating a duplicate", async () => {
    const t = setupTest();
    const { as } = await seedWorker(t);
    const first = await as.mutation(api.artisans.saveProfile, base);
    const second = await as.mutation(api.artisans.saveProfile, {
      ...base,
      fullName: "Ramesh K.",
      dailyRate: 1200,
    });
    expect(second).toBe(first);
    const rows = await t.run((ctx) => ctx.db.query("artisans").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0].dailyRate).toBe(1200);
    expect(rows[0].fullName).toBe("Ramesh K.");
  });

  it("keeps an already-issued credential when the profile is edited", async () => {
    const t = setupTest();
    const { as } = await seedWorker(t);
    const artisanId = await as.mutation(api.artisans.saveProfile, base);
    await t.run((ctx) =>
      ctx.db.patch(artisanId, { quizPassed: true, credentialId: "SSC-2026-AB12" }),
    );

    await as.mutation(api.artisans.saveProfile, { ...base, dailyRate: 1500 });
    const row = must(await t.run((ctx) => ctx.db.get(artisanId)), "artisan");
    expect(row.credentialId).toBe("SSC-2026-AB12");
    expect(row.quizPassed).toBe(true);
  });

  it("promotes the federation owner email to admin", async () => {
    const t = setupTest();
    const { id, as } = await seedOwner(t);
    await as.mutation(api.artisans.saveProfile, base);
    expect(must(await t.run((ctx) => ctx.db.get(id)), "user").role).toBe("admin");
  });
});

describe("artisans:submitQuiz", () => {
  it("refuses a signed-out caller", async () => {
    const t = setupTest();
    await expect(t.mutation(api.artisans.submitQuiz, { score: 90 })).rejects.toThrow(
      "Not authenticated",
    );
  });

  it("asks the worker to finish onboarding first", async () => {
    const t = setupTest();
    const { as } = await seedWorker(t);
    await expect(as.mutation(api.artisans.submitQuiz, { score: 90 })).rejects.toThrow(
      "Complete your trade profile first",
    );
  });

  it("returns a below-pass result as data instead of throwing", async () => {
    const t = setupTest();
    const { id, as } = await seedWorker(t);
    await seedArtisan(t, id, { quizPassed: false });

    const res = await as.mutation(api.artisans.submitQuiz, { score: 42 });
    expect(res).toEqual({
      ok: false,
      score: 42,
      passMark: 60,
      message: expect.stringContaining("below the 60% pass mark"),
    });

    const row = must(
      await t.run((ctx) =>
        ctx.db.query("artisans").withIndex("by_userId", (q) => q.eq("userId", id)).first(),
      ),
      "artisan",
    );
    expect(row.quizScore).toBe(42);
    expect(row.quizPassed).toBe(false);
    expect(row.credentialId).toBeUndefined();
  });

  it("issues a credential on a passing score", async () => {
    const t = setupTest();
    const { id, as } = await seedWorker(t);
    await seedArtisan(t, id, { quizPassed: false });

    const res = await as.mutation(api.artisans.submitQuiz, { score: 80 });
    expect(res.ok).toBe(true);
    if (res.ok && "credentialId" in res) {
      expect(res.credentialId).toMatch(/^SSC-\d{4}-[0-9A-F]{4}$/);
    }

    const row = must(
      await t.run((ctx) =>
        ctx.db.query("artisans").withIndex("by_userId", (q) => q.eq("userId", id)).first(),
      ),
      "artisan",
    );
    expect(row.quizPassed).toBe(true);
    expect(row.credentialId).toBeDefined();
  });

  it("is idempotent on re-submit after a credential was issued", async () => {
    const t = setupTest();
    const { id, as } = await seedWorker(t);
    await seedArtisan(t, id, { quizPassed: false });

    const first = await as.mutation(api.artisans.submitQuiz, { score: 80 });
    const second = await as.mutation(api.artisans.submitQuiz, { score: 10 });
    expect(second).toEqual({ ok: true, alreadyIssued: true, credentialId: first.credentialId });
  });
});

describe("artisans:setPresence", () => {
  it("refuses a signed-out caller", async () => {
    const t = setupTest();
    await expect(t.mutation(api.artisans.setPresence, { isOnline: true })).rejects.toThrow(
      "Not authenticated",
    );
  });

  it("asks for onboarding first when no profile exists", async () => {
    const t = setupTest();
    const { as } = await seedWorker(t);
    await expect(as.mutation(api.artisans.setPresence, { isOnline: true })).rejects.toThrow(
      "Complete onboarding first",
    );
  });

  it("flips presence, records telemetry, and keeps the last known position", async () => {
    const t = setupTest();
    const { id, as } = await seedWorker(t);
    await seedArtisan(t, id, { isOnline: false, lat: undefined, lng: undefined });

    await as.mutation(api.artisans.setPresence, { isOnline: true, lat: 17.38, lng: 78.48 });
    const row = must(
      await t.run((ctx) =>
        ctx.db.query("artisans").withIndex("by_userId", (q) => q.eq("userId", id)).first(),
      ),
      "artisan",
    );
    expect(row.isOnline).toBe(true);
    expect(row.lat).toBe(17.38);
    expect(row.lng).toBe(78.48);
    expect(row.telemetryAt).toBeGreaterThan(0);

    // Going offline without coordinates must not wipe the last GPS fix.
    await as.mutation(api.artisans.setPresence, { isOnline: false });
    const row2 = must(
      await t.run((ctx) =>
        ctx.db.query("artisans").withIndex("by_userId", (q) => q.eq("userId", id)).first(),
      ),
      "artisan",
    );
    expect(row2.isOnline).toBe(false);
    expect(row2.lat).toBe(17.38);
  });
});
