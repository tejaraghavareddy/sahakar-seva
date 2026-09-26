import { describe, expect, it } from "vitest";
import {
  setupTest,
  must,
  api,
  seedCustomer,
  seedWorker,
  seedArtisan,
} from "./convexHarness";

/** The identity-bound caller object returned by the seed helpers. */
type Caller = Awaited<ReturnType<typeof seedCustomer>>["as"];

/** A plumber, so the trade gate has something real to check against. */
async function plumber(t: ReturnType<typeof setupTest>) {
  const w = await seedWorker(t, { email: "plumber@example.com" });
  const artisanId = await seedArtisan(t, w.id, { trade: "plumber" });
  return { ...w, artisanId };
}

function openGroup(as: Caller, maxShares = 3) {
  return as.mutation(api.bookingGroups.create, {
    serviceId: "pl-tap",
    address: "4 Nehru Street",
    lat: 15.83,
    lng: 78.03,
    scheduledFor: Date.now() + 3600_000,
    maxShares,
    welfareOptIn: true,
  });
}

async function groupRows(t: ReturnType<typeof setupTest>, groupId: string) {
  return must(
    await t.run((ctx) =>
      ctx.db
        .query("bookings")
        .withIndex("by_group", (q) => q.eq("groupId", groupId as never))
        .collect(),
    ),
    "group bookings",
  );
}

describe("bookingGroups: shared cost-split bookings", () => {
  it("opens a group and puts the creator in it as one household", async () => {
    const t = setupTest();
    const a = await seedCustomer(t, { email: "a@example.com" });
    const { groupId, bookingId } = await openGroup(a.as);

    const b = must(await t.run((ctx) => ctx.db.get(bookingId)), "booking");
    expect(b.groupId).toBe(groupId);
    expect(b.trade).toBe("plumber");
    expect(b.status).toBe("pending");

    const g = must(await t.run((ctx) => ctx.db.get(groupId)), "group");
    expect(g.status).toBe("open");
    expect(g.maxShares).toBe(3);
  });

  it("splits the visit price so the household shares sum to the exact total", async () => {
    const t = setupTest();
    const a = await seedCustomer(t, { email: "a@example.com" });
    const b = await seedCustomer(t, { email: "b@example.com" });
    const c = await seedCustomer(t, { email: "c@example.com" });
    const { groupId } = await openGroup(a.as, 3);
    await b.as.mutation(api.bookingGroups.join, { id: groupId });
    await c.as.mutation(api.bookingGroups.join, { id: groupId });

    const rows = await groupRows(t, groupId);
    expect(rows).toHaveLength(3);

    // The catalogue price of a tap repair, split three ways, must not invent or
    // lose a rupee to rounding.
    expect(rows[0].total).toBe(129);
    const shares = rows.map((r) => r.shareAmount ?? 0);
    expect(shares.reduce((s, n) => s + n, 0)).toBe(129);
    for (const s of shares) expect(Number.isInteger(s)).toBe(true);
  });

  it("applies the 90/7/3 federation split to the full visit price, once", async () => {
    const t = setupTest();
    const a = await seedCustomer(t, { email: "a@example.com" });
    const b = await seedCustomer(t, { email: "b@example.com" });
    const { groupId } = await openGroup(a.as, 2);
    await b.as.mutation(api.bookingGroups.join, { id: groupId });

    const rows = await groupRows(t, groupId);
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      // Each household's row carries the same ledger view of the whole job —
      // the cooperative's split is a property of the visit, not of the payer.
      expect(r.workerShare + r.welfareAmt + r.opsAmt).toBe(r.total);
      expect(r.total).toBe(129);
    }
  });

  it("marks the group full once the last household joins", async () => {
    const t = setupTest();
    const a = await seedCustomer(t, { email: "a@example.com" });
    const b = await seedCustomer(t, { email: "b@example.com" });
    const { groupId } = await openGroup(a.as, 2);
    await b.as.mutation(api.bookingGroups.join, { id: groupId });
    const g = must(await t.run((ctx) => ctx.db.get(groupId)), "group");
    expect(g.status).toBe("full");
  });

  it("refuses a household joining a full group", async () => {
    const t = setupTest();
    const a = await seedCustomer(t, { email: "a@example.com" });
    const b = await seedCustomer(t, { email: "b@example.com" });
    const late = await seedCustomer(t, { email: "late@example.com" });
    const { groupId } = await openGroup(a.as, 2);
    await b.as.mutation(api.bookingGroups.join, { id: groupId });
    await expect(
      late.as.mutation(api.bookingGroups.join, { id: groupId }),
    ).rejects.toThrow(/full/i);
  });

  it("refuses the same household joining twice", async () => {
    const t = setupTest();
    const a = await seedCustomer(t, { email: "a@example.com" });
    const { groupId } = await openGroup(a.as, 3);
    await expect(
      a.as.mutation(api.bookingGroups.join, { id: groupId }),
    ).rejects.toThrow(/already in/i);
  });

  it("rejects a group size outside 2-4 households", async () => {
    const t = setupTest();
    const a = await seedCustomer(t, { email: "a@example.com" });
    for (const maxShares of [1, 5, 0]) {
      await expect(openGroup(a.as, maxShares)).rejects.toThrow(/2 to 4/);
    }
  });

  it("rejects a service that was never bookable", async () => {
    const t = setupTest();
    const a = await seedCustomer(t, { email: "a@example.com" });
    await expect(
      a.as.mutation(api.bookingGroups.create, {
        serviceId: "not-a-real-service",
        address: "4 Nehru Street",
        scheduledFor: Date.now() + 3600_000,
        maxShares: 2,
        welfareOptIn: true,
      }),
    ).rejects.toThrow(/Unknown service/);
  });

  it("refuses to join a group that has already closed", async () => {
    const t = setupTest();
    const a = await seedCustomer(t, { email: "a@example.com" });
    const b = await seedCustomer(t, { email: "b@example.com" });
    const { groupId } = await openGroup(a.as, 2);
    // Wind the window into the past rather than waiting six hours.
    await t.run(async (ctx) => {
      const g = must(await ctx.db.get(groupId), "group");
      await ctx.db.patch(g._id, { windowEnd: Date.now() - 1000 });
    });
    await expect(
      b.as.mutation(api.bookingGroups.join, { id: groupId }),
    ).rejects.toThrow(/closed/i);
  });

  it("lets a household drop out while the visit is still open", async () => {
    const t = setupTest();
    const a = await seedCustomer(t, { email: "a@example.com" });
    const b = await seedCustomer(t, { email: "b@example.com" });
    const { groupId } = await openGroup(a.as, 3);
    await b.as.mutation(api.bookingGroups.join, { id: groupId });
    await b.as.mutation(api.bookingGroups.leave, { id: groupId });
    expect(await groupRows(t, groupId)).toHaveLength(1);
  });

  it("surfaces nearby open groups without exposing any address", async () => {
    const t = setupTest();
    const a = await seedCustomer(t, { email: "a@example.com" });
    await openGroup(a.as, 3);

    const near = await t.query(api.bookingGroups.nearbyOpen, {
      trade: "plumber",
      lat: 15.84,
      lng: 78.04,
    });
    expect(near).toHaveLength(1);
    expect(near[0].filled).toBe(1);
    expect(near[0].spotsLeft).toBe(2);
    expect(near[0].distM).toBeGreaterThan(0);

    // The public pitch shows a service, a window and a count. Not a door.
    const serialized = JSON.stringify(near);
    expect(serialized).not.toContain("Nehru Street");
    expect(serialized).not.toContain("a@example.com");
  });

  it("hides a group's participant list from a stranger", async () => {
    const t = setupTest();
    const a = await seedCustomer(t, { email: "a@example.com" });
    const nosy = await seedCustomer(t, { email: "nosy@example.com" });
    const { groupId } = await openGroup(a.as, 3);
    expect(await nosy.as.query(api.bookingGroups.get, { id: groupId })).toBeNull();
  });

  it("caps how many shared visits one customer can open or join", async () => {
    const t = setupTest();
    const a = await seedCustomer(t, { email: "a@example.com" });
    let limited = false;
    for (let i = 0; i < 8; i++) {
      try {
        await openGroup(a.as, 3);
      } catch (e) {
        expect((e as Error).message).toMatch(/Too many attempts/);
        limited = true;
        break;
      }
    }
    expect(limited).toBe(true);
  });

  it("does not let one customer's flood block another's group", async () => {
    const t = setupTest();
    const flooder = await seedCustomer(t, { email: "flood@example.com" });
    const polite = await seedCustomer(t, { email: "polite@example.com" });
    for (let i = 0; i < 6; i++) await openGroup(flooder.as, 3).catch(() => {});
    // The other household is entirely unaffected.
    await expect(openGroup(polite.as, 2)).resolves.toBeTruthy();
  });
});

describe("bookingGroups: dispatch into the workers' radar", () => {
  it("shows a filled group on the job radar as ONE visit, not N jobs", async () => {
    const t = setupTest();
    const a = await seedCustomer(t, { email: "a@example.com" });
    const b = await seedCustomer(t, { email: "b@example.com" });
    const p = await plumber(t);
    const { groupId } = await openGroup(a.as, 2);
    await b.as.mutation(api.bookingGroups.join, { id: groupId });

    const { radar } = await p.as.query(api.bookings.listForWorker);
    // Three households on one trip is one job. Listing it as three pending rows
    // would have the worker drive out once and leave two calls unclaimed.
    expect(radar).toHaveLength(1);
    expect(radar[0].trade).toBe("plumber");
    expect(radar[0].sharedCount).toBe(2);
    // The worker is shown the full visit price, not one household's slice.
    expect(radar[0].total).toBe(129);
    expect(radar[0].workerShare).toBe(116);
  });

  it("accepting a shared visit takes the whole trip, not one household", async () => {
    const t = setupTest();
    const a = await seedCustomer(t, { email: "a@example.com" });
    const b = await seedCustomer(t, { email: "b@example.com" });
    const p = await plumber(t);
    const { groupId } = await openGroup(a.as, 2);
    await b.as.mutation(api.bookingGroups.join, { id: groupId });

    const { radar } = await p.as.query(api.bookings.listForWorker);
    const took = await p.as.mutation(api.bookings.accept, { id: radar[0]._id });
    expect(took).toBe(2);

    // Nobody is left stranded on a "pending" job that nobody is coming to.
    const rows = await groupRows(t, groupId);
    expect(rows.every((r) => r.status === "accepted")).toBe(true);
    expect(new Set(rows.map((r) => r.workerId)).size).toBe(1);

    // And it leaves the radar, having been taken as a single job.
    const after = await p.as.query(api.bookings.listForWorker);
    expect(after.radar).toHaveLength(0);
  });

  it("enforces the trade rule on a group booking just like any other", async () => {
    const t = setupTest();
    const a = await seedCustomer(t, { email: "a@example.com" });
    const b = await seedCustomer(t, { email: "b@example.com" });
    const { groupId, bookingId } = await openGroup(a.as, 2);
    await b.as.mutation(api.bookingGroups.join, { id: groupId });

    const sparky = await seedWorker(t, { email: "sparky@example.com" });
    await seedArtisan(t, sparky.id, { trade: "electrician" });
    await expect(
      sparky.as.mutation(api.bookings.accept, { id: bookingId }),
    ).rejects.toThrow(/not in your trade/);
  });
});
