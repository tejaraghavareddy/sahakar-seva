/**
 * The super-admin tier and federation-admin scoping.
 *
 * The invariants that matter:
 *  1. only super admins reach the platform functions;
 *  2. appointing an admin binds that admin to ONE federation;
 *  3. the admin console shows a scoped admin only their own federation's
 *     workers — the isolation is the whole point of the tier;
 *  4. the demo super admin is a real super admin through the same checks.
 */
import { describe, expect, it } from "vitest";
import { internal } from "@/convex/_generated/api";
import { DEMO_SUPERADMIN_EMAILS } from "@/convex/identity";
import {
  setupTest,
  must,
  api,
  seedUser,
  seedCustomer,
  seedWorker,
  seedArtisan,
  seedAdmin,
  type Id,
} from "./convexHarness";

/** A super admin with two federations and one scoped admin each. */
async function platform(t: ReturnType<typeof setupTest>) {
  const superAdmin = await seedUser(t, {
    email: "platform@sahakar.test",
    name: "Platform",
    role: "superadmin",
  });

  const fedA = await t.run(async (ctx) =>
    ctx.db.insert("societies", {
      name: "Kurnool Electricians Society",
      district: "Kurnool",
      state: "Andhra Pradesh",
      code: "AP-KUR-01",
      registrationNo: "SSC/REG/2026/001",
      status: "active",
      registeredBy: superAdmin,
      createdAt: Date.now(),
    }),
  );
  const fedB = await t.run(async (ctx) =>
    ctx.db.insert("societies", {
      name: "Nandyal Masons Society",
      district: "Nandyal",
      state: "Andhra Pradesh",
      code: "AP-NAN-02",
      registrationNo: "SSC/REG/2026/002",
      status: "active",
      registeredBy: superAdmin,
      createdAt: Date.now(),
    }),
  );

  const adminA = await seedUser(t, { email: "a@example.com", name: "Admin A" });
  const adminB = await seedUser(t, { email: "b@example.com", name: "Admin B" });

  return { superAdmin, fedA, fedB, adminA, adminB };
}

async function appointBoth(t: ReturnType<typeof setupTest>, p: Awaited<ReturnType<typeof platform>>) {
  const as = t.withIdentity({ subject: p.superAdmin });
  await as.mutation(api.superAdmin.appointFederationAdmin, {
    email: "a@example.com",
    societyId: p.fedA,
  });
  await as.mutation(api.superAdmin.appointFederationAdmin, {
    email: "b@example.com",
    societyId: p.fedB,
  });
}

describe("superAdmin: platform gating", () => {
  it("closes every platform function to ordinary members and federation admins", async () => {
    const t = setupTest();
    const p = await platform(t);

    const member = await seedCustomer(t);
    await expect(member.as.query(api.superAdmin.platformOverview)).rejects.toThrow(
      "Forbidden",
    );
    await expect(member.as.query(api.superAdmin.listFederations)).rejects.toThrow(
      "Forbidden",
    );
    await expect(
      member.as.mutation(api.superAdmin.appointFederationAdmin, {
        email: "x@example.com",
        societyId: p.fedA,
      }),
    ).rejects.toThrow("Forbidden");

    // A federation admin (tier 1) is NOT a super admin either.
    const admin = await seedAdmin(t);
    await expect(admin.as.query(api.superAdmin.listFederations)).rejects.toThrow(
      "Forbidden",
    );
  });

  it("opens the platform functions to the super admin", async () => {
    const t = setupTest();
    const p = await platform(t);
    const as = t.withIdentity({ subject: p.superAdmin });
    const overview = await as.query(api.superAdmin.platformOverview);
    expect(overview.federations).toBe(2);
  });
});

describe("superAdmin: federation lifecycle", () => {
  it("charters a federation directly as active with a proper code", async () => {
    const t = setupTest();
    const p = await platform(t);
    const as = t.withIdentity({ subject: p.superAdmin });

    const { id, code } = await as.mutation(api.superAdmin.createFederation, {
      name: "Guntur Carpenters Federation",
      district: "Guntur",
      state: "Andhra Pradesh",
    });
    expect(code).toMatch(/^AP-GUN-\d{2}$/);
    const fed = must(await t.run((ctx) => ctx.db.get(id as Id<"societies">)), "fed");
    expect(fed.status).toBe("active");
  });

  it("suspends and reactivates a federation", async () => {
    const t = setupTest();
    const p = await platform(t);
    const as = t.withIdentity({ subject: p.superAdmin });

    await as.mutation(api.superAdmin.setFederationStatus, {
      id: p.fedA,
      status: "suspended",
    });
    expect((await t.run((ctx) => ctx.db.get(p.fedA)))?.status).toBe("suspended");

    await as.mutation(api.superAdmin.setFederationStatus, {
      id: p.fedA,
      status: "active",
    });
    expect((await t.run((ctx) => ctx.db.get(p.fedA)))?.status).toBe("active");
  });
});

describe("superAdmin: federation admin appointments", () => {
  it("appoints an existing member and binds them to one federation", async () => {
    const t = setupTest();
    const p = await platform(t);
    await appointBoth(t, p);

    const rowA = must(await t.run((ctx) => ctx.db.get(p.adminA)), "adminA");
    expect(rowA.role).toBe("admin");
    expect(rowA.societyId).toBe(p.fedA);

    const admins = await t
      .withIdentity({ subject: p.superAdmin })
      .query(api.superAdmin.listFederationAdmins);
    const mapped = new Map(admins.map((a) => [a._id, a]));
    expect(mapped.get(p.adminA)?.societyName).toBe("Kurnool Electricians Society");
    expect(mapped.get(p.adminB)?.societyName).toBe("Nandyal Masons Society");
  });

  it("provisions a brand-new officer account from an email", async () => {
    const t = setupTest();
    const p = await platform(t);
    const { adminUserId } = await t
      .withIdentity({ subject: p.superAdmin })
      .mutation(api.superAdmin.appointFederationAdmin, {
        email: "fresh.officer@sahakar.test",
        name: "Fresh Officer",
        societyId: p.fedA,
      });
    const row = must(await t.run((ctx) => ctx.db.get(adminUserId)), "provisioned");
    expect(row.email).toBe("fresh.officer@sahakar.test");
    expect(row.role).toBe("admin");
    expect(row.societyId).toBe(p.fedA);
  });

  it("refuses to appoint into a nonexistent federation or a super admin", async () => {
    const t = setupTest();
    const p = await platform(t);
    await expect(
      t.withIdentity({ subject: p.superAdmin }).mutation(
        api.superAdmin.appointFederationAdmin,
        { email: "x@example.com", societyId: "js7abcdefghijk" as Id<"societies"> },
      ),
    ).rejects.toThrow();

    await t.mutation(internal.demoSuperAdminUser.ensureDemoSuperAdminUser, {
      email: DEMO_SUPERADMIN_EMAILS[0],
    });
    await expect(
      t.withIdentity({ subject: p.superAdmin }).mutation(
        api.superAdmin.appointFederationAdmin,
        { email: DEMO_SUPERADMIN_EMAILS[0], societyId: p.fedA },
      ),
    ).rejects.toThrow("That account is a platform super admin");
  });

  it("removes an admin's role and scope — and they lose console access", async () => {
    const t = setupTest();
    const p = await platform(t);
    await appointBoth(t, p);
    const as = t.withIdentity({ subject: p.superAdmin });

    await as.mutation(api.superAdmin.removeFederationAdmin, { userId: p.adminA });

    const row = must(await t.run((ctx) => ctx.db.get(p.adminA)), "adminA");
    expect(row.role).toBe("user");
    expect(row.societyId).toBeUndefined();
    // Removed admin can no longer read the federation console either.
    await expect(
      t.withIdentity({ subject: p.adminA }).query(api.admin.workerDirectory),
    ).rejects.toThrow("Forbidden");
  });
});

describe("federation scoping: admins see only their own workers", () => {
  it("isolates two federations' worker directories from each other", async () => {
    const t = setupTest();
    const p = await platform(t);
    await appointBoth(t, p);

    // Two workers in federation A, one in federation B.
    const wA1 = await seedWorker(t, { email: "wa1@example.com", name: "WA1" });
    const wa1Id = await seedArtisan(t, wA1.id, {
      trade: "electrician",
      societyId: p.fedA,
    });
    const wA2 = await seedWorker(t, { email: "wa2@example.com", name: "WA2" });
    const wa2Id = await seedArtisan(t, wA2.id, {
      trade: "electrician",
      societyId: p.fedA,
    });
    const wB = await seedWorker(t, { email: "wb@example.com", name: "WB" });
    const wbId = await seedArtisan(t, wB.id, { trade: "mason", societyId: p.fedB });

    // Admin A sees exactly federation A's two workers, never B's.
    const dirA = await t
      .withIdentity({ subject: p.adminA })
      .query(api.admin.workerDirectory);
    expect([...dirA.map((a) => a._id)].sort()).toEqual(
      [wa1Id, wa2Id].sort(),
    );
    expect(dirA.map((a) => a._id)).not.toContain(wbId);

    // Admin B sees exactly federation B's one worker.
    const dirB = await t
      .withIdentity({ subject: p.adminB })
      .query(api.admin.workerDirectory);
    expect(dirB.map((a) => a._id)).toEqual([wbId]);

    // The super admin sees the whole platform (3 workers).
    const dirSuper = await t
      .withIdentity({ subject: p.superAdmin })
      .query(api.admin.workerDirectory);
    expect(dirSuper).toHaveLength(3);
  });

  it("hides other federations' workers from the verification queue too", async () => {
    const t = setupTest();
    const p = await platform(t);
    await appointBoth(t, p);

    const wA = await seedWorker(t, { email: "kyc-a@example.com" });
    await seedArtisan(t, wA.id, { trade: "electrician", societyId: p.fedA, kycStatus: "pending" });
    const wB = await seedWorker(t, { email: "kyc-b@example.com" });
    await seedArtisan(t, wB.id, { trade: "mason", societyId: p.fedB, kycStatus: "pending" });

    const queueA = await t
      .withIdentity({ subject: p.adminA })
      .query(api.admin.verificationQueue);
    expect(queueA).toHaveLength(1);
    expect(queueA[0].societyId).toBe(p.fedA);
  });

  it("blocks a scoped admin from reviewing another federation's worker", async () => {
    const t = setupTest();
    const p = await platform(t);
    await appointBoth(t, p);

    const wB = await seedWorker(t, { email: "cross@example.com" });
    const wbId = await seedArtisan(t, wB.id, {
      trade: "mason",
      societyId: p.fedB,
      kycStatus: "pending",
    });

    // Admin A (federation A) tries to approve federation B's worker.
    await expect(
      t.withIdentity({ subject: p.adminA }).mutation(api.admin.reviewKyc, {
        artisanId: wbId,
        approve: true,
      }),
    ).rejects.toThrow("Not in your federation");
  });
});

describe("demo super admin", () => {
  it("is provisioned as a super admin and passes the platform checks", async () => {
    const t = setupTest();
    const userId = await t.mutation(
      internal.demoSuperAdminUser.ensureDemoSuperAdminUser,
      { email: DEMO_SUPERADMIN_EMAILS[0] },
    );
    const as = t.withIdentity({ subject: userId });

    expect(await as.query(api.superAdmin.amSuperAdmin)).toBe(true);
    const overview = await as.query(api.superAdmin.platformOverview);
    expect(overview).toHaveProperty("federations");

    // Refuses every other address.
    await expect(
      t.mutation(internal.demoSuperAdminUser.ensureDemoSuperAdminUser, {
        email: "someone.else@example.com",
      }),
    ).rejects.toThrow("Not a demo super admin address");
  });

  it("is idempotent", async () => {
    const t = setupTest();
    const first = await t.mutation(
      internal.demoSuperAdminUser.ensureDemoSuperAdminUser,
      { email: DEMO_SUPERADMIN_EMAILS[0] },
    );
    const second = await t.mutation(
      internal.demoSuperAdminUser.ensureDemoSuperAdminUser,
      { email: DEMO_SUPERADMIN_EMAILS[0] },
    );
    expect(second).toBe(first);
  });
});
