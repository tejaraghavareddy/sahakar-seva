import { estimateEtaMinutes, haversine } from "./geo";

/**
 * Live per-trade artisan availability computed from real registered workers.
 * Extracted from Services.tsx so the counting/nearest-distance rules are
 * unit-testable and shared logic stays out of the component.
 */

export interface AvailabilityArtisan {
  trade: string;
  kycStatus: string;
  lat?: number;
  lng?: number;
}

export interface TradeAvailability {
  /** Number of KYC-verified artisans in this trade. */
  count: number;
  /** Distance in metres from the origin to the nearest artisan with GPS telemetry, else null. */
  nearestM: number | null;
}

export interface ServiceAvailability {
  /** null while the artisan list is still loading (pills suppressed). */
  artisanCount: number | null;
  distM: number | null;
  etaM: number | null;
}

/**
 * Build a per-trade availability map from registered artisans. Only
 * KYC-verified artisans count; distance uses each artisan's last GPS
 * telemetry (artisans without telemetry count toward `count` but never
 * produce a distance).
 */
export function computeTradeAvailability(
  artisans: readonly AvailabilityArtisan[] | undefined,
  origin: { lat: number; lng: number },
): Map<string, TradeAvailability> {
  const byTrade = new Map<string, TradeAvailability>();
  for (const a of artisans ?? []) {
    if (a.kycStatus !== "verified") continue;
    const e = byTrade.get(a.trade) ?? { count: 0, nearestM: null };
    e.count += 1;
    if (typeof a.lat === "number" && typeof a.lng === "number") {
      const d = haversine(origin.lat, origin.lng, a.lat, a.lng);
      if (e.nearestM === null || d < e.nearestM) e.nearestM = d;
    }
    byTrade.set(a.trade, e);
  }
  return byTrade;
}

/**
 * Availability for one service card. While the artisan list is loading
 * (`loading: true`) every field is null so no pills render; once loaded,
 * `artisanCount` is a real number (0 when no verified artisans exist).
 */
export function serviceAvailability(
  avail: Map<string, TradeAvailability>,
  trade: string,
  loading: boolean,
): ServiceAvailability {
  if (loading) return { artisanCount: null, distM: null, etaM: null };
  const e = avail.get(trade);
  const dist = e?.nearestM ?? null;
  return {
    artisanCount: e?.count ?? 0,
    distM: dist,
    etaM: dist !== null ? estimateEtaMinutes(dist) : null,
  };
}
