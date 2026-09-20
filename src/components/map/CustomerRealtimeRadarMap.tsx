import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Polyline, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  haversine,
  formatDistance,
  estimateEtaMinutes,
  TRADE_COLORS,
  DEFAULT_ZOOM,
} from "@/lib/geo";

/* SVG icons for the radar rendered via CircleMarker only. */

interface RadarWorker {
  lat: number;
  lng: number;
  name: string;
  trade: string;
  telemetryAt?: number;
}

interface CustomerRadarMapProps {
  customerLat: number;
  customerLng: number;
  worker: RadarWorker | null;
  trade?: string;
  height?: string;
}

/** Fit bounds to show both markers. */
function FitBounds({ cLat, cLng, wLat, wLng }: { cLat: number; cLng: number; wLat: number; wLng: number }) {
  const map = useMap();
  useEffect(() => {
    const bounds = L.latLngBounds([cLat, cLng], [wLat, wLng]);
    map.fitBounds(bounds.pad(0.3), { maxZoom: 16, animate: false });
  }, [cLat, cLng, wLat, wLng, map]);
  return null;
}

export default function CustomerRealtimeRadarMap({
  customerLat,
  customerLng,
  worker,
  trade = "electrician",
  height = "300px",
}: CustomerRadarMapProps) {
  const [simProgress, setSimProgress] = useState(0);
  const workerDist = worker ? haversine(worker.lat, worker.lng, customerLat, customerLng) : 0;
  const workerEta = worker ? estimateEtaMinutes(workerDist) : 0;

  // Simulate smooth interpolation toward destination
  useEffect(() => {
    if (!worker) return;
    const id = setInterval(() => {
      setSimProgress((p) => (p < 0.92 ? p + 0.04 : p));
    }, 1000);
    return () => clearInterval(id);
  }, [worker]);



  const displayWorker = useMemo(() => {
    if (!worker) return null;
    // Interpolate between worker's real position and destination for smooth animation
    const lat = worker.lat + (customerLat - worker.lat) * simProgress;
    const lng = worker.lng + (customerLng - worker.lng) * simProgress;
    return { ...worker, lat, lng };
  }, [worker, customerLat, customerLng, simProgress]);

  const center: [number, number] = displayWorker
    ? [(displayWorker.lat + customerLat) / 2, (displayWorker.lng + customerLng) / 2]
    : [customerLat, customerLng];

  const workerColor = TRADE_COLORS[trade] ?? "#1e293b";

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
      <div style={{ height, width: "100%" }}>
        <MapContainer center={center} zoom={DEFAULT_ZOOM} style={{ height: "100%", width: "100%" }} zoomControl={false} attributionControl={false}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {displayWorker && (
            <FitBounds cLat={customerLat} cLng={customerLng} wLat={displayWorker.lat} wLng={displayWorker.lng} />
          )}
          {/* Customer destination marker */}
          <CircleMarker
            center={[customerLat, customerLng]}
            radius={16}
            pathOptions={{ color: "#059669", fillColor: "#059669", fillOpacity: 0.15, weight: 3 }}
          >
            <Tooltip permanent direction="top" offset={[0, -10]} className="!rounded-xl !border-emerald-200 !bg-emerald-50 !text-xs !font-bold !text-emerald-800">
              🏠 You
            </Tooltip>
          </CircleMarker>

          {/* Worker marker */}
          {displayWorker && (
            <>
              <CircleMarker
                center={[displayWorker.lat, displayWorker.lng]}
                radius={20}
                pathOptions={{ color: workerColor, fillColor: workerColor, fillOpacity: 0.1, weight: 2, dashArray: "4 4" }}
              />
              <CircleMarker
                center={[displayWorker.lat, displayWorker.lng]}
                radius={6}
                pathOptions={{ color: workerColor, fillColor: workerColor, fillOpacity: 0.9, weight: 2 }}
              >
                <Tooltip direction="top" offset={[0, -8]} className="!rounded-xl !border-slate-200 !bg-slate-900 !text-xs !font-bold !text-white">
                  🛵 {displayWorker.name}
                </Tooltip>
              </CircleMarker>
            </>
          )}

          {/* Polyline */}
          {displayWorker && (
            <Polyline
              positions={[
                [displayWorker.lat, displayWorker.lng],
                [customerLat, customerLng],
              ]}
              pathOptions={{ color: "#059669", weight: 2, dashArray: "8 6", opacity: 0.7 }}
            />
          )}
        </MapContainer>
      </div>

      {/* Info chips */}
      {worker && (
        <div className="flex items-center gap-2 border-t border-slate-200 px-4 py-2.5">
          <span className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
            🛵 {worker.name}
          </span>
          <span className="text-[11px] text-slate-500">
            {formatDistance(workerDist)} away
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
            ETA ~{workerEta} min
          </span>
        </div>
      )}
    </div>
  );
}
