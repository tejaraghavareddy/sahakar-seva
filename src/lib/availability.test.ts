import { describe, expect, it } from "vitest";
import {
  computeTradeAvailability,
  serviceAvailability,
  type AvailabilityArtisan,
} from "./availability";
import { estimateEtaMinutes } from "./geo";

/** Kurnool origin used across tests. */
const ORIGIN = { lat: 15.73396, lng: 78.05795 };

/** ~2.3 km east of ORIGIN (matching the short-trip ETA example). */
const NEARBY: AvailabilityArtisan = {
  trade: "plumber",
  kycStatus: "verified",
  lat: 15.73396,
  lng: 78.07856,
};

function artisan(partial: Partial<AvailabilityArtisan>): AvailabilityArtisan {
  return { trade: "plumber", kycStatus: "verified", ...partial };
}

describe("computeTradeAvailability", () => {
  it("returns an empty map for undefined (loading) artisan list", () => {
    const m = computeTradeAvailability(undefined, ORIGIN);
    expect(m.size).toBe(0);
  });

  it("returns an empty map when no artisans exist", () => {
    const m = computeTradeAvailability([], ORIGIN);
    expect(m.size).toBe(0);
  });

  it("counts only KYC-verified artisans", () => {
    const m = computeTradeAvailability(
      [
        artisan({ kycStatus: "verified" }),
        artisan({ kycStatus: "pending" }),
        artisan({ kycStatus: "rejected" }),
        artisan({ kycStatus: undefined }), // status field missing entirely
      ],
      ORIGIN,
    );
    expect(m.get("plumber")).toEqual({ count: 1, nearestM: null });
  });

  it("counts artisans without GPS telemetry but never gives them a distance", () => {
    const m = computeTradeAvailability(
      [artisan({ lat: undefined, lng: undefined }), artisan({})],
      ORIGIN,
    );
    expect(m.get("plumber")?.count).toBe(2);
    expect(m.get("plumber")?.nearestM).toBeNull();
  });

  it("keeps the nearest verified distance across multiple artisans", () => {
    const far: AvailabilityArtisan = {
      trade: "plumber",
      kycStatus: "verified",
      // ~55.6 km east
      lat: 15.73396,
      lng: 78.73396,
    };
    const m = computeTradeAvailability([far, NEARBY], ORIGIN);
    const e = m.get("plumber");
    expect(e?.count).toBe(2);
    expect(e?.nearestM).not.toBeNull();
    expect(e!.nearestM!).toBeGreaterThan(2_000);
    expect(e!.nearestM!).toBeLessThan(2_600);
  });

  it("tracks trades independently", () => {
    const m = computeTradeAvailability(
      [
        artisan({ trade: "plumber" }),
        artisan({ trade: "electrician", lat: 15.73, lng: 78.06 }),
        artisan({ trade: "electrician" }),
      ],
      ORIGIN,
    );
    expect(m.get("plumber")).toEqual({ count: 1, nearestM: null });
    expect(m.get("electrician")?.count).toBe(2);
    expect(m.get("electrician")?.nearestM).not.toBeNull();
    expect(m.has("carpenter")).toBe(false);
  });
});

describe("serviceAvailability", () => {
  it("returns all-null while loading so no pills render", () => {
    const a = serviceAvailability(new Map(), "plumber", true);
    expect(a).toEqual({ artisanCount: null, distM: null, etaM: null });
  });

  it("reports 0 with no distance for a trade with no verified artisans (the bug case)", () => {
    const a = serviceAvailability(new Map(), "plumber", false);
    expect(a).toEqual({ artisanCount: 0, distM: null, etaM: null });
  });

  it("pairs the nearest distance with the standard ETA for stocked trades", () => {
    const avail = computeTradeAvailability([NEARBY], ORIGIN);
    const a = serviceAvailability(avail, "plumber", false);
    expect(a.artisanCount).toBe(1);
    expect(a.distM).not.toBeNull();
    expect(a.etaM).toBe(estimateEtaMinutes(a.distM!));
  });
});
