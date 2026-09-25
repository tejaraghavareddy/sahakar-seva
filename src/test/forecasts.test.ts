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

const snapshot = {
  kind: "forecast",
  district: "all",
  demandIndex: 72,
  primaryDeficitTrades: ["mason"],
  priceRecommendation: "₹900/day floor",
  welfarePoolAllocation: 9,
  advisories: ["Recruit masons in Kurnool"],
  summary: "Demand is up.",
  topTrade: "electrician",
  topTradeReason: "Monsoon short circuits.",
  fairRatePerHour: 240,
  confidence: 78,
  source: "heuristic",
};

describe("forecasts:save", () => {
  it("is admin-only", async () => {
    const t = setupTest();
    await expect(t.mutation(api.forecasts.save, snapshot)).rejects.toThrow("Not authenticated");
    const c = await seedCustomer(t);
    await expect(c.as.mutation(api.forecasts.save, snapshot)).rejects.toThrow("Forbidden");
  });

  it("stores the snapshot against the officer", async () => {
    const t = setupTest();
    const a = await seedAdmin(t);
    const id = await a.as.mutation(api.forecasts.save, snapshot);
    const row = must(await t.run((ctx) => ctx.db.get(id)), "forecast");
    expect(row.demandIndex).toBe(72);
    expect(row.advisories).toEqual(["Recruit masons in Kurnool"]);
    expect(row.createdBy).toBe(a.id);
    expect(row.createdAt).toBeGreaterThan(0);
  });
});

describe("forecasts:publicLatest", () => {
  it("is readable with no session", async () => {
    const t = setupTest();
    const card = await t.query(api.forecasts.publicLatest);
    expect(card.topTrade).toBe("electrician");
    expect(card.fairRatePerHour).toBeTypeOf("number");
    expect(card.confidence).toBeTypeOf("number");
    expect(card.source).toBe("default");
    expect(Number.isFinite(card.fairRatePerHour)).toBe(true);
  });

  it("uses the newest complete snapshot when one exists", async () => {
    const t = setupTest();
    const a = await seedAdmin(t);
    // An incomplete snapshot must not be surfaced with NaN.
    await a.as.mutation(api.forecasts.save, {
      kind: "forecast",
      district: "all",
      demandIndex: 10,
      primaryDeficitTrades: [],
      priceRecommendation: "x",
      welfarePoolAllocation: 8,
      advisories: [],
      source: "heuristic",
    });
    expect((await t.query(api.forecasts.publicLatest)).source).toBe("default");

    await a.as.mutation(api.forecasts.save, snapshot);
    const card = await t.query(api.forecasts.publicLatest);
    expect(card.source).toBe("heuristic");
    expect(card.topTrade).toBe("electrician");
    expect(card.fairRatePerHour).toBe(240);
    expect(card.confidence).toBe(78);
  });
});

describe("forecasts:latest / history", () => {
  it("are admin-only and return null / [] for everyone else", async () => {
    const t = setupTest();
    await expect(t.query(api.forecasts.latest)).rejects.toThrow("Not authenticated");
    await expect(t.query(api.forecasts.history)).rejects.toThrow("Not authenticated");

    const c = await seedCustomer(t);
    expect(await c.as.query(api.forecasts.latest)).toBeNull();
    expect(await c.as.query(api.forecasts.history)).toBeNull();
  });

  it("returns the newest snapshot and up to 12 in history", async () => {
    const t = setupTest();
    const a = await seedAdmin(t);
    for (let i = 0; i < 14; i++) {
      await a.as.mutation(api.forecasts.save, { ...snapshot, demandIndex: i });
    }
    expect(must(await a.as.query(api.forecasts.latest), "latest").demandIndex).toBe(13);
    const history = must(await a.as.query(api.forecasts.history), "history");
    expect(history).toHaveLength(12);
    expect(history[0].demandIndex).toBe(13);
  });
});

describe("gis:mapData", () => {
  it("is admin-only", async () => {
    const t = setupTest();
    await expect(t.query(api.gis.mapData)).rejects.toThrow("Not authenticated");
    const c = await seedCustomer(t);
    await expect(c.as.query(api.gis.mapData)).rejects.toThrow("Forbidden");
  });

  it("returns workers, active demand, societies and heatmap points", async () => {
    const t = setupTest();
    const a = await seedAdmin(t);
    const w = await seedWorker(t);
    await seedArtisan(t, w.id, { fullName: "Ramesh", isOnline: true, lat: 15.8, lng: 78.0 });
    await seedArtisan(t, (await seedWorker(t)).id, {
      fullName: "Removed",
      removedAt: Date.now(),
      lat: 16.0,
      lng: 78.5,
    });
    const customer = await seedCustomer(t);
    await seedBooking(t, customer.id, { status: "inprogress", lat: 15.9, lng: 78.1 });
    await seedBooking(t, customer.id, { status: "settled", lat: 15.7, lng: 77.9 });
    await seedBooking(t, customer.id, {
      status: "pending",
      lat: undefined,
      lng: undefined,
    });

    const map = await a.as.query(api.gis.mapData);
    expect(map.artisans).toHaveLength(1);
    expect(map.artisans[0].fullName).toBe("Ramesh");
    expect(map.bookings).toHaveLength(1);
    expect(map.bookings[0].status).toBe("inprogress");
    // The booking with no coordinates is excluded from the heatmap too.
    expect(map.demandPoints).toHaveLength(2);
    expect(map.societies).toEqual([]);
  });
});

describe("gis:radar", () => {
  it("refuses a signed-out caller and hides the booking from a stranger", async () => {
    const t = setupTest();
    const c = await seedCustomer(t);
    const stranger = await seedCustomer(t, { email: "s@x.com" });
    const b = await seedBooking(t, c.id);
    await expect(t.query(api.gis.radar, { bookingId: b })).rejects.toThrow("Not authenticated");
    expect(await stranger.as.query(api.gis.radar, { bookingId: b })).toBeNull();
  });

  it("shows the customer the destination with no worker until one is assigned", async () => {
    const t = setupTest();
    const c = await seedCustomer(t);
    const b = await seedBooking(t, c.id, { address: "12 Gandhi St" });
    const radar = must(await c.as.query(api.gis.radar, { bookingId: b }), "radar");
    expect(radar.booking.address).toBe("12 Gandhi St");
    expect(radar.worker).toBeNull();
  });

  it("shows the assigned worker's live telemetry to both participants and admin", async () => {
    const t = setupTest();
    const c = await seedCustomer(t);
    const w = await seedWorker(t);
    const artisan = await seedArtisan(t, w.id, { fullName: "Ramesh", lat: 15.5, lng: 78.5 });
    const a = await seedAdmin(t);
    const b = await seedBooking(t, c.id, { workerId: artisan, workerUserId: w.id });

    for (const viewer of [c.as, w.as, a.as]) {
      const radar = must(await viewer.query(api.gis.radar, { bookingId: b }), "radar");
      expect(radar.worker?.fullName).toBe("Ramesh");
      expect(radar.worker?.lat).toBe(15.5);
    }
  });

  it("returns null for a booking that does not exist", async () => {
    const t = setupTest();
    const c = await seedCustomer(t);
    const b = await seedBooking(t, c.id);
    await t.run((ctx) => ctx.db.delete(b));
    expect(await c.as.query(api.gis.radar, { bookingId: b })).toBeNull();
  });
});

describe("gis:forecastContext", () => {
  it("is admin-only", async () => {
    const t = setupTest();
    await expect(t.query(api.gis.forecastContext)).rejects.toThrow("Not authenticated");
    const c = await seedCustomer(t);
    await expect(c.as.query(api.gis.forecastContext)).rejects.toThrow("Forbidden");
  });

  it("summarises supply vs unserviced demand per trade", async () => {
    const t = setupTest();
    const a = await seedAdmin(t);
    const w = await seedWorker(t);
    await seedArtisan(t, w.id, { trade: "electrician", isOnline: true, kycStatus: "verified" });
    await seedArtisan(t, (await seedWorker(t)).id, {
      trade: "electrician",
      isOnline: false,
      kycStatus: "pending",
    });
    await seedBooking(t, (await seedCustomer(t)).id, { trade: "electrician", status: "pending" });
    await seedBooking(t, (await seedCustomer(t)).id, {
      trade: "plumber",
      status: "settled",
      welfareAmt: 70,
    });

    const ctx = await a.as.query(api.gis.forecastContext);
    expect(ctx.perTrade.electrician).toEqual({
      artisans: 2,
      online: 1,
      verified: 1,
      unserviced: 1,
      booked24h: 1,
    });
    expect(ctx.perTrade.mason.artisans).toBe(0);
    expect(ctx.totalUnserviced).toBe(1);
    expect(ctx.totalBookings).toBe(2);
    expect(ctx.welfarePoolAccrued).toBe(70);
    expect(ctx.districts.Kurnool).toBe(2);
    expect(ctx.societiesActive).toBe(0);
  });
});
