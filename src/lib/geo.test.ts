import { afterEach, describe, expect, it, vi } from "vitest";
import {
  estimateEtaMinutes,
  formatDistance,
  haversine,
  reverseGeocode,
  classifyAccuracy,
  isPlausibleFix,
  getAccuratePosition,
  clearGeocodeCache,
  GeolocationError,
} from "./geo";

function okJson(body: unknown) {
  return { ok: true, json: async () => body } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
  // The reverse-geocode cache is module-level, so it would otherwise leak
  // between cases and mask a fetch that should have happened.
  clearGeocodeCache();
});

describe("reverseGeocode — detailed address assembly", () => {
  it("orders landmark → road → area → village → city → district → state → PIN and dedupes repeats", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        okJson({
          name: "Sri Balaji Temple",
          address: {
            road: "Temple Street",
            neighbourhood: "Balaji Nagar",
            city: "Kurnool",
            county: "Kurnool", // duplicate of city — must appear once
            state: "Andhra Pradesh",
            postcode: "518002",
          },
        }),
      ),
    );

    const r = await reverseGeocode(15.73396, 78.05795);

    expect(r.address).toBe(
      "Sri Balaji Temple, Temple Street, Balaji Nagar, Kurnool, Andhra Pradesh, 518002",
    );
    expect(r.landmark).toBe("Sri Balaji Temple");
    expect(r.road).toBe("Temple Street");
    expect(r.area).toBe("Balaji Nagar");
    expect(r.city).toBe("Kurnool");
    expect(r.district).toBe("Kurnool");
    expect(r.state).toBe("Andhra Pradesh");
    expect(r.pincode).toBe("518002");
  });

  it("still yields village-level detail when road/suburb are untagged (the old district+PIN bug)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        okJson({
          address: {
            village: "Kallur",
            county: "Kurnool",
            state: "Andhra Pradesh",
            postcode: "518002",
          },
        }),
      ),
    );

    const r = await reverseGeocode(15.74, 78.06);

    // Old code produced "Kurnool, Andhra Pradesh, 518002" — village was dropped.
    expect(r.address).toBe("Kallur, Kurnool, Andhra Pradesh, 518002");
    expect(r.village).toBe("Kallur");
    expect(r.area).toBeUndefined();
  });

  it("falls back to namedetails.name when there is no top-level name", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        okJson({
          namedetails: { name: "Ram Nagar Gate" },
          address: { city: "Kurnool", postcode: "518002" },
        }),
      ),
    );

    const r = await reverseGeocode(15.73, 78.05);

    expect(r.landmark).toBe("Ram Nagar Gate");
    expect(r.address).toBe("Ram Nagar Gate, Kurnool, 518002");
  });

  it("uses town/municipality when city is absent (common in rural OSM data)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        okJson({
          address: { town: "Dhone", county: "Kurnool", state: "Andhra Pradesh" },
        }),
      ),
    );

    const r = await reverseGeocode(15.39, 78.04);

    expect(r.city).toBe("Dhone");
    expect(r.address).toBe("Dhone, Kurnool, Andhra Pradesh");
  });

  it("returns the coordinate fallback on a non-OK response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false } as unknown as Response),
    );

    const r = await reverseGeocode(15.73396, 78.05795);

    expect(r.address).toBe("15.73396, 78.05795");
  });

  it("returns the coordinate fallback when fetch throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down")),
    );

    const r = await reverseGeocode(15.73396, 78.05795);

    expect(r.address).toBe("15.73396, 78.05795");
  });

  it("requests the detailed address payload from Nominatim", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okJson({ address: {} }));
    vi.stubGlobal("fetch", fetchMock);

    await reverseGeocode(15.73396, 78.05795);

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("addressdetails=1");
    expect(url).toContain("zoom=18");
    expect(url).toContain("format=jsonv2");
  });
});

describe("distance + ETA math behind the availability pills", () => {
  it("haversine is 0 for identical points", () => {
    expect(haversine(15.73396, 78.05795, 15.73396, 78.05795)).toBe(0);
  });

  it("haversine measures ~111.2 km per degree of longitude at the equator", () => {
    const d = haversine(0, 0, 0, 1);
    expect(Math.abs(d - 111_195)).toBeLessThan(50);
  });

  it("formats and times the 190.7 km trip that produced the reported '191 km / 523 min' pill", () => {
    // The math is correct; the pill is now unreachable because
    // availability.ts refuses to surface anyone past SERVICE_RADIUS_M.
    expect(formatDistance(190_700)).toBe("191 km");
    expect(estimateEtaMinutes(190_700)).toBe(523);
  });

  it("applies the 22 km/h urban speed and 3-minute pickup buffer to short trips", () => {
    // 2.3 km → 2.3/22 h ≈ 6.27 min + 3 → 9
    expect(estimateEtaMinutes(2_300)).toBe(9);
    // 500 m → ~1.36 min + 3 → 4
    expect(estimateEtaMinutes(500)).toBe(4);
  });

  it("formats sub-km, decimal-km and long distances", () => {
    expect(formatDistance(850)).toBe("850 m");
    expect(formatDistance(2_300)).toBe("2.3 km");
    expect(formatDistance(190_700)).toBe("191 km");
  });
});

/* ── GPS fix quality: the difference between "your location" and a guess ── */

describe("classifyAccuracy", () => {
  it("bands a reported accuracy into a trust level", () => {
    expect(classifyAccuracy(8)).toBe("precise"); // street-level
    expect(classifyAccuracy(25)).toBe("precise");
    expect(classifyAccuracy(60)).toBe("fair"); // still fine to dispatch
    expect(classifyAccuracy(300)).toBe("coarse"); // block-level, say so
    expect(classifyAccuracy(1500)).toBe("none"); // worse than a district
  });

  it("treats a missing or nonsensical accuracy as unknown", () => {
    expect(classifyAccuracy(undefined)).toBe("none");
    expect(classifyAccuracy(0)).toBe("none");
    expect(classifyAccuracy(-5)).toBe("none");
    expect(classifyAccuracy(Number.NaN)).toBe("none");
  });
});

describe("isPlausibleFix — rejects the fixes that lie", () => {
  it("accepts a real Kurnool fix", () => {
    expect(isPlausibleFix(15.83, 78.03, 12)).toBe(true);
    expect(isPlausibleFix(28.61, 77.21, 800)).toBe(true); // Delhi, coarse but real
  });

  it("rejects Null Island, which is what a device with no lock reports", () => {
    // (0,0) reverse-geocodes to open water in the South Atlantic. Accepting it
    // means a confident nonsense address and "no workers near you".
    expect(isPlausibleFix(0, 0, 20)).toBe(false);
  });

  it("rejects NaN, infinities and out-of-range coordinates", () => {
    expect(isPlausibleFix(Number.NaN, 78, 10)).toBe(false);
    expect(isPlausibleFix(15, Number.POSITIVE_INFINITY, 10)).toBe(false);
    expect(isPlausibleFix(91, 78, 10)).toBe(false);
    expect(isPlausibleFix(15, 181, 10)).toBe(false);
  });

  it("rejects a fix far outside the service area", () => {
    expect(isPlausibleFix(48.85, 2.35, 20)).toBe(false); // Paris
  });

  it("rejects a fix too coarse to dispatch on", () => {
    expect(isPlausibleFix(15.83, 78.03, 2001)).toBe(false);
    expect(isPlausibleFix(15.83, 78.03, 0)).toBe(false);
  });
});

/** A scriptable navigator.geolocation. */
function stubGeolocation(script: {
  getCurrent?: (ok: PositionCallback) => void;
  watch?: (ok: PositionCallback) => void;
  watchError?: GeolocationPositionError;
  getError?: GeolocationPositionError;
}) {
  const cleared: number[] = [];
  let watchId = 7;
  vi.stubGlobal("navigator", {
    geolocation: {
      getCurrentPosition: (ok: PositionCallback, err?: PositionErrorCallback | null) => {
        if (script.getError && err) err(script.getError);
        else script.getCurrent?.(ok);
      },
      watchPosition: (ok: PositionCallback, err?: PositionErrorCallback | null) => {
        watchId = 7;
        if (script.watchError && err) err(script.watchError);
        else script.watch?.(ok);
        return watchId;
      },
      clearWatch: (id: number) => cleared.push(id),
    },
  });
  return cleared;
}

function fix(accuracy: number, lat = 15.83, lng = 78.03) {
  return {
    coords: { accuracy, latitude: lat, longitude: lng },
    timestamp: Date.now(),
  } as unknown as GeolocationPosition;
}

const denied = { code: 1, message: "User denied Geolocation" } as GeolocationPositionError;

describe("getAccuratePosition", () => {
  it("stops at the target accuracy and releases the watcher", async () => {
    const cleared = stubGeolocation({
      watch: (ok) => {
        ok(fix(400));
        ok(fix(18)); // good enough
      },
      getCurrent: (ok) => ok(fix(300)),
    });

    const pos = await getAccuratePosition(1000);
    expect(pos.coords.accuracy).toBe(18);
    // The whole point of the fix: a denial used to leave the watch running.
    expect(cleared).toContain(7);
  });

  it("keeps the best reading when the budget runs out", async () => {
    stubGeolocation({
      watch: (ok) => ok(fix(400)),
      getCurrent: (ok) => ok(fix(120)),
    });

    const pos = await getAccuratePosition(30); // expires almost immediately
    expect(pos.coords.accuracy).toBeLessThanOrEqual(400);
  });

  it("rejects a Null Island fix instead of reporting open water", async () => {
    stubGeolocation({
      watch: (ok) => ok(fix(20, 0, 0)),
      getCurrent: (ok) => ok(fix(20, 0, 0)),
    });

    await expect(getAccuratePosition(30)).rejects.toBeInstanceOf(GeolocationError);
  });

  it("fails fast on a permission denial and still clears the watcher", async () => {
    const cleared = stubGeolocation({ watchError: denied, getError: denied });
    const err = await getAccuratePosition(5000).catch((e) => e);
    expect(err).toBeInstanceOf(GeolocationError);
    expect((err as GeolocationError).code).toBe("denied");
    expect(cleared).toContain(7);
  });
});
