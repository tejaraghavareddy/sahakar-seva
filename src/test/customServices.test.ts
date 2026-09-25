import { describe, expect, it } from "vitest";
import {
  api,
  seedAdmin,
  seedArtisan,
  seedCustomer,
  seedWorker,
  setupTest,
} from "./convexHarness";

/** A valid worker-created listing, overridable per test. */
const LISTING = {
  name: "Terrace waterproofing",
  description: "Two-coat terrace waterproofing with a five-year warranty.",
  category: "plumber",
  isCustomCategory: false,
  base: 899,
  hourly: 300,
  urgent: false,
};

describe("customServices:create", () => {
  it("refuses a signed-out caller", async () => {
    const t = setupTest();
    await expect(t.mutation(api.customServices.create, LISTING)).rejects.toThrow(
      "Not authenticated",
    );
  });

  it("asks the worker to finish the trade profile first", async () => {
    const t = setupTest();
    const { as } = await seedWorker(t);
    await expect(
      as.mutation(api.customServices.create, LISTING),
    ).rejects.toThrow("Complete your trade profile first");
  });

  it("refuses a worker removed from the federation", async () => {
    const t = setupTest();
    const w = await seedWorker(t);
    await seedArtisan(t, w.id, { removedAt: Date.now() });
    await expect(
      w.as.mutation(api.customServices.create, LISTING),
    ).rejects.toThrow("removed from the federation");
  });

  it("stores a pending listing inside the worker's own trade", async () => {
    const t = setupTest();
    const w = await seedWorker(t);
    await seedArtisan(t, w.id, { trade: "mason", district: "Kurnool" });
    const id = await w.as.mutation(api.customServices.create, LISTING);
    const row = (await t.run(async (ctx) => ctx.db.get(id)))!;
    expect(row.status).toBe("pending");
    expect(row.trade).toBe("mason");
    expect(row.district).toBe("Kurnool");
    expect(row.isCustomCategory).toBe(false);
    expect(row.category).toBe("mason");
    expect(row.base).toBe(899);
    expect(row.hourly).toBe(300);
  });

  it("keeps a category the worker named themselves", async () => {
    const t = setupTest();
    const w = await seedWorker(t);
    await seedArtisan(t, w.id, { trade: "electrician" });
    const id = await w.as.mutation(api.customServices.create, {
      ...LISTING,
      category: "Solar installation",
      isCustomCategory: true,
    });
    const row = (await t.run(async (ctx) => ctx.db.get(id)))!;
    expect(row.isCustomCategory).toBe(true);
    expect(row.category).toBe("Solar installation");
    // Dispatch still happens inside one of the six cooperative trades.
    expect(row.trade).toBe("electrician");
  });

  it("validates the work name, description and prices", async () => {
    const t = setupTest();
    const w = await seedWorker(t);
    await seedArtisan(t, w.id);
    await expect(
      w.as.mutation(api.customServices.create, { ...LISTING, name: "ab" }),
    ).rejects.toThrow("Work name must be 3-60 characters");
    await expect(
      w.as.mutation(api.customServices.create, { ...LISTING, description: "short" }),
    ).rejects.toThrow("Describe the work in 10-240 characters");
    await expect(
      w.as.mutation(api.customServices.create, { ...LISTING, base: 10 }),
    ).rejects.toThrow("Visit charge must be between");
    await expect(
      w.as.mutation(api.customServices.create, { ...LISTING, hourly: 99999 }),
    ).rejects.toThrow("Hourly rate must be between");
    await expect(
      w.as.mutation(api.customServices.create, {
        ...LISTING,
        category: "plumber",
        isCustomCategory: true,
      }),
    ).resolves.toBeTypeOf("string");
  });

  it("rejects a category that is neither a trade nor a usable name", async () => {
    const t = setupTest();
    const w = await seedWorker(t);
    await seedArtisan(t, w.id);
    await expect(
      w.as.mutation(api.customServices.create, { ...LISTING, category: "plumber" }),
    ).resolves.toBeTypeOf("string");
    await expect(
      w.as.mutation(api.customServices.create, { ...LISTING, category: "astro" }),
    ).rejects.toThrow("Pick one of the six trades");
    await expect(
      w.as.mutation(api.customServices.create, {
        ...LISTING,
        category: "ab",
        isCustomCategory: true,
      }),
    ).rejects.toThrow("Category name must be 3-40 characters");
  });

  it("caps how many works one worker can publish", async () => {
    const t = setupTest();
    const w = await seedWorker(t);
    await seedArtisan(t, w.id);
    for (let i = 0; i < 8; i++) {
      await w.as.mutation(api.customServices.create, {
        ...LISTING,
        name: `Work number ${i + 1}`,
      });
    }
    await expect(
      w.as.mutation(api.customServices.create, LISTING),
    ).rejects.toThrow("You can publish up to 8 works");
  });
});

describe("customServices:myListings + remove", () => {
  it("returns only my own listings, newest first, with a cs_ route id", async () => {
    const t = setupTest();
    const mine = await seedWorker(t);
    await seedArtisan(t, mine.id);
    const other = await seedWorker(t, { email: "other@example.com" });
    await seedArtisan(t, other.id);

    const first = await mine.as.mutation(api.customServices.create, {
      ...LISTING,
      name: "First work",
    });
    await mine.as.mutation(api.customServices.create, {
      ...LISTING,
      name: "Second work",
    });
    await other.as.mutation(api.customServices.create, LISTING);

    const rows = await mine.as.query(api.customServices.myListings, {});
    expect(rows).toHaveLength(2);
    expect(rows[0].name).toBe("Second work");
    expect(rows[0].routeId).toBe(`cs_${rows[0]._id}`);
    expect(rows[1]._id).toBe(first);
  });

  it("lets me withdraw my listing but not somebody else's", async () => {
    const t = setupTest();
    const mine = await seedWorker(t);
    await seedArtisan(t, mine.id);
    const other = await seedWorker(t, { email: "other@example.com" });
    await seedArtisan(t, other.id);
    const id = await mine.as.mutation(api.customServices.create, LISTING);

    await expect(
      other.as.mutation(api.customServices.remove, { serviceId: id }),
    ).rejects.toThrow("Forbidden");
    await mine.as.mutation(api.customServices.remove, { serviceId: id });
    expect(await mine.as.query(api.customServices.myListings, {})).toHaveLength(0);
  });
});

describe("customServices: board review", () => {
  it("refuses a non-admin reviewer", async () => {
    const t = setupTest();
    const w = await seedWorker(t);
    await seedArtisan(t, w.id);
    const id = await w.as.mutation(api.customServices.create, LISTING);
    await expect(
      w.as.query(api.customServices.reviewQueue, {}),
    ).rejects.toThrow("Forbidden");
    await expect(
      w.as.mutation(api.customServices.review, { serviceId: id, approve: true }),
    ).rejects.toThrow("Forbidden");
  });

  it("only shows pending listings in the queue", async () => {
    const t = setupTest();
    const w = await seedWorker(t);
    await seedArtisan(t, w.id);
    const admin = await seedAdmin(t);
    const id = await w.as.mutation(api.customServices.create, LISTING);
    expect(await admin.as.query(api.customServices.reviewQueue, {})).toHaveLength(1);
    await admin.as.mutation(api.customServices.review, { serviceId: id, approve: true });
    expect(await admin.as.query(api.customServices.reviewQueue, {})).toHaveLength(0);
  });

  it("publishes on approval and notifies the worker", async () => {
    const t = setupTest();
    const w = await seedWorker(t);
    await seedArtisan(t, w.id);
    const admin = await seedAdmin(t);
    const id = await w.as.mutation(api.customServices.create, LISTING);

    await admin.as.mutation(api.customServices.review, {
      serviceId: id,
      approve: true,
      note: "Clear photos and a fair rate",
    });
    const row = (await t.run(async (ctx) => ctx.db.get(id)))!;
    expect(row.status).toBe("approved");
    expect(row.reviewedBy).toBe(admin.id);
    expect(row.reviewNote).toBe("Clear photos and a fair rate");

    const notices = await t.run(async (ctx) =>
      ctx.db
        .query("notifications")
        .withIndex("by_user", (q) => q.eq("userId", w.id))
        .collect(),
    );
    expect(notices).toHaveLength(1);
    expect(notices[0].body).toContain("Terrace waterproofing");
  });

  it("rejects with a reason and never reviews the same listing twice", async () => {
    const t = setupTest();
    const w = await seedWorker(t);
    await seedArtisan(t, w.id);
    const admin = await seedAdmin(t);
    const id = await w.as.mutation(api.customServices.create, LISTING);

    await admin.as.mutation(api.customServices.review, {
      serviceId: id,
      approve: false,
      note: "Please add the warranty terms",
    });
    const row = (await t.run(async (ctx) => ctx.db.get(id)))!;
    expect(row.status).toBe("rejected");

    await expect(
      admin.as.mutation(api.customServices.review, { serviceId: id, approve: true }),
    ).rejects.toThrow("Listing already reviewed");
  });
});

describe("customServices: customer catalog", () => {
  it("shows approved listings only, and hides removed workers", async () => {
    const t = setupTest();
    const w = await seedWorker(t);
    await seedArtisan(t, w.id, { trade: "plumber" });
    const admin = await seedAdmin(t);
    const live = await w.as.mutation(api.customServices.create, LISTING);
    const pending = await w.as.mutation(api.customServices.create, {
      ...LISTING,
      name: "Still under review",
    });
    await admin.as.mutation(api.customServices.review, { serviceId: live, approve: true });
    expect(pending).toBeTruthy();

    const catalog = await t.query(api.customServices.approvedCatalog, {});
    expect(catalog).toHaveLength(1);
    expect(catalog[0].routeId).toBe(`cs_${live}`);
    expect(catalog[0].workerName).toBe("Test Worker");
    expect(catalog[0].base).toBe(899);

    await t.run(async (ctx) => {
      const artisan = await ctx.db
        .query("artisans")
        .withIndex("by_userId", (q) => q.eq("userId", w.id))
        .first();
      if (artisan) await ctx.db.patch(artisan._id, { removedAt: Date.now() });
    });
    expect(await t.query(api.customServices.approvedCatalog, {})).toHaveLength(0);
  });

  it("filters the catalog by trade", async () => {
    const t = setupTest();
    const w = await seedWorker(t);
    await seedArtisan(t, w.id, { trade: "carpenter" });
    const admin = await seedAdmin(t);
    const id = await w.as.mutation(api.customServices.create, LISTING);
    await admin.as.mutation(api.customServices.review, { serviceId: id, approve: true });

    expect(await t.query(api.customServices.approvedCatalog, { trade: "carpenter" })).toHaveLength(1);
    expect(await t.query(api.customServices.approvedCatalog, { trade: "mason" })).toHaveLength(0);
  });

  it("resolves one listing by its route id, and nothing else", async () => {
    const t = setupTest();
    const w = await seedWorker(t);
    await seedArtisan(t, w.id);
    const admin = await seedAdmin(t);
    const id = await w.as.mutation(api.customServices.create, LISTING);

    // Not approved yet -> the customer page must not offer it.
    expect(
      await t.query(api.customServices.approvedByRouteId, { serviceId: `cs_${id}` }),
    ).toBeNull();
    expect(
      await t.query(api.customServices.approvedByRouteId, { serviceId: "ap-ac" }),
    ).toBeNull();
    expect(
      await t.query(api.customServices.approvedByRouteId, { serviceId: "cs_not-a-real-id" }),
    ).toBeNull();

    await admin.as.mutation(api.customServices.review, { serviceId: id, approve: true });
    const found = await t.query(api.customServices.approvedByRouteId, {
      serviceId: `cs_${id}`,
    });
    expect(found?.name).toBe("Terrace waterproofing");
  });
});

describe("bookings: worker-created work is bookable", () => {
  const when = () => Date.now() + 3_600_000;

  it("prices a booking from the listing, with the cooperative split", async () => {
    const t = setupTest();
    const w = await seedWorker(t);
    await seedArtisan(t, w.id, { trade: "mason" });
    const admin = await seedAdmin(t);
    const c = await seedCustomer(t);
    const id = await w.as.mutation(api.customServices.create, {
      ...LISTING,
      base: 1000,
      hourly: 250,
    });
    await admin.as.mutation(api.customServices.review, { serviceId: id, approve: true });

    const bookingId = await c.as.mutation(api.bookings.create, {
      serviceId: `cs_${id}`,
      address: "12 Balaji Nagar",
      scheduledFor: when(),
      urgent: false,
      welfareOptIn: true,
    });
    const b = (await t.run(async (ctx) => ctx.db.get(bookingId)))!;
    expect(b.serviceId).toBe(`cs_${id}`);
    expect(b.customServiceId).toBe(id);
    expect(b.trade).toBe("mason");
    expect(b.serviceName).toBe("Terrace waterproofing");
    expect(b.base).toBe(1000);
    expect(b.hourly).toBe(250);
    expect(b.workerShare).toBe(900);
    expect(b.welfareAmt).toBe(70);
    expect(b.opsAmt).toBe(30);
    expect(b.total).toBe(1000);
  });

  it("refuses to book a listing the board has not approved", async () => {
    const t = setupTest();
    const w = await seedWorker(t);
    await seedArtisan(t, w.id);
    const c = await seedCustomer(t);
    const id = await w.as.mutation(api.customServices.create, LISTING);
    await expect(
      c.as.mutation(api.bookings.create, {
        serviceId: `cs_${id}`,
        address: "12 Balaji Nagar",
        scheduledFor: when(),
        urgent: false,
        welfareOptIn: true,
      }),
    ).rejects.toThrow("Unknown service");
  });

  it("marks the creator's own listing on the worker radar", async () => {
    const t = setupTest();
    const w = await seedWorker(t);
    await seedArtisan(t, w.id, { trade: "mason" });
    const rival = await seedWorker(t, { email: "rival@example.com" });
    await seedArtisan(t, rival.id, { trade: "mason" });
    const admin = await seedAdmin(t);
    const c = await seedCustomer(t);
    const id = await w.as.mutation(api.customServices.create, LISTING);
    await admin.as.mutation(api.customServices.review, { serviceId: id, approve: true });
    await c.as.mutation(api.bookings.create, {
      serviceId: `cs_${id}`,
      address: "12 Balaji Nagar",
      scheduledFor: when(),
      urgent: false,
      welfareOptIn: true,
    });

    const mine = await w.as.query(api.bookings.listForWorker, {});
    expect(mine.radar).toHaveLength(1);
    expect(mine.radar[0].myListing).toBe(true);

    const theirs = await rival.as.query(api.bookings.listForWorker, {});
    expect(theirs.radar[0].myListing).toBe(false);
  });

  it("still serves the six standard catalog services unchanged", async () => {
    const t = setupTest();
    const c = await seedCustomer(t);
    const id = await c.as.mutation(api.bookings.create, {
      serviceId: "ap-ac",
      address: "5 MG Road",
      scheduledFor: when(),
      urgent: true,
      welfareOptIn: true,
    });
    const b = (await t.run(async (ctx) => ctx.db.get(id)))!;
    expect(b.customServiceId).toBeUndefined();
    expect(b.serviceName).toBe("AC service & gas top-up");
    expect(b.workerShare).toBe(404);
  });
});
