import { useCallback, useEffect, useState } from "react";
import { getAccuratePosition, reverseGeocode } from "@/lib/geo";

export interface DetectedLocation {
  label: string;
  lat: number;
  lng: number;
  accuracy?: number;
  /** Structured address parts from reverse geocoding (best effort). */
  area?: string;
  city?: string;
  district?: string;
  state?: string;
  pincode?: string;
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
    getAccuratePosition(10000)
      .then(async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const g = await reverseGeocode(latitude, longitude);
        const next: DetectedLocation = {
          label:
            g.address ||
            `${latitude.toFixed(5)}° N, ${longitude.toFixed(5)}° E`,
          lat: latitude,
          lng: longitude,
          accuracy: Math.round(accuracy),
          area: g.area,
          city: g.city,
          district: g.district,
          state: g.state,
          pincode: g.pincode,
        };
        persist(next);
        setLocation(next);
      })
      .catch(() => {
        if (!silent) {
          persist(FALLBACK);
          setLocation(FALLBACK);
        }
      });
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