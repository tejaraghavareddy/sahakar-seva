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

const createArgs = {
  serviceId: "ap-ac",
  address: "  12 Gandhi Street, Kurnool  ",
  scheduledFor: 1_800_000_000_000,
  urgent: false,
  welfareOptIn: true,
};

/** Every service id in the server-side catalogue. */
const SERVICE_IDS = [
  "el-fan",
  "el-wire",
  "el-short",
  "el-light",
  "pl-tap",
  "pl-block",
  "pl-tank",
  "pl-pipe",
  "ca-door",
  "ca-furn",
  "ca-modular",
  "ca-measure",
  "ma-crack",
  "ma-water",
  "ma-tile",
  "ma-plaster",
  "pa-room",
  "pa-wall",
  "pa-texture",
  "pa-waterproof",
  "ap-ac",
  "ap-fridge",
  "ap-wm",
  "ap-mw",
];

describe("bookings:create", () => {
  it("refuses a signed-out caller", async () => {
    const t = setupTest();
    await expect(t.mutation(api.bookings.create, createArgs)).rejects.toThrow(
      "Not authenticated",
    );
  });

  it("rejects an unknown service id", async () => {
    const t = setupTest();
    const { as } = await seedCustomer(t);
    await expect(
      as.mutation(api.bookings.create, { ...createArgs, serviceId: "nope" }),
    ).rejects.toThrow("Unknown service");
  });

  it("rejects a blank address", async () => {
    const t = setupTest();
    const { as } = await seedCustomer(t);
    await expect(
      as.mutation(api.bookings.create, { ...createArgs, address: "   " }),
    ).rejects.toThrow("Address is required");
  });

  it("splits the gross amount 90 / 7 / 3 with no rounding drift", async () => {
    const t = setupTest();
    const { as } = await seedCustomer(t);
    // ap-ac base is 449 — 90% = 404.1 and 7% = 31.43, so ops absorbs the rounding.
    const id = await as.mutation(api.bookings.create, createArgs);
    const b = must(await t.run((ctx) => ctx.db.get(id)), "booking");
    expect(b.base).toBe(449);
    expect(b.workerShare).toBe(Math.round(449 * 0.9));
    expect(b.welfareAmt).toBe(Math.round(449 * 0.07));
    expect(b.opsAmt).toBe(449 - b.workerShare - b.welfareAmt);
    expect(b.workerShare + b.welfareAmt + b.opsAmt).toBe(b.base);
    expect(b.total).toBe(449);
  });

  it("splits every catalogue price exactly — no rupee is created or lost", async () => {
    const t = setupTest();
    const { as } = await seedCustomer(t);
    for (const serviceId of SERVICE_IDS) {
      const id = await as.mutation(api.bookings.create, { ...createArgs, serviceId });
      const b = must(await t.run((ctx) => ctx.db.get(id)), `booking for ${serviceId}`);
      expect(b.workerShare, `${serviceId} worker share`).toBe(Math.round(b.base * 0.9));
      expect(b.welfareAmt, `${serviceId} welfare share`).toBe(Math.round(b.base * 0.07));
      expect(
        b.workerShare + b.welfareAmt + b.opsAmt,
        `${serviceId} split must equal the gross`,
      ).toBe(b.base);
    }
  });

  it("trims the address, denormalises the service and defaults to pending", async () => {
    const t = setupTest();
    const { as } = await seedCustomer(t);
    const id = await as.mutation(api.bookings.create, { ...createArgs, serviceId: "ap-fridge" });
    const b = must(await t.run((ctx) => ctx.db.get(id)), "booking");
    expect(b.address).toBe("12 Gandhi Street, Kurnool");
    expect(b.serviceName).toBe("Refrigerator repair");
    expect(b.trade).toBe("appliance");
    expect(b.urgent).toBe(false);
    expect(b.status).toBe("pending");
  });

  it("keeps the urgent flag for an urgent-capable service", async () => {
    const t = setupTest();
    const { as } = await seedCustomer(t);
    const id = await as.mutation(api.bookings.create, {
      ...createArgs,
      serviceId: "ap-fridge",
      urgent: true,
    });
    expect(must(await t.run((ctx) => ctx.db.get(id)), "booking").urgent).toBe(true);
  });

  it("never lets a non-urgent service be flagged urgent", async () => {
    const t = setupTest();
    const { as } = await seedCustomer(t);
    const id = await as.mutation(api.bookings.create, { ...createArgs, urgent: true });
    expect(must(await t.run((ctx) => ctx.db.get(id)), "booking").urgent).toBe(false);
  });
});

describe("bookings:listForCustomer", () => {
  it("refuses a signed-out caller", async () => {
    const t = setupTest();
    await expect(t.query(api.bookings.listForCustomer)).rejects.toThrow("Not authenticated");
  });

  it("only returns the caller's own bookings", async () => {
    const t = setupTest();
    const c1 = await seedCustomer(t, { email: "a@x.com" });
    const c2 = await seedCustomer(t, { email: "b@x.com" });
    await seedBooking(t, c1.id, { serviceName: "Mine" });
    await seedBooking(t, c2.id, { serviceName: "Theirs" });

    const list = await c1.as.query(api.bookings.listForCustomer);
    expect(list.map((b) => b.serviceName)).toEqual(["Mine"]);
  });
});

describe("bookings:listForWorker", () => {
  it("refuses a signed-out caller", async () => {
    const t = setupTest();
    await expect(t.query(api.bookings.listForWorker)).rejects.toThrow("Not authenticated");
  });

  it("returns empty lists for a member who is not a worker", async () => {
    const t = setupTest();
    const c = await seedCustomer(t);
    expect(await c.as.query(api.bookings.listForWorker)).toEqual({ mine: [], radar: [] });
  });

  it("separates assigned jobs from the open radar pool of the same trade", async () => {
    const t = setupTest();
    const w = await seedWorker(t);
    const workerArtisan = await seedArtisan(t, w.id, { trade: "electrician" });
    const other = await seedWorker(t);
    await seedArtisan(t, other.id, { trade: "plumber" });

    const assigned = await seedBooking(t, (await seedCustomer(t)).id, {
      trade: "electrician",
      status: "accepted",
      workerId: workerArtisan,
      workerUserId: w.id,
    });
    const openSameTrade = await seedBooking(t, (await seedCustomer(t)).id, {
      trade: "electrician",
      status: "pending",
    });
    const openOtherTrade = await seedBooking(t, (await seedCustomer(t)).id, {
      trade: "plumber",
      status: "pending",
    });
    const closed = await seedBooking(t, (await seedCustomer(t)).id, {
      trade: "electrician",
      status: "settled",
    });

    const res = await w.as.query(api.bookings.listForWorker);
    expect(res.mine.map((b) => b._id)).toEqual([assigned]);
    expect(res.radar.map((b) => b._id)).toEqual([openSameTrade]);
    expect(res.radar.map((b) => b._id)).not.toContain(openOtherTrade);
    expect(res.radar.map((b) => b._id)).not.toContain(closed);
  });
});

describe("bookings visibility", () => {
  it("listForAdmin is admin-only", async () => {
    const t = setupTest();
    const c = await seedCustomer(t);
    await expect(c.as.query(api.bookings.listForAdmin)).rejects.toThrow("Forbidden");
    const a = await seedAdmin(t);
    expect(await a.as.query(api.bookings.listForAdmin)).toEqual([]);
  });

  it("getBooking hides a booking from unrelated members", async () => {
    const t = setupTest();
    const owner = await seedCustomer(t);
    const stranger = await seedCustomer(t, { email: "other@x.com" });
    const b = await seedBooking(t, owner.id);

    expect(await owner.as.query(api.bookings.getBooking, { id: b })).not.toBeNull();
    expect(await stranger.as.query(api.bookings.getBooking, { id: b })).toBeNull();
  });

  it("getBooking is visible to the assigned worker and to admin", async () => {
    const t = setupTest();
    const customer = await seedCustomer(t);
    const w = await seedWorker(t);
    const artisan = await seedArtisan(t, w.id);
    const a = await seedAdmin(t);
    const b = await seedBooking(t, customer.id, { workerId: artisan, workerUserId: w.id });

    expect(await w.as.query(api.bookings.getBooking, { id: b })).not.toBeNull();
    expect(await a.as.query(api.bookings.getBooking, { id: b })).not.toBeNull();
  });

  it("getBooking refuses a signed-out caller outright", async () => {
    const t = setupTest();
    const c = await seedCustomer(t);
    const b = await seedBooking(t, c.id);
    await expect(t.query(api.bookings.getBooking, { id: b })).rejects.toThrow(
      "Not authenticated",
    );
  });

  it("getBooking returns null when the id does not exist", async () => {
    const t = setupTest();
    const c = await seedCustomer(t);
    const missing = await seedBooking(t, c.id);
    await t.run((ctx) => ctx.db.delete(missing));
    expect(await c.as.query(api.bookings.getBooking, { id: missing })).toBeNull();
  });
});

describe("bookings chat", () => {
  it("refuses a signed-out caller", async () => {
    const t = setupTest();
    const c = await seedCustomer(t);
    const b = await seedBooking(t, c.id);
    await expect(t.query(api.bookings.listMessages, { bookingId: b })).rejects.toThrow(
      "Not authenticated",
    );
    await expect(
      t.mutation(api.bookings.sendMessage, { bookingId: b, body: "hi" }),
    ).rejects.toThrow("Not authenticated");
  });

  it("refuses messages from a member who is not on the booking", async () => {
    const t = setupTest();
    const c = await seedCustomer(t);
    const stranger = await seedCustomer(t, { email: "x@x.com" });
    const b = await seedBooking(t, c.id);

    await expect(
      stranger.as.mutation(api.bookings.sendMessage, { bookingId: b, body: "hi" }),
    ).rejects.toThrow("Not allowed");
    expect(await stranger.as.query(api.bookings.listMessages, { bookingId: b })).toEqual([]);
  });

  it("rejects an empty message", async () => {
    const t = setupTest();
    const c = await seedCustomer(t);
    const b = await seedBooking(t, c.id);
    await expect(
      c.as.mutation(api.bookings.sendMessage, { bookingId: b, body: "   " }),
    ).rejects.toThrow("Empty message");
  });

  it("stores messages in order, tagged with the sender role, capped at 1000 chars", async () => {
    const t = setupTest();
    const customer = await seedCustomer(t);
    const w = await seedWorker(t);
    const artisan = await seedArtisan(t, w.id);
    const b = await seedBooking(t, customer.id, { workerId: artisan, workerUserId: w.id });

    await customer.as.mutation(api.bookings.sendMessage, { bookingId: b, body: "  hello  " });
    await w.as.mutation(api.bookings.sendMessage, { bookingId: b, body: "x".repeat(1200) });

    const msgs = await customer.as.query(api.bookings.listMessages, { bookingId: b });
    expect(msgs).toHaveLength(2);
    expect(msgs[0].body).toBe("hello");
    expect(msgs[0].senderRole).toBe("customer");
    expect(msgs[1].senderRole).toBe("worker");
    expect(msgs[1].body).toHaveLength(1000);
  });
});

describe("bookings:accept", () => {
  it("requires a verified credential", async () => {
    const t = setupTest();
    const w = await seedWorker(t);
    await seedArtisan(t, w.id, { quizPassed: false, kycStatus: "verified" });
    const c = await seedCustomer(t);
    const b = await seedBooking(t, c.id, { trade: "electrician" });

    await expect(w.as.mutation(api.bookings.accept, { id: b })).rejects.toThrow(
      "Verified credential required",
    );
  });

  it("refuses when the worker has no artisan profile", async () => {
    const t = setupTest();
    const w = await seedWorker(t);
    const c = await seedCustomer(t);
    const b = await seedBooking(t, c.id);
    await expect(w.as.mutation(api.bookings.accept, { id: b })).rejects.toThrow(
      "Verified credential required",
    );
  });

  it("refuses a signed-out caller", async () => {
    const t = setupTest();
    const w = await seedWorker(t);
    await seedArtisan(t, w.id);
    const c = await seedCustomer(t);
    const b = await seedBooking(t, c.id);
    await expect(t.mutation(api.bookings.accept, { id: b })).rejects.toThrow("Not authenticated");
  });

  it("assigns the worker and carries their UPI id onto the booking", async () => {
    const t = setupTest();
    const w = await seedWorker(t);
    const artisan = await seedArtisan(t, w.id, {
      trade: "electrician",
      quizPassed: true,
      kycStatus: "verified",
      upiVpa: "ramesh@upi",
    });
    const c = await seedCustomer(t);
    const b = await seedBooking(t, c.id, { trade: "electrician" });

    await w.as.mutation(api.bookings.accept, { id: b });
    const row = must(await t.run((ctx) => ctx.db.get(b)), "booking");
    expect(row.status).toBe("accepted");
    expect(row.workerId).toBe(artisan);
    expect(row.workerUserId).toBe(w.id);
    expect(row.workerVpa).toBe("ramesh@upi");
    expect(row.acceptedAt).toBeGreaterThan(0);
  });

  it("refuses to accept a job that is no longer pending", async () => {
    const t = setupTest();
    const w = await seedWorker(t);
    await seedArtisan(t, w.id, { quizPassed: true, kycStatus: "verified" });
    const c = await seedCustomer(t);
    const b = await seedBooking(t, c.id, { status: "accepted" });
    await expect(w.as.mutation(api.bookings.accept, { id: b })).rejects.toThrow(
      "No longer available",
    );
  });
});

describe("bookings:advance", () => {
  it("refuses a signed-out caller and a non-owner", async () => {
    const t = setupTest();
    const w = await seedWorker(t);
    const artisan = await seedArtisan(t, w.id);
    const c = await seedCustomer(t);
    const b = await seedBooking(t, c.id, {
      status: "accepted",
      workerId: artisan,
      workerUserId: w.id,
    });

    await expect(t.mutation(api.bookings.advance, { id: b })).rejects.toThrow(
      "Not authenticated",
    );
    await expect(c.as.mutation(api.bookings.advance, { id: b })).rejects.toThrow("Not your job");
  });

  it("walks the lifecycle one stage at a time and stamps settledAt", async () => {
    const t = setupTest();
    const w = await seedWorker(t);
    const artisan = await seedArtisan(t, w.id);
    const c = await seedCustomer(t);
    const b = await seedBooking(t, c.id, {
      status: "accepted",
      workerId: artisan,
      workerUserId: w.id,
    });

    expect(await w.as.mutation(api.bookings.advance, { id: b })).toBe("enroute");
    expect(await w.as.mutation(api.bookings.advance, { id: b })).toBe("inprogress");
    expect(await w.as.mutation(api.bookings.advance, { id: b })).toBe("payment");
    expect(await w.as.mutation(api.bookings.advance, { id: b })).toBe("completed");
    expect(await w.as.mutation(api.bookings.advance, { id: b })).toBe("settled");
    expect(must(await t.run((ctx) => ctx.db.get(b)), "booking").settledAt).toBeGreaterThan(0);
  });

  it("refuses to advance a cancelled booking", async () => {
    const t = setupTest();
    const w = await seedWorker(t);
    const artisan = await seedArtisan(t, w.id);
    const c = await seedCustomer(t);
    const b = await seedBooking(t, c.id, {
      status: "cancelled",
      workerId: artisan,
      workerUserId: w.id,
    });
    await expect(w.as.mutation(api.bookings.advance, { id: b })).rejects.toThrow(
      "Cannot advance from cancelled",
    );
  });
});

describe("bookings:confirmUtr", () => {
  it("only the customer can confirm payment", async () => {
    const t = setupTest();
    const c = await seedCustomer(t);
    const w = await seedWorker(t);
    const artisan = await seedArtisan(t, w.id);
    const b = await seedBooking(t, c.id, {
      status: "payment",
      workerId: artisan,
      workerUserId: w.id,
    });
    await expect(
      w.as.mutation(api.bookings.confirmUtr, { id: b, utr: "UTR123456" }),
    ).rejects.toThrow("Not your booking");
  });

  it("requires the booking to be awaiting payment", async () => {
    const t = setupTest();
    const c = await seedCustomer(t);
    const b = await seedBooking(t, c.id, { status: "accepted" });
    await expect(
      c.as.mutation(api.bookings.confirmUtr, { id: b, utr: "UTR123456" }),
    ).rejects.toThrow("Not awaiting payment");
  });

  it("requires at least 6 characters of reference", async () => {
    const t = setupTest();
    const c = await seedCustomer(t);
    const b = await seedBooking(t, c.id, { status: "payment" });
    await expect(c.as.mutation(api.bookings.confirmUtr, { id: b, utr: " 123 " })).rejects.toThrow(
      "valid UTR",
    );
  });

  it("completes the booking and credits the 7% welfare share to the worker", async () => {
    const t = setupTest();
    const c = await seedCustomer(t);
    const w = await seedWorker(t);
    const artisan = await seedArtisan(t, w.id, { welfareBalance: 100 });
    const b = await seedBooking(t, c.id, {
      status: "payment",
      workerId: artisan,
      workerUserId: w.id,
      welfareAmt: 70,
    });

    await c.as.mutation(api.bookings.confirmUtr, { id: b, utr: "  UTR123456  " });
    const row = must(await t.run((ctx) => ctx.db.get(b)), "booking");
    expect(row.status).toBe("completed");
    expect(row.utr).toBe("UTR123456");
    expect(row.paidAt).toBeGreaterThan(0);
    expect(must(await t.run((ctx) => ctx.db.get(artisan)), "artisan").welfareBalance).toBe(170);
  });
});

describe("bookings:cancel", () => {
  it("refuses a member with no relationship to the booking", async () => {
    const t = setupTest();
    const c = await seedCustomer(t);
    const stranger = await seedCustomer(t, { email: "s@x.com" });
    const b = await seedBooking(t, c.id);
    await expect(
      stranger.as.mutation(api.bookings.cancel, { id: b, by: "customer" }),
    ).rejects.toThrow("Not allowed");
  });

  it("records who cancelled", async () => {
    const t = setupTest();
    const c = await seedCustomer(t);
    const b = await seedBooking(t, c.id);
    await c.as.mutation(api.bookings.cancel, { id: b, by: "customer" });
    const row = must(await t.run((ctx) => ctx.db.get(b)), "booking");
    expect(row.status).toBe("cancelled");
    expect(row.cancelBy).toBe("customer");
    expect(row.cancelledAt).toBeGreaterThan(0);
  });

  it("labels an override as admin even when the caller passes their own role", async () => {
    const t = setupTest();
    const c = await seedCustomer(t);
    const admin = await seedAdmin(t);
    const b = await seedBooking(t, c.id, { status: "accepted" });
    await admin.as.mutation(api.bookings.cancel, { id: b, by: "customer" });
    expect(must(await t.run((ctx) => ctx.db.get(b)), "booking").cancelBy).toBe("admin");
  });

  it("refuses to cancel a closed booking", async () => {
    const t = setupTest();
    const c = await seedCustomer(t);
    for (const status of ["completed", "settled", "cancelled"]) {
      const b = await seedBooking(t, c.id, { status });
      await expect(c.as.mutation(api.bookings.cancel, { id: b, by: "customer" })).rejects.toThrow(
        "no longer be cancelled",
      );
    }
  });
});
