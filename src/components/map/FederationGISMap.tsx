import { useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Tooltip,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  signalBars,
  TRADE_COLORS,
  HYD_CENTER,
  DEFAULT_ZOOM,
} from "@/lib/geo";
import { Building2, MapPin, Zap, Target } from "lucide-react";

/* ── Types ── */

interface Artisan {
  _id: string;
  fullName: string;
  trade: string;
  district: string;
  phone: string;
  lat?: number;
  lng?: number;
  isOnline: boolean;
  kycStatus: string;
  quizPassed: boolean;
  credentialId?: string;
  telemetryAt?: number;
}

interface Booking {
  _id: string;
  serviceName: string;
  trade: string;
  status: string;
  urgent: boolean;
  address: string;
  lat?: number;
  lng?: number;
  scheduledFor: number;
}

interface Society {
  _id: string;
  name: string;
  code: string;
  district: string;
  state: string;
  status: string;
  registrationNo: string;
  lat?: number;
  lng?: number;
}

interface FederationGISMapProps {
  artisans: Artisan[];
  bookings: Booking[];
  societies: Society[];
  demandPoints?: Array<{ trade: string; lat: number; lng: number; status: string }>;
  height?: string;
}

/* ── Layer toggle button ── */

function LayerToggle({
  active,
  onClick,
  icon,
  label,
  count,
  color = "emerald",
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
  color?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? `border-${color}-300 bg-${color}-50 text-${color}-800`
          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      }`}
      style={
        active && color === "emerald"
          ? { borderColor: "#a7f3d0", backgroundColor: "#ecfdf5", color: "#065f46" }
          : active && color === "rose"
            ? { borderColor: "#fecdd3", backgroundColor: "#fff1f2", color: "#9f1239" }
            : active && color === "amber"
              ? { borderColor: "#fde68a", backgroundColor: "#fffbeb", color: "#92400e" }
              : active && color === "indigo"
                ? { borderColor: "#c7d2fe", backgroundColor: "#eef2ff", color: "#3730a3" }
                : undefined
      }
    >
      {icon}
      {label}
      <span className="ml-0.5 rounded-full bg-black/5 px-1.5 py-0.5 text-[10px] font-bold">
        {count}
      </span>
    </button>
  );
}

/* ── Zoom presets (needs useMap) ── */

function ZoomPresets({
  artisans,
  bookings,
  societies,
}: {
  artisans: Artisan[];
  bookings: Booking[];
  societies: Society[];
}) {
  const map = useMap();

  function fitDispatches() {
    const pts = bookings
      .filter((b) => b.lat !== undefined && b.lng !== undefined)
      .map((b) => [b.lat!, b.lng!] as [number, number]);
    if (pts.length) {
      map.fitBounds(L.latLngBounds(pts).pad(0.2), { maxZoom: 14 });
    }
  }

  function fitArtisans() {
    const pts = artisans
      .filter((a) => a.lat !== undefined && a.lng !== undefined)
      .map((a) => [a.lat!, a.lng!] as [number, number]);
    if (pts.length) {
      map.fitBounds(L.latLngBounds(pts).pad(0.2), { maxZoom: 14 });
    }
  }

  function fitSocieties() {
    const soc = societies.find((s) => s.lat && s.lng);
    if (soc && soc.lat && soc.lng) {
      map.flyTo([soc.lat, soc.lng], 12);
    }
  }

  function fitState() {
    map.flyTo([17.5, 78.5], 7);
  }

  return (
    <div className="absolute right-2 top-2 z-10 flex flex-col gap-1">
      {[
        { label: "Dispatches", fn: fitDispatches },
        { label: "Artisans", fn: fitArtisans },
        { label: "Society HQ", fn: fitSocieties },
        { label: "State", fn: fitState },
      ].map(({ label, fn }) => (
        <button
          key={label}
          type="button"
          onClick={fn}
          className="rounded-lg border border-slate-200 bg-white/95 px-2 py-1 text-[10px] font-bold text-slate-600 shadow-sm backdrop-blur transition hover:bg-emerald-50 hover:text-emerald-700"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/* ── Main component ── */

export default function FederationGISMap({
  artisans,
  bookings,
  societies,
  demandPoints = [],
  height = "520px",
}: FederationGISMapProps) {
  const [showArtisans, setShowArtisans] = useState(true);
  const [showBookings, setShowBookings] = useState(true);
  const [showSocieties, setShowSocieties] = useState(true);
  const [showHeat, setShowHeat] = useState(false);
  const [now] = useState(() => Date.now());

  const artisansWithCoords = useMemo(
    () => artisans.filter((a) => a.lat !== undefined && a.lng !== undefined),
    [artisans],
  );
  const bookingsWithCoords = useMemo(
    () => bookings.filter((b) => b.lat !== undefined && b.lng !== undefined),
    [bookings],
  );
  const societiesWithCoords = useMemo(
    () => societies.filter((s) => s.lat !== undefined && s.lng !== undefined),
    [societies],
  );

  // Compute underserved area intensity: grid buckets of 0.03 degrees
  const heatBuckets = useMemo(() => {
    if (!showHeat || demandPoints.length === 0) return [];
    const grid: Record<string, { lat: number; lng: number; count: number; trades: Set<string> }> = {};
    for (const pt of demandPoints) {
      const gLat = Math.round(pt.lat / 0.03) * 0.03;
      const gLng = Math.round(pt.lng / 0.03) * 0.03;
      const key = `${gLat.toFixed(3)}_${gLng.toFixed(3)}`;
      if (!grid[key]) grid[key] = { lat: gLat, lng: gLng, count: 0, trades: new Set() };
      grid[key].count += 1;
      grid[key].trades.add(pt.trade);
    }
    // Underserved = demand density high + few artisans nearby
    return Object.values(grid).map((bucket) => {
      const nearbyArtisans = artisansWithCoords.filter(
        (a) => Math.abs(a.lat! - bucket.lat) < 0.04 && Math.abs(a.lng! - bucket.lng) < 0.04,
      ).length;
      const intensity = Math.min(1, bucket.count / Math.max(nearbyArtisans + 1, 1));
      return { ...bucket, intensity, nearby: nearbyArtisans };
    });
  }, [showHeat, demandPoints, artisansWithCoords]);

  // Center on first booking or society, or Hyderabad
  const center = useMemo<[number, number]>(() => {
    if (bookingsWithCoords.length) {
      return [bookingsWithCoords[0].lat!, bookingsWithCoords[0].lng!];
    }
    if (societiesWithCoords.length) {
      return [societiesWithCoords[0].lat!, societiesWithCoords[0].lng!];
    }
    return [HYD_CENTER[0], HYD_CENTER[1]];
  }, [bookingsWithCoords, societiesWithCoords]);

  return (
    <div className="space-y-3">
      {/* Layer toggles */}
      <div className="flex flex-wrap gap-2">
        <LayerToggle
          active={showArtisans}
          onClick={() => setShowArtisans(!showArtisans)}
          icon={<MapPin className="size-3.5" />}
          label="Artisans"
          count={artisansWithCoords.length}
          color="emerald"
        />
        <LayerToggle
          active={showBookings}
          onClick={() => setShowBookings(!showBookings)}
          icon={<Target className="size-3.5" />}
          label="Active Dispatches"
          count={bookingsWithCoords.length}
          color="rose"
        />
        <LayerToggle
          active={showSocieties}
          onClick={() => setShowSocieties(!showSocieties)}
          icon={<Building2 className="size-3.5" />}
          label="Societies"
          count={societiesWithCoords.length}
          color="amber"
        />
        <LayerToggle
          active={showHeat}
          onClick={() => setShowHeat(!showHeat)}
          icon={<Zap className="size-3.5" />}
          label="Demand Heat"
          count={heatBuckets.length}
          color="indigo"
        />
      </div>

      {/* Map */}
      <div
        className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs"
        style={{ height }}
      >
        <MapContainer center={center} zoom={DEFAULT_ZOOM} style={{ height: "100%", width: "100%" }} zoomControl={false} attributionControl={false}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

          <ZoomPresets artisans={artisansWithCoords} bookings={bookingsWithCoords} societies={societiesWithCoords} />

          {/* Artisan pins — color-coded by trade */}
          {showArtisans &&
            artisansWithCoords.map((a) => {
              const color = TRADE_COLORS[a.trade] ?? "#64748b";
              const sig = signalBars(a.telemetryAt);
              return (
                <CircleMarker
                  key={a._id}
                  center={[a.lat!, a.lng!]}
                  radius={a.isOnline ? 7 : 5}
                  pathOptions={{
                    color: a.isOnline ? color : "#94a3b8",
                    fillColor: a.isOnline ? color : "#cbd5e1",
                    fillOpacity: 0.85,
                    weight: a.isOnline ? 2 : 1,
                  }}
                >
                  <Tooltip className="!rounded-xl !border-slate-200 !bg-white !shadow-lg" direction="top" offset={[0, -4]}>
                    <div className="min-w-[160px] p-1.5 text-xs">
                      <p className="font-bold text-slate-900">{a.fullName}</p>
                      <p className="text-[11px] text-slate-500">
                        {a.trade} · {a.district}
                      </p>
                      <p className="text-[11px] text-slate-500">📞 {a.phone}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className={`font-semibold ${a.kycStatus === "verified" ? "text-emerald-700" : "text-amber-700"}`}>
                          {a.kycStatus === "verified" ? "✓ Verified" : "⏳ Pending"}
                        </span>
                        {a.credentialId && (
                          <span className="text-[10px] font-bold text-emerald-800">
                            {a.credentialId}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400">
                        {"📶".repeat(sig)} Signal {sig}/5
                        {a.telemetryAt
                          ? ` · Ping ${Math.round((now - a.telemetryAt) / 60_000)}m ago`
                          : " · No telemetry"}
                      </p>
                    </div>
                  </Tooltip>
                </CircleMarker>
              );
            })}

          {/* Active & pending bookings — pulsing circles */}
          {showBookings &&
            bookingsWithCoords.map((b) => {
              const isActive = ["pending", "accepted", "enroute"].includes(b.status);
              return (
                <CircleMarker
                  key={b._id}
                  center={[b.lat!, b.lng!]}
                  radius={b.urgent ? 14 : 10}
                  pathOptions={{
                    color: b.urgent ? "#e11d48" : "#059669",
                    fillColor: b.urgent ? "#fda4af" : "#a7f3d0",
                    fillOpacity: isActive ? 0.5 : 0.2,
                    weight: isActive ? 2 : 1,
                    dashArray: isActive ? undefined : "4 4",
                  }}
                >
                  <Tooltip direction="top" offset={[0, -4]}>
                    <div className="min-w-[140px] p-1.5 text-xs">
                      <p className="font-bold text-slate-900">{b.serviceName}</p>
                      <p className="text-[11px] text-slate-500">{b.status} · {b.trade}</p>
                      <p className="text-[11px] text-slate-500">{b.address.slice(0, 40)}…</p>
                      {b.urgent && (
                        <span className="mt-1 inline-block rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                          ⚡ URGENT
                        </span>
                      )}
                    </div>
                  </Tooltip>
                </CircleMarker>
              );
            })}

          {/* Society HQ markers */}
          {showSocieties &&
            societiesWithCoords.map((s) => (
              <CircleMarker
                key={s._id}
                center={[s.lat!, s.lng!]}
                radius={9}
                pathOptions={{
                  color: "#92400e",
                  fillColor: "#fef3c7",
                  fillOpacity: 0.9,
                  weight: 2,
                }}
              >
                <Tooltip direction="top" offset={[0, -4]}>
                  <div className="min-w-[160px] p-1.5 text-xs">
                    <p className="font-bold text-slate-900">🏛 {s.name}</p>
                    <p className="text-[11px] text-slate-500">
                      {s.code} · {s.district}, {s.state}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Reg: {s.registrationNo}
                    </p>
                    <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      s.status === "active" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                    }`}>
                      {s.status}
                    </span>
                  </div>
                </Tooltip>
              </CircleMarker>
            ))}

          {/* Demand heat intensity buckets */}
          {showHeat &&
            heatBuckets.map((bucket, i) => {
              const opacity = Math.max(0.15, bucket.intensity * 0.7);
              const isUnderserved = bucket.intensity > 0.6;
              return (
                <CircleMarker
                  key={i}
                  center={[bucket.lat, bucket.lng]}
                  radius={5}
                  pathOptions={{
                    color: isUnderserved ? "#e11d48" : "#f59e0b",
                    fillColor: isUnderserved ? "#e11d48" : "#f59e0b",
                    fillOpacity: opacity,
                    weight: 0,
                  }}
                >
                  <Tooltip direction="top" offset={[0, -4]}>
                    <div className="min-w-[130px] p-1.5 text-xs">
                      <p className="font-bold text-slate-900">
                        {isUnderserved ? "🔴 Underserved" : "🟡 Moderate"}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {bucket.count} bookings · {bucket.nearby} artisans nearby
                      </p>
                    </div>
                  </Tooltip>
                </CircleMarker>
              );
            })}
        </MapContainer>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 px-1 text-[11px] text-slate-500">
        <span className="flex items-center gap-1">
          <span className="inline-block size-3 rounded-full bg-amber-400" /> Electrician
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block size-3 rounded-full bg-blue-500" /> Plumber
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block size-3 rounded-full bg-amber-500" /> Carpenter
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block size-3 rounded-full bg-emerald-500" /> Mason
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block size-3 rounded-full bg-violet-500" /> Painter
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block size-3 rounded-full bg-indigo-500" /> Appliance
        </span>
      </div>
    </div>
  );
}
