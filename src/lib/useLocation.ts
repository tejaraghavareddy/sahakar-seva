import { useCallback, useEffect, useRef, useState } from "react";
import {
  getAccuratePosition,
  reverseGeocode,
  classifyAccuracy,
  GeolocationError,
  type FixQuality,
} from "@/lib/geo";

/** Where a location came from. Drives the wording shown to the member. */
export type LocationSource = "gps" | "manual" | "fallback";

export interface DetectedLocation {
  label: string;
  lat: number;
  lng: number;
  /** Reported GPS accuracy in metres. Absent for the fallback, which has none. */
  accuracy?: number;
  /** When the fix was taken (epoch ms). Absent for the fallback. */
  at?: number;
  /**
   * Where this came from. Optional at the type level so the map pickers can
   * hand over a plain point; {@link normalizeLocation} fills the defaults.
   */
  source?: LocationSource;
  /** Trust level, derived from `accuracy` when not supplied. */
  quality?: FixQuality;
  /** Structured address parts from reverse geocoding (best effort). */
  area?: string;
  city?: string;
  district?: string;
  state?: string;
  pincode?: string;
}

/** Fill in provenance for a hand-built location (map pickers, tests). */
export function normalizeLocation(loc: DetectedLocation): DetectedLocation {
  const source: LocationSource = loc.source ?? "gps";
  return {
    ...loc,
    source,
    quality: qualityOf({ ...loc, source }),
  };
}

const KEY = "ss_location_v1";
/** A stored fix older than this is refreshed rather than trusted. */
export const STALE_AFTER_MS = 30 * 60 * 1000;

/**
 * Kurnool placeholder so the app is usable before the member shares a
 * location. It is explicitly NOT a fix: no accuracy, no timestamp, and the UI
 * says "approximate". Presenting a hard-coded coordinate as "your location"
 * with a confident accuracy figure is how the app ends up telling a customer
 * in Warangal that they are in Kurnool.
 */
const FALLBACK: DetectedLocation = {
  label: "Kurnool, Onole Main Road, Ram Nagar, Kurnool – 518002",
  lat: 15.73396,
  lng: 78.05795,
  source: "fallback",
  quality: "none",
};

export function readStoredLocation(): DetectedLocation {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DetectedLocation>;
      // Tolerate the pre-source shape written by earlier builds.
      const source: LocationSource = parsed.source ?? "gps";
      if (
        typeof parsed.lat === "number" &&
        typeof parsed.lng === "number" &&
        Number.isFinite(parsed.lat) &&
        Number.isFinite(parsed.lng)
      ) {
        return {
          label: parsed.label ?? FALLBACK.label,
          lat: parsed.lat,
          lng: parsed.lng,
          accuracy: parsed.accuracy,
          at: parsed.at,
          source,
          quality: qualityOf({
            label: parsed.label ?? FALLBACK.label,
            lat: parsed.lat,
            lng: parsed.lng,
            accuracy: parsed.accuracy,
            source,
          }),
          area: parsed.area,
          city: parsed.city,
          district: parsed.district,
          state: parsed.state,
          pincode: parsed.pincode,
        };
      }
    }
  } catch {
    /* ignore */
  }
  return FALLBACK;
}

function persist(loc: DetectedLocation) {
  try {
    localStorage.setItem(KEY, JSON.stringify(loc));
  } catch {
    /* ignore */
  }
}

/** Is the stored fix too old to trust for "where am I right now"? */
export function isStale(loc: DetectedLocation, now = Date.now()): boolean {
  if (loc.source === "fallback") return true;
  if (!loc.at) return true;
  return now - loc.at > STALE_AFTER_MS;
}

/** Trust level of a location, deriving it when not already recorded. */
export function qualityOf(loc: DetectedLocation): FixQuality {
  if (loc.source === "fallback") return "none";
  // A point the member placed by hand on the map is deliberate and exact to
  // the map — it carries no GPS accuracy, but it is not an unreliable fix, so
  // it must never be shown with the "set your location" warning.
  if (loc.source === "manual") return loc.quality ?? "precise";
  return loc.quality ?? classifyAccuracy(loc.accuracy);
}

/** A readable reason a location attempt failed, or null. */
export function locationErrorMessage(e: unknown): string {
  if (e instanceof GeolocationError) {
    switch (e.code) {
      case "denied":
        return "Location permission denied. Allow it in your browser, or pick your area on the map.";
      case "timeout":
        return "GPS took too long. Try again outdoors, or pick your area on the map.";
      case "no-fix":
        return "Could not get a reliable GPS fix. Pick your area on the map instead.";
      default:
        return "Location is unavailable on this device. Pick your area on the map instead.";
    }
  }
  return "Could not detect your location. Pick your area on the map instead.";
}

/** Detected GPS location shared by the landing header and portals. */
export function useDetectedLocation() {
  const [location, setLocation] = useState<DetectedLocation>(() =>
    normalizeLocation(readStoredLocation()),
  );
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A member who picked their own area must not have it silently replaced by a
  // slow background fix that happened to land afterwards.
  const manualRef = useRef(
    normalizeLocation(readStoredLocation()).source === "manual",
  );
  // Monotonic token: any newer request (manual or explicit) invalidates an
  // in-flight auto-detect.
  const requestRef = useRef(0);

  const detect = useCallback((silent = false) => {
    if (!("geolocation" in navigator)) {
      if (!silent) {
        setError("Location is unavailable on this device. Pick your area on the map instead.");
      }
      return;
    }
    // An explicit "detect" means the member wants the GPS again, so it lifts
    // the manual hold.
    if (!silent) manualRef.current = false;

    const token = ++requestRef.current;
    if (!silent) {
      setRefreshing(true);
      setError(null);
    }

    getAccuratePosition(10000)
      .then(async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        if (token !== requestRef.current) return; // superseded
        const g = await reverseGeocode(latitude, longitude);
        if (token !== requestRef.current) return; // superseded while geocoding
        if (manualRef.current) return; // a manual pick won the race

        const next: DetectedLocation = {
          label:
            g.address ||
            `${latitude.toFixed(5)}° N, ${longitude.toFixed(5)}° E`,
          lat: latitude,
          lng: longitude,
          accuracy: Math.round(accuracy),
          at: Date.now(),
          source: "gps",
          quality: classifyAccuracy(accuracy),
          area: g.area,
          city: g.city,
          district: g.district,
          state: g.state,
          pincode: g.pincode,
        };
        persist(next);
        setLocation(next);
        if (!silent) setRefreshing(false);
      })
      .catch((e) => {
        if (token !== requestRef.current) return;
        if (!silent) {
          setRefreshing(false);
          setError(locationErrorMessage(e));
        }
      });
  }, []);

  useEffect(() => {
    // Refresh quietly on mount only when the stored fix is actually stale, and
    // never over a manual choice. Deferred to a macrotask so the effect body
    // itself performs no state update and cannot cascade renders.
    if (manualRef.current) return;
    const stored = readStoredLocation();
    // A hand-pinned point is a deliberate choice that outlives the session,
    // so it is never silently replaced by an automatic GPS fix.
    if (stored.source === "manual") return;
    if (!isStale(normalizeLocation(stored))) return;
    const kick = setTimeout(() => detect(true), 0);
    return () => clearTimeout(kick);
  }, [detect]);

  const setManual = useCallback((loc: DetectedLocation) => {
    // Invalidate any auto-detect still in flight, then record the choice.
    requestRef.current += 1;
    manualRef.current = true;
    setRefreshing(false);
    setError(null);
    const next: DetectedLocation = normalizeLocation({
      ...loc,
      source: "manual",
      accuracy: loc.accuracy,
      at: Date.now(),
    });
    persist(next);
    setLocation(next);
  }, []);

  return { location, detect, setManual, refreshing, error, stale: isStale(location) };
}

export function formatCoords(loc: DetectedLocation): string {
  const latDir = loc.lat >= 0 ? "N" : "S";
  const lngDir = loc.lng >= 0 ? "E" : "W";
  return `${Math.abs(loc.lat).toFixed(5)}° ${latDir} ${Math.abs(loc.lng).toFixed(5)}° ${lngDir}`;
}

/**
 * Accuracy wording, honest about what we actually know.
 *
 * The old version printed "±16m accuracy" for the hard-coded Kurnool
 * placeholder — a fabricated number attached to a fabricated position. It now
 * says the location is approximate and points at the fix.
 */
export function formatAccuracy(loc: DetectedLocation): string {
  const quality = qualityOf(loc);
  if (loc.source === "fallback" || quality === "none") {
    return "Approximate — set your location";
  }
  if (loc.source === "manual") return "Pinned on map";
  if (!loc.accuracy) return "GPS ready";
  const m = Math.round(loc.accuracy);
  if (quality === "coarse") return `±${m} m — approximate`;
  if (quality === "fair") return `±${m} m`;
  return `±${m} m — precise`;
}

/** True when the UI should warn that this position is not to be trusted. */
export function isUnreliable(loc: DetectedLocation): boolean {
  const quality = qualityOf(loc);
  return loc.source === "fallback" || quality === "coarse" || quality === "none";
}
