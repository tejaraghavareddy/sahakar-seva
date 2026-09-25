import { afterEach, describe, expect, it, vi } from "vitest";
import {
  estimateEtaMinutes,
  formatDistance,
  haversine,
  reverseGeocode,
} from "./geo";

function okJson(body: unknown) {
  return { ok: true, json: async () => body } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
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

  it("reproduces the reported pill exactly: 190.7 km → '191 km away · ~523 min arrival'", () => {
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
