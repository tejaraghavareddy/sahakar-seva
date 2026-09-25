import { describe, expect, it } from "vitest";
import { api, must, seedAdmin, seedArtisan, seedBooking, seedCustomer, seedWorker, setupTest } from "./convexHarness";

/**
 * `forecastAi:runForecast` runs with no Gemini key in CI, so it takes the
 * deterministic heuristic branch. That is exactly the path that must never
 * render NaN or crash — it is what the admin console shows without a key.
 */
describe("forecastAi:runForecast", () => {
  it("refuses a signed-out caller and a non-officer", async () => {
    const t = setupTest();
    await expect(t.action(api.forecastAi.runForecast, {})).rejects.toThrow(
      "Not authenticated",
    );
    const c = await seedCustomer(t);
    await expect(c.as.action(api.forecastAi.runForecast, {})).rejects.toThrow("Forbidden");
  });

  it("returns clamped, renderable numbers and persists a snapshot", async () => {
    const t = setupTest();
    const a = await seedAdmin(t);
    const w = await seedWorker(t);
    await seedArtisan(t, w.id, { trade: "electrician", isOnline: true, kycStatus: "verified" });
    await seedBooking(t, (await seedCustomer(t)).id, {
      trade: "electrician",
      status: "pending",
    });

    const result = await a.as.action(api.forecastAi.runForecast, {});
    expect(result.source).toBe("heuristic");
    expect(result.demandIndex).toBeGreaterThanOrEqual(1);
    expect(result.demandIndex).toBeLessThanOrEqual(100);
    expect(result.welfarePoolAllocation).toBeGreaterThanOrEqual(5);
    expect(result.welfarePoolAllocation).toBeLessThanOrEqual(15);
    expect(Number.isFinite(result.fairRatePerHour)).toBe(true);
    expect(Number.isFinite(result.confidence)).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(100);
    expect(Array.isArray(result.primaryDeficitTrades)).toBe(true);
    expect(result.actionableAdvisories.length).toBeGreaterThan(0);
    expect(result.topTrade).toBeTruthy();
    expect(result.priceRecommendation).toBeTruthy();

    const saved = must(
      await t.run((ctx) => ctx.db.get(result.id as never)),
      "forecast",
    ) as { source: string; fairRatePerHour: number; advisories: string[]; context: string };
    expect(saved.source).toBe("heuristic");
    expect(saved.fairRatePerHour).toBe(result.fairRatePerHour);
    expect(saved.advisories).toEqual(result.actionableAdvisories);
    // The stored context must be real JSON, not "[object Object]".
    expect(() => JSON.parse(String(saved.context))).not.toThrow();
  });

  it("runs the stabilization variant too", async () => {
    const t = setupTest();
    const a = await seedAdmin(t);
    const result = await a.as.action(api.forecastAi.runForecast, { kind: "stabilization" });
    expect(result.source).toBe("heuristic");
    expect(result.summary).toContain("stabilization");
    expect(Number.isFinite(result.demandIndex)).toBe(true);
  });

  it("feeds the public forecast card after it runs", async () => {
    const t = setupTest();
    const a = await seedAdmin(t);
    await a.as.action(api.forecastAi.runForecast, {});
    const card = await t.query(api.forecasts.publicLatest);
    expect(card.source).toBe("heuristic");
    expect(card.topTrade).toBeTruthy();
    expect(Number.isFinite(card.fairRatePerHour)).toBe(true);
  });

  it("handles an empty federation without dividing by zero", async () => {
    const t = setupTest();
    const a = await seedAdmin(t);
    const result = await a.as.action(api.forecastAi.runForecast, {});
    expect(Number.isFinite(result.demandIndex)).toBe(true);
    expect(Number.isFinite(result.fairRatePerHour)).toBe(true);
    expect(Number.isFinite(result.confidence)).toBe(true);
    // With no supply and no demand every trade ties, but the result must still
    // name a real trade so the landing card never renders a blank chip.
    const trades = [
      "electrician",
      "plumber",
      "carpenter",
      "mason",
      "painter",
      "appliance",
    ];
    expect(trades).toContain(result.topTrade);
    expect(result.topTradeReason).toBeTruthy();
    expect(result.primaryDeficitTrades).toEqual([]);
  });
});
