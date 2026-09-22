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

/**
 * Get the most accurate GPS fix available: starts with getCurrentPosition,
 * then keeps the best reading from watchPosition until accuracy ≤ 25 m
 * or the timeout expires. Much more accurate than a single fix, which is
 * often a cached low-precision network location.
 */
export function getAccuratePosition(timeoutMs = 12000): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation unsupported"));
      return;
    }
    let best: GeolocationPosition | null = null;
    let settled = false;
    const finishOk = () => {
      if (settled) return;
      settled = true;
      if (best) resolve(best);
      else reject(new Error("No GPS fix"));
    };
    const finishErr = (err: unknown) => {
      if (settled) return;
      settled = true;
      reject(err);
    };
    const consider = (p: GeolocationPosition) => {
      if (!best || p.coords.accuracy < best.coords.accuracy) best = p;
      if (best.coords.accuracy <= 25) {
        navigator.geolocation.clearWatch(watchId);
        clearTimeout(timer);
        finishOk();
      }
    };
    navigator.geolocation.getCurrentPosition(consider, finishErr, {
      enableHighAccuracy: true,
      timeout: timeoutMs,
      maximumAge: 0,
    });
    const watchId = navigator.geolocation.watchPosition(
      consider,
      () => {},
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 },
    );
    const timer = setTimeout(() => {
      navigator.geolocation.clearWatch(watchId);
      finishOk();
    }, timeoutMs);
  });
}

/** Default map center: Hyderabad, India. */
export const HYD_CENTER = [17.385, 78.4867] as const;
export const DEFAULT_ZOOM = 13;

/** Reverse geocode coordinates via Nominatim (OSM). */
export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<{ address: string; locality?: string; city?: string; pincode?: string }> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=19&addressdetails=1`,
      { headers: { "User-Agent": "SahakarSeva/1.0 (cooperative-gis)" } },
    );
    const data = await res.json();
    const a = data.address ?? {};
    const parts = [a.road, a.neighbourhood, a.suburb, a.city || a.town, a.state, a.postcode].filter(Boolean);
    return {
      address: parts.join(", ") || data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      locality: a.neighbourhood || a.suburb,
      city: a.city || a.town,
      pincode: a.postcode,
    };
  } catch {
    return { address: `${lat.toFixed(5)}, ${lng.toFixed(5)}` };
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
    return data.map((r: any) => ({
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
