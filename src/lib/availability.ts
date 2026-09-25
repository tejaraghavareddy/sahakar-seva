import { estimateEtaMinutes, haversine } from "./geo";

/**
 * Live per-trade artisan availability computed from real registered workers.
 * Extracted from Services.tsx so the counting/nearest-distance rules are
 * unit-testable and shared logic stays out of the component.
 */

/**
 * How far the cooperative will actually dispatch for a booked job. Beyond this
 * a worker is *registered* but unreachable in practice — showing "191 km away ·
 * ~523 min arrival" on a service card is worse than saying nothing, so workers
 * past this radius are counted separately and never drive the distance pill.
 */
export const SERVICE_RADIUS_M = 50_000;

export interface AvailabilityArtisan {
  trade: string;
  kycStatus: string;
  lat?: number;
  lng?: number;
}

export interface TradeAvailability {
  /** KYC-verified artisans in this trade within {@link SERVICE_RADIUS_M}. */
  count: number;
  /** Verified artisans in this trade who are too far away to dispatch. */
  outOfRange: number;
  /** Distance in metres to the nearest in-range artisan with GPS telemetry, else null. */
  nearestM: number | null;
}

export interface ServiceAvailability {
  /** null while the artisan list is still loading (pills suppressed). */
  artisanCount: number | null;
  /** Verified but undispatchable workers, so the card can say why. */
  outOfRange: number;
  distM: number | null;
  etaM: number | null;
}

/**
 * Build a per-trade availability map from registered artisans. Only
 * KYC-verified artisans count; distance uses each artisan's last GPS
 * telemetry. An artisan with no telemetry is registered but cannot be
 * positioned, so they count toward `count` without producing a distance.
 */
export function computeTradeAvailability(
  artisans: readonly AvailabilityArtisan[] | undefined,
  origin: { lat: number; lng: number },
  radiusM: number = SERVICE_RADIUS_M,
): Map<string, TradeAvailability> {
  const byTrade = new Map<string, TradeAvailability>();
  for (const a of artisans ?? []) {
    if (a.kycStatus !== "verified") continue;
    const e = byTrade.get(a.trade) ?? { count: 0, outOfRange: 0, nearestM: null };

    if (typeof a.lat !== "number" || typeof a.lng !== "number") {
      // Verified but unpositioned: registered, and still a valid crew member.
      e.count += 1;
      byTrade.set(a.trade, e);
      continue;
    }

    const d = haversine(origin.lat, origin.lng, a.lat, a.lng);
    if (d > radiusM) {
      e.outOfRange += 1;
      byTrade.set(a.trade, e);
      continue;
    }
    e.count += 1;
    if (e.nearestM === null || d < e.nearestM) e.nearestM = d;
    byTrade.set(a.trade, e);
  }
  return byTrade;
}

/**
 * Availability for one service card. While the artisan list is loading
 * (`loading: true`) every field is null so no pills render; once loaded,
 * `artisanCount` is a real number (0 when no reachable verified artisans exist).
 */
export function serviceAvailability(
  avail: Map<string, TradeAvailability>,
  trade: string,
  loading: boolean,
): ServiceAvailability {
  if (loading) return { artisanCount: null, outOfRange: 0, distM: null, etaM: null };
  const e = avail.get(trade);
  const dist = e?.nearestM ?? null;
  return {
    artisanCount: e?.count ?? 0,
    outOfRange: e?.outOfRange ?? 0,
    distM: dist,
    etaM: dist !== null ? estimateEtaMinutes(dist) : null,
  };
}
