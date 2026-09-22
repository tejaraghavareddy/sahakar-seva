import { useCallback, useEffect, useState } from "react";

export interface DetectedLocation {
  label: string;
  lat: number;
  lng: number;
  accuracy?: number;
}

const KEY = "ss_location_v1";
/** Kurnool fallback so the app is always usable before GPS permission. */
const FALLBACK: DetectedLocation = {
  label: "Kurnool, Onole Main Road, Ram Nagar, Kurnool – 518002",
  lat: 15.73396,
  lng: 78.05795,
  accuracy: 16,
};

export function readStoredLocation(): DetectedLocation {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as DetectedLocation;
  } catch {
    /* ignore */
  }
  return FALLBACK;
}

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { display_name?: string };
    return data.display_name ?? null;
  } catch {
    return null;
  }
}

function persist(loc: DetectedLocation) {
  try {
    localStorage.setItem(KEY, JSON.stringify(loc));
  } catch {
    /* ignore */
  }
}

/** Detected GPS location shared by the landing header and portals. */
export function useDetectedLocation() {
  const [location, setLocation] = useState<DetectedLocation>(readStoredLocation);

  const detect = useCallback((silent = false) => {
    if (!("geolocation" in navigator)) {
      if (!silent) setLocation(FALLBACK);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const label = await reverseGeocode(latitude, longitude);
        const next: DetectedLocation = {
          label:
            label ??
            `${latitude.toFixed(5)}° N, ${longitude.toFixed(5)}° E`,
          lat: latitude,
          lng: longitude,
          accuracy: Math.round(accuracy),
        };
        persist(next);
        setLocation(next);
      },
      () => {
        if (!silent) {
          persist(FALLBACK);
          setLocation(FALLBACK);
        }
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- geolocation callback is async; silent background refresh on mount
    detect(true);
  }, [detect]);

  const setManual = useCallback((loc: DetectedLocation) => {
    persist(loc);
    setLocation(loc);
  }, []);

  return { location, detect, setManual };
}

export function formatCoords(loc: DetectedLocation): string {
  const latDir = loc.lat >= 0 ? "N" : "S";
  const lngDir = loc.lng >= 0 ? "E" : "W";
  return `${Math.abs(loc.lat).toFixed(5)}° ${latDir} ${Math.abs(loc.lng).toFixed(5)}° ${lngDir}`;
}

export function formatAccuracy(loc: DetectedLocation): string {
  return loc.accuracy ? `±${loc.accuracy}m accuracy` : "GPS ready";
}
