/**
 * Geospatial utilities for Sahakar Seva GIS — Haversine distance,
 * ETA estimation, bearing, and reverse geocoding via Nominatim.
 */

const EARTH_R = 6_371_000; // metres
const DEG = Math.PI / 180;

/** Haversine great-circle distance in metres. */
export function haversine(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const dLat = (lat2 - lat1) * DEG;
  const dLon = (lon2 - lon1) * DEG;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEG) * Math.cos(lat2 * DEG) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.sqrt(a));
}

/** Initial bearing from point A to point B (degrees, 0=N clockwise). */
export function bearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLon = (lon2 - lon1) * DEG;
  const y = Math.sin(dLon) * Math.cos(lat2 * DEG);
  const x = Math.cos(lat1 * DEG) * Math.sin(lat2 * DEG) -
            Math.sin(lat1 * DEG) * Math.cos(lat2 * DEG) * Math.cos(dLon);
  return ((Math.atan2(y, x) / DEG) + 360) % 360;
}

/** Format distance for display: "< 1 km" or "X.X km" or "X km". */
export function formatDistance(metres: number): string {
  if (metres < 1000) return `${Math.round(metres)} m`;
  const km = metres / 1000;
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

/**
 * Estimate travel time in minutes assuming avg urban speed of 22 km/h
 * for two-wheelers, plus a 3-minute pickup buffer.
 */
export function estimateEtaMinutes(metres: number): number {
  const hours = metres / 1_000 / 22; // 22 km/h average urban speed
  return Math.max(2, Math.round(hours * 60 + 3));
}

/** Human-readable accuracy chip text. */
export function accuracyText(metres: number): string {
  if (metres <= 10) return `±${Math.round(metres)} m — Excellent`;
  if (metres <= 50) return `±${Math.round(metres)} m GPS Precision`;
  if (metres <= 200) return `±${Math.round(metres)} m`;
  return `±${Math.round(metres / 10) * 10} m`;
}

/** How much a fix can be trusted — drives both acceptance and the UI wording. */
export type FixQuality = "precise" | "fair" | "coarse" | "none";

/** Street-level accuracy: what we aim for before stopping early. */
export const ACCURACY_GOOD_M = 25;
/** Still fine for dispatch and nearby-worker search. */
export const ACCURACY_FAIR_M = 100;
/** Block-level. Usable, but the UI must say so. */
export const ACCURACY_POOR_M = 500;
/** Worse than a district — no useful dispatch decision can be made from it. */
export const ACCURACY_REJECT_M = 2000;

/** Bucket a reported accuracy (metres) into a trust level. */
export function classifyAccuracy(accuracyM?: number): FixQuality {
  if (accuracyM === undefined || !Number.isFinite(accuracyM) || accuracyM <= 0) {
    return "none";
  }
  if (accuracyM <= ACCURACY_GOOD_M) return "precise";
  if (accuracyM <= ACCURACY_FAIR_M) return "fair";
  if (accuracyM <= ACCURACY_POOR_M) return "coarse";
  return "none";
}

/**
 * Reject fixes that are not real positions.
 *
 * A browser with no GPS lock often reports (0, 0) — "Null Island", in the
 * South Atlantic. Accepting it makes the app reverse-geocode open water,
 * show a confident nonsense address, and report "no workers near you".
 * The bounding box is generous (India plus a wide margin) and exists to catch
 * a broken provider, not to second-guess a member who travels.
 */
export function isPlausibleFix(
  lat: number,
  lng: number,
  accuracyM?: number,
): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  if (lat === 0 && lng === 0) return false; // Null Island
  if (lat < 5 || lat > 38 || lng < 66 || lng > 100) return false; // outside India + margin
  if (accuracyM !== undefined) {
    if (!Number.isFinite(accuracyM) || accuracyM <= 0) return false;
    if (accuracyM > ACCURACY_REJECT_M) return false; // useless for dispatch
  }
  return true;
}

/** Why a location request failed, so the UI can say something useful. */
export type LocationFailure = "denied" | "unavailable" | "timeout" | "no-fix";

export class GeolocationError extends Error {
  readonly code: LocationFailure;
  constructor(code: LocationFailure, message: string) {
    super(message);
    this.name = "GeolocationError";
    this.code = code;
  }
}

/**
 * Get the most accurate GPS fix available.
 *
 * Subscribes to watchPosition *first* so a good reading is never lost while
 * the one-shot getCurrentPosition is still resolving, keeps the best reading
 * until the target accuracy is reached or the budget runs out, and — the part
 * that used to be missing — releases the watcher and timer on every exit path.
 * An earlier version left the watch running after a permission denial, so the
 * device kept GPS hot for the rest of the session with nobody listening.
 */
export function getAccuratePosition(
  timeoutMs = 12000,
  targetM = ACCURACY_GOOD_M,
): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new GeolocationError("unavailable", "Geolocation unsupported"));
      return;
    }

    let best: GeolocationPosition | null = null;
    let watchId: number | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let settled = false;

    const cleanup = () => {
      if (watchId !== null) {
        try {
          navigator.geolocation.clearWatch(watchId);
        } catch {
          /* already gone */
        }
        watchId = null;
      }
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    };

    // A cached (or stubbed) geolocation source can call back synchronously —
    // i.e. before watchId/timer below are assigned — so a settle that happens
    // mid-setup would leak the watcher. Re-run cleanup after each handle is
    // handed to us; it is a no-op until something is actually registered.
    const releaseIfSettled = () => {
      if (settled) cleanup();
    };

    const succeed = () => {
      if (settled) return;
      settled = true;
      cleanup();
      if (
        best &&
        isPlausibleFix(best.coords.latitude, best.coords.longitude, best.coords.accuracy)
      ) {
        resolve(best);
      } else {
        reject(new GeolocationError("no-fix", "No usable GPS fix"));
      }
    };

    const fail = (code: LocationFailure, message: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new GeolocationError(code, message));
    };

    const consider = (p: GeolocationPosition) => {
      // Ignore junk readings outright; a bad one must never become "best".
      if (!isPlausibleFix(p.coords.latitude, p.coords.longitude, p.coords.accuracy)) {
        return;
      }
      if (!best || p.coords.accuracy < best.coords.accuracy) best = p;
      if (best.coords.accuracy <= targetM) succeed();
    };

    const onError = (err: GeolocationPositionError | null) => {
      // Permission denial and hard failures will not improve with waiting, so
      // stop immediately rather than burning the whole budget.
      const code: LocationFailure =
        err?.code === 1 ? "denied" : err?.code === 3 ? "timeout" : "unavailable";
      fail(code, err?.message || "Location unavailable");
    };

    watchId = navigator.geolocation.watchPosition(consider, onError, {
      enableHighAccuracy: true,
      timeout: timeoutMs,
      maximumAge: 0,
    });
    releaseIfSettled();
    navigator.geolocation.getCurrentPosition(consider, onError, {
      enableHighAccuracy: true,
      timeout: timeoutMs,
      maximumAge: 0,
    });
    releaseIfSettled();
    timer = setTimeout(succeed, timeoutMs);
    releaseIfSettled();
  });
}

/** Default map center: Hyderabad, India. */
export const HYD_CENTER = [17.385, 78.4867] as const;
export const DEFAULT_ZOOM = 13;

export interface ReverseGeocodeResult {
  /** Full detailed one-line address, most specific part first. */
  address: string;
  /** Named POI/feature the point sits on (e.g. a landmark or building). */
  landmark?: string;
  /** Street / road name. */
  road?: string;
  /** Neighbourhood / suburb / quarter. */
  area?: string;
  /** Village or hamlet. */
  village?: string;
  /** City or town. */
  city?: string;
  /** District (county / state_district). */
  district?: string;
  /** State. */
  state?: string;
  /** Postal (PIN) code. */
  pincode?: string;
}

/**
 * Reverse-geocode cache, keyed to 4 decimal places (~11 m — far finer than
 * any address boundary). Re-detecting in the same spot is extremely common
 * (every page mount, every manual re-check), and Nominatim is a free public
 * service with a usage policy, not something to hammer.
 */
const geocodeCache = new Map<string, ReverseGeocodeResult>();
const GEOCODE_CACHE_MAX = 50;

/** Test seam: clears the reverse-geocode cache between cases. */
export function clearGeocodeCache(): void {
  geocodeCache.clear();
}

function cacheGeocode(key: string, value: ReverseGeocodeResult) {
  if (geocodeCache.size >= GEOCODE_CACHE_MAX) {
    const oldest = geocodeCache.keys().next().value;
    if (oldest !== undefined) geocodeCache.delete(oldest);
  }
  geocodeCache.set(key, value);
}

/**
 * Reverse geocode coordinates via Nominatim (OSM), returning a detailed
 * structured address: landmark, street, area, village, town/city, district,
 * state and PIN code whenever OSM has them tagged.
 *
 * Bounded by a timeout on purpose: without one, a hanging Nominatim request
 * left the caller awaiting forever, so the coordinates were never applied and
 * the app sat on its previous location looking like a GPS failure.
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<ReverseGeocodeResult> {
  const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const cached = geocodeCache.get(cacheKey);
  if (cached) return cached;

  const fallback = { address: `${lat.toFixed(5)}, ${lng.toFixed(5)}` };
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&namedetails=1`,
      {
        headers: { "User-Agent": "SahakarSeva/1.0 (cooperative-gis)" },
        signal: AbortSignal.timeout(6000),
      },
    );
    if (!res.ok) return fallback;
    const data = await res.json();
    const a = data.address ?? {};

    const landmark = (data.name || data.namedetails?.name || "").trim() || undefined;
    const road = a.road || a.pedestrian || a.footway || undefined;
    const area = a.neighbourhood || a.suburb || a.quarter || a.city_district || undefined;
    const village = a.village || a.hamlet || undefined;
    const city = a.city || a.town || a.municipality || undefined;
    const district = a.county || a.state_district || a.district || undefined;
    const state = a.state || undefined;
    const pincode = a.postcode || undefined;

    // Build the one-line label without duplicate segments.
    const seen = new Set<string>();
    const parts = [
      landmark, road, area, village, city, district, state, pincode,
    ].filter((p): p is string => {
      if (!p) return false;
      const k = p.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    const result: ReverseGeocodeResult = {
      address: parts.length > 0 ? parts.join(", ") : fallback.address,
      landmark, road, area, village, city, district, state, pincode,
    };
    cacheGeocode(cacheKey, result);
    return result;
  } catch {
    return fallback;
  }
}

/** Forward-geocode a search query via Nominatim. */
export async function searchPlaces(
  query: string,
  limit = 5,
): Promise<Array<{ lat: number; lng: number; label: string }>> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query)}&limit=${limit}&countrycodes=in`,
      { headers: { "User-Agent": "SahakarSeva/1.0 (cooperative-gis)" } },
    );
    const data = await res.json();
    return data.map(
      (r: {
        lat: string;
        lon: string;
        display_name?: string;
        name?: string;
      }) => ({
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
      label: r.display_name || r.name || query,
    }));
  } catch {
    return [];
  }
}

/** Signal-strength bars based on telemetry ping age (0–5 bars). */
export function signalBars(telemetryAt?: number): number {
  if (!telemetryAt) return 0;
  const ageMs = Date.now() - telemetryAt;
  if (ageMs < 60_000) return 5;       // < 1 min
  if (ageMs < 5 * 60_000) return 4;   // < 5 min
  if (ageMs < 15 * 60_000) return 3;  // < 15 min
  if (ageMs < 60 * 60_000) return 2;  // < 1 hr
  return 1;
}

/** Color map for trades (GIS pin colors). */
export const TRADE_COLORS: Record<string, string> = {
  electrician: "#eab308", // yellow
  plumber: "#3b82f6",     // blue
  carpenter: "#f59e0b",   // amber
  mason: "#10b981",       // emerald
  painter: "#8b5cf6",     // violet
  appliance: "#6366f1",   // indigo
};
