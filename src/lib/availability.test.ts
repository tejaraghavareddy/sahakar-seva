import { describe, expect, it } from "vitest";
import {
  computeTradeAvailability,
  serviceAvailability,
  SERVICE_RADIUS_M,
  type AvailabilityArtisan,
} from "./availability";
import { estimateEtaMinutes, formatDistance } from "./geo";

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
    expect(m.get("plumber")).toEqual({ count: 1, outOfRange: 0, nearestM: null });
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
    const m = computeTradeAvailability([NEARBY, NEARBY], ORIGIN);
    const e = m.get("plumber");
    expect(e?.count).toBe(2);
    expect(e?.nearestM).toBeGreaterThan(2_000);
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
    expect(m.get("plumber")).toEqual({ count: 1, outOfRange: 0, nearestM: null });
    expect(m.get("electrician")?.count).toBe(2);
    expect(m.get("electrician")?.nearestM).not.toBeNull();
    expect(m.has("carpenter")).toBe(false);
  });
});

describe("dispatch radius", () => {
  it("never advertises a worker beyond the service radius", () => {
    // ~190.7 km away — the exact case reported as "191 km away · ~523 min arrival".
    const farAway: AvailabilityArtisan = {
      trade: "plumber",
      kycStatus: "verified",
      lat: 17.45,
      lng: 78.15,
    };
    const m = computeTradeAvailability([farAway], ORIGIN);
    const e = m.get("plumber");
    expect(e?.count).toBe(0);
    expect(e?.outOfRange).toBe(1);
    // No distance at all, so no pill can be built from it.
    expect(e?.nearestM).toBeNull();

    const a = serviceAvailability(m, "plumber", false);
    expect(a.artisanCount).toBe(0);
    expect(a.distM).toBeNull();
    expect(a.etaM).toBeNull();
    expect(a.outOfRange).toBe(1);
  });

  it("keeps a reachable worker even when a far one is also registered", () => {
    const farAway: AvailabilityArtisan = {
      trade: "plumber",
      kycStatus: "verified",
      lat: 17.45,
      lng: 78.15,
    };
    const m = computeTradeAvailability([farAway, NEARBY], ORIGIN);
    const a = serviceAvailability(m, "plumber", false);
    expect(a.artisanCount).toBe(1);
    expect(a.outOfRange).toBe(1);
    expect(a.distM).toBeLessThan(SERVICE_RADIUS_M);
    expect(a.etaM).toBe(estimateEtaMinutes(a.distM!));
  });

  it("the pill can only ever describe a trip under the radius", () => {
    const m = computeTradeAvailability(
      [
        { trade: "plumber", kycStatus: "verified", lat: 17.45, lng: 78.15 },
        NEARBY,
      ],
      ORIGIN,
    );
    const a = serviceAvailability(m, "plumber", false);
    if (a.distM !== null) {
      expect(formatDistance(a.distM)).not.toMatch(/^\d{3,} km/);
      expect(a.etaM!).toBeLessThan(200);
    }
  });

  it("accepts a custom radius", () => {
    const m = computeTradeAvailability([NEARBY], ORIGIN, 1_000);
    expect(m.get("plumber")?.count).toBe(0);
    expect(m.get("plumber")?.outOfRange).toBe(1);
  });
});

describe("serviceAvailability", () => {
  it("returns all-null while loading so no pills render", () => {
    const a = serviceAvailability(new Map(), "plumber", true);
    expect(a).toEqual({ artisanCount: null, outOfRange: 0, distM: null, etaM: null });
  });

  it("reports 0 with no distance for a trade with no verified artisans", () => {
    const a = serviceAvailability(new Map(), "plumber", false);
    expect(a).toEqual({ artisanCount: 0, outOfRange: 0, distM: null, etaM: null });
  });

  it("pairs the nearest distance with the standard ETA for stocked trades", () => {
    const avail = computeTradeAvailability([NEARBY], ORIGIN);
    const a = serviceAvailability(avail, "plumber", false);
    expect(a.artisanCount).toBe(1);
    expect(a.distM).not.toBeNull();
    expect(a.etaM).toBe(estimateEtaMinutes(a.distM!));
  });
});
