import { describe, expect, it } from "vitest";
import { demandFromRain, festivalLine, upcomingFestivals } from "@/convex/weather";
import {
  setupTest,
  must,
  api,
  seedAdmin,
  seedCustomer,
  seedWorker,
  seedArtisan,
  seedBooking,
} from "./convexHarness";

describe("weather: rain → household demand", () => {
  it("treats a dry week as no weather-driven uplift", () => {
    expect(demandFromRain(0, 0).index).toBe(0);
    expect(demandFromRain(0, 0).implication).toMatch(/season/i);
  });

  it("escalates hard once the week is properly wet", () => {
    const heavy = demandFromRain(150, 6);
    expect(heavy.index).toBeGreaterThan(demandFromRain(20, 1).index);
    expect(heavy.implication).toMatch(/drain|leak|seepage/i);
  });

  it("counts wet days even when the total is modest", () => {
    // Five separate 11 mm days is a worse week for a plumber than one 50 mm
    // downpour, and a total-only rule would miss that.
    expect(demandFromRain(55, 5).index).toBe(9);
    expect(demandFromRain(55, 5).index).toBeGreaterThan(
      demandFromRain(55, 0).index,
    );
  });

  it("ignores trace rainfall", () => {
    expect(demandFromRain(0.4, 0).index).toBeLessThanOrEqual(1);
  });

  it("is monotonic in rainfall", () => {
    const inputs = [0, 2, 12, 60, 120];
    const indexes = inputs.map((mm) => demandFromRain(mm, 2).index);
    for (let i = 1; i < indexes.length; i++) {
      expect(indexes[i]).toBeGreaterThanOrEqual(indexes[i - 1]);
    }
  });
});

describe("weather: festival calendar", () => {
  it("finds nothing far from a festival", () => {
    // Mid-May is deliberately quiet in the calendar.
    const may = new Date("2026-05-15T00:00:00Z");
    expect(upcomingFestivals(may, 21).every((f) => f.weight <= 2)).toBe(true);
  });

  it("surfaces the heaviest upcoming festival first", () => {
    // Two weeks before Diwali, the biggest demand event of the year.
    const beforeDiwali = new Date("2026-10-25T00:00:00Z");
    const soon = upcomingFestivals(beforeDiwali, 21);
    expect(soon[0].name).toBe("Diwali");
    expect(soon[0].weight).toBe(5);
  });

  it("counts the distance in days", () => {
    const beforeDiwali = new Date("2026-10-25T00:00:00Z");
    const diwali = upcomingFestivals(beforeDiwali, 21).find(
      (f) => f.name === "Diwali",
    );
    expect(diwali?.inDays).toBe(14);
  });

  it("never returns a past festival", () => {
    const afterDiwali = new Date("2026-11-30T00:00:00Z");
    expect(upcomingFestivals(afterDiwali, 21).every((f) => f.inDays >= 0)).toBe(
      true,
    );
  });

  it("writes a readable one-liner for the forecast prompt", () => {
    const line = festivalLine(new Date("2026-10-25T00:00:00Z"));
    expect(line).toContain("Diwali");
    expect(line).toMatch(/demand weight/);
  });
});

describe("demand: matching supply to the forecast", () => {
  async function plumberWithSlots(
    t: ReturnType<typeof setupTest>,
    email: string,
    slots: number,
    isOnline: boolean,
  ) {
    const w = await seedWorker(t, { email });
    const id = await seedArtisan(t, w.id, {
      trade: "plumber",
      slots,
      isOnline,
    });
    return { ...w, id };
  }

  it("puts workers who are available now above everyone else", async () => {
    const t = setupTest();
    // Bit 0 = day 0, morning.
    await plumberWithSlots(t, "offline@example.com", 1, false);
    await plumberWithSlots(t, "online@example.com", 0, true);
    const a = await seedAdmin(t);

    const list = await a.as.query(api.demand.suggestWorkers, { trade: "plumber" });
    expect(list[0].fullName).toBe("Test Worker");
    expect(list[0].isOnline).toBe(true);
    expect(list[0].reason).toBe("online_now");
  });

  it("never suggests someone who cannot legally accept the job", async () => {
    const t = setupTest();
    const pending = await seedWorker(t, { email: "pending@example.com" });
    await seedArtisan(t, pending.id, { trade: "plumber", kycStatus: "pending" });
    const removed = await seedWorker(t, { email: "removed@example.com" });
    await seedArtisan(t, removed.id, { trade: "plumber", removedAt: Date.now() });
    const a = await seedAdmin(t);

    expect(
      await a.as.query(api.demand.suggestWorkers, { trade: "plumber" }),
    ).toEqual([]);
  });

  it("explains why each worker is on the list", async () => {
    const t = setupTest();
    await plumberWithSlots(t, "withslots@example.com", 1, false);
    await plumberWithSlots(t, "noslots@example.com", 0, false);
    const a = await seedAdmin(t);

    const list = await a.as.query(api.demand.suggestWorkers, { trade: "plumber" });
    const reasons = list.map((w) => w.reason).sort();
    expect(reasons).toEqual(["has_slots", "no_slots_listed"]);
  });

  it("keeps the shortlist inside one trade", async () => {
    const t = setupTest();
    const sparky = await seedWorker(t, { email: "sparky@example.com" });
    await seedArtisan(t, sparky.id, { trade: "electrician" });
    await plumberWithSlots(t, "pipe@example.com", 1, true);
    const a = await seedAdmin(t);

    const list = await a.as.query(api.demand.suggestWorkers, { trade: "plumber" });
    expect(list).toHaveLength(1);
  });

  it("is closed to non-admins", async () => {
    const t = setupTest();
    const c = await seedCustomer(t);
    await expect(
      c.as.query(api.demand.suggestWorkers, { trade: "plumber" }),
    ).rejects.toThrow(/Forbidden/);
  });

  it("tells a worker whether their own trade is the hot one", async () => {
    const t = setupTest();
    const w = await seedWorker(t, { email: "plumber@example.com" });
    await seedArtisan(t, w.id, { trade: "plumber" });
    const a = await seedAdmin(t, { email: "officer@example.com" });
    await seedArtisan(t, a.id, { trade: "electrician" });

    // No forecast saved yet: nothing to report, and no crash.
    const before = await w.as.query(api.demand.myOutlook, {});
    expect(before?.outlook.expectedDemand).toBe("normal");

    await t.run(async (ctx) => {
      await ctx.db.insert("forecasts", {
        kind: "forecast",
        district: "Kurnool",
        demandIndex: 82,
        primaryDeficitTrades: ["plumber", "mason"],
        priceRecommendation: "hold",
        welfarePoolAllocation: 10,
        advisories: [],
        summary: "Wet week ahead.",
        source: "gemini",
        topTrade: "plumber",
        topTradeReason: "Heavy rainfall expected; drain clearing will dominate.",
        createdBy: a.id,
        createdAt: Date.now(),
      });
    });

    const after = await w.as.query(api.demand.myOutlook, {});
    expect(after?.outlook.isTopTrade).toBe(true);
    expect(after?.outlook.expectedDemand).toBe("high");
    expect(after?.outlook.reason).toMatch(/rainfall/i);
  });

  it("reports a worker's own completed work in their trade", async () => {
    const t = setupTest();
    const w = await seedWorker(t, { email: "plumber@example.com" });
    const artisanId = await seedArtisan(t, w.id, { trade: "plumber" });
    const c = await seedCustomer(t, { email: "buyer@example.com" });
    await seedBooking(t, c.id, {
      trade: "plumber",
      status: "settled",
      workerId: artisanId,
      workerUserId: w.id,
    });
    await seedBooking(t, c.id, { trade: "painter", status: "settled" });

    const outlook = await w.as.query(api.demand.myOutlook, {});
    expect(outlook?.completedJobs).toBe(1);
  });

  it("returns null for a member with no worker profile", async () => {
    const t = setupTest();
    const c = await seedCustomer(t);
    expect(await c.as.query(api.demand.myOutlook, {})).toBeNull();
    expect(must).toBeDefined();
  });
});
