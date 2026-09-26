/**
 * A shared visit is one job that several households split. The federation's
 * 90/7/3 split applies to the visit price exactly once (see the bookingGroups
 * comment in schema.ts) — so the welfare ledger must be credited once for the
 * visit, not once per household that paid a slice of it.
 *
 * This is a money bug, so it is pinned here rather than left to inspection.
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

const SPLIT = 3;

describe("shared visits: welfare is credited once per visit, not per household", () => {
  it("credits the worker's welfare ledger once when every household pays", async () => {
    const t = setupTest();

    const worker = await seedWorker(t, { email: "plumber@example.com" });
    const artisanId = await seedArtisan(t, worker.id, { trade: "plumber" });
    const when = Date.now() + 3600_000;

    const host = await seedCustomer(t, { email: "host@example.com" });
    const { groupId } = await host.as.mutation(api.bookingGroups.create, {
      serviceId: "pl-tap",
      address: "4 Nehru Street",
      lat: 15.83,
      lng: 78.03,
      scheduledFor: when,
      maxShares: SPLIT,
      welfareOptIn: true,
    });

    // Two more households join the same visit.
    const callers = [host];
    for (const email of ["b@example.com", "c@example.com"]) {
      const c = await seedCustomer(t, { email });
      await c.as.mutation(api.bookingGroups.join, { id: groupId });
      callers.push(c);
    }

    const rows = must(
      await t.run((ctx) =>
        ctx.db
          .query("bookings")
          .withIndex("by_group", (q) => q.eq("groupId", groupId))
          .collect(),
      ),
      "group bookings",
    );
    expect(rows).toHaveLength(SPLIT);

    const visitTotal = rows[0].total;
    // The visit price, and the one welfare share that belongs to it.
    const welfareDue = Math.round(visitTotal * 0.07);

    // Every household settles its own slice. The group rows start at "pending"
    // with no worker, so walk each to the payment step the way the platform
    // would: the visit is one job, so one worker is attached to every row.
    const byCustomer = new Map(callers.map((c) => [c.id, c.as]));

    for (const b of rows) {
      await t.run(async (ctx) => {
        await ctx.db.patch(b._id, {
          status: "payment",
          workerId: artisanId,
          workerUserId: worker.id,
        });
      });
      await must(byCustomer.get(b.customerId), "payer").mutation(
        api.bookings.confirmUtr,
        { id: b._id, utr: `UTR${b._id.slice(-6)}` },
      );
    }

    const balance = must(
      await t.run(async (ctx) => (await ctx.db.get(artisanId))?.welfareBalance),
      "artisan",
    );

    // One visit, one welfare share.
    expect(balance).toBe(welfareDue);
    // Guard the shape of the bug: once per household would be SPLIT×.
    expect(balance).not.toBe(welfareDue * SPLIT);

    // The federation dashboard reports the same money and had the same
    // double-count: a 3-household visit must not read as 3 visits' revenue.
    const admin = await seedAdmin(t, { email: "board@sahakar.test" });
    const overview = await admin.as.query(api.admin.overview);
    expect(overview.revenueSettled).toBe(visitTotal);
    expect(overview.welfarePool).toBe(welfareDue);
    expect(overview.opsPool).toBe(visitTotal - welfareDue - Math.round(visitTotal * 0.9));
    // The pipeline still shows every household — they are real rows.
    expect(overview.bookings).toBe(SPLIT);
  });
});
