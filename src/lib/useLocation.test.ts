// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  formatAccuracy,
  isStale,
  isUnreliable,
  normalizeLocation,
  qualityOf,
  readStoredLocation,
  type DetectedLocation,
} from "./useLocation";

const GPS: DetectedLocation = {
  label: "Kurnool",
  lat: 15.8281,
  lng: 78.0373,
  accuracy: 18,
  at: Date.now(),
  source: "gps",
};

/** A point the member pinned by hand on the map: exact, but no GPS accuracy. */
const PINNED: DetectedLocation = {
  label: "Athaganta, Kurnool",
  lat: 15.43,
  lng: 78.1,
  source: "manual",
};

const FALLBACK: DetectedLocation = {
  label: "Kurnool, Andhra Pradesh (approx.)",
  lat: 15.8281,
  lng: 78.0373,
  source: "fallback",
};

describe("qualityOf", () => {
  it("treats a hand-pinned map point as precise even with no accuracy reading", () => {
    // A pin has no GPS accuracy, but it is a deliberate choice — it must not
    // degrade to "none" and trigger the "set your location" warning.
    expect(qualityOf(PINNED)).toBe("precise");
    expect(isUnreliable(PINNED)).toBe(false);
    expect(formatAccuracy(PINNED)).toBe("Pinned on map");
  });

  it("does not fabricate an accuracy for the Kurnool fallback", () => {
    expect(qualityOf(FALLBACK)).toBe("none");
    expect(isUnreliable(FALLBACK)).toBe(true);
    expect(formatAccuracy(FALLBACK)).toBe("Approximate — set your location");
    // The old code showed a made-up "±16 m" for this point.
    expect(formatAccuracy(FALLBACK)).not.toMatch(/±/);
  });

  it("grades a coarse GPS fix by its reported accuracy", () => {
    expect(isUnreliable({ ...GPS, accuracy: 800 })).toBe(true);
    expect(isUnreliable({ ...GPS, accuracy: 60 })).toBe(false);
  });
});

describe("normalizeLocation", () => {
  it("keeps a manual pick precise instead of stamping it 'none'", () => {
    const n = normalizeLocation(PINNED);
    expect(n.quality).toBe("precise");
    expect(n.source).toBe("manual");
  });

  it("derives quality from accuracy for a GPS fix", () => {
    expect(normalizeLocation({ ...GPS, quality: undefined }).quality).toBe("precise");
  });
});

describe("readStoredLocation", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
  });

  it("re-reads a stored manual pick as precise, not as a 'none' quality", () => {
    // Simulates the shape actually written to localStorage by setManual().
    localStorage.setItem(
      "ss_location_v1",
      JSON.stringify({
        label: "Athagenta",
        lat: 15.43,
        lng: 78.1,
        source: "manual",
        at: Date.now() - 60 * 60 * 1000, // an hour old
      }),
    );
    const stored = readStoredLocation();
    expect(stored.source).toBe("manual");
    expect(stored.quality).toBe("precise");
    expect(isUnreliable(stored)).toBe(false);
  });

  it("falls back to the Kurnool point when storage holds junk", () => {
    localStorage.setItem("ss_location_v1", "{not json");
    expect(readStoredLocation().source).toBe("fallback");
  });
});

describe("isStale", () => {
  it("treats the fallback as always stale so a real fix is sought", () => {
    expect(isStale(FALLBACK)).toBe(true);
  });

  it("keeps a fresh fix", () => {
    expect(isStale({ ...GPS, at: Date.now() })).toBe(false);
  });

  it("expires a fix older than 30 minutes", () => {
    expect(isStale({ ...GPS, at: Date.now() - 31 * 60 * 1000 })).toBe(true);
  });
});
