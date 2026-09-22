import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
/* eslint-disable react-hooks/set-state-in-effect */ // All useEffects sync external Nominatim/GPS state
import {
  reverseGeocode,
  searchPlaces,
  accuracyText,
  getAccuratePosition,
  HYD_CENTER,
  DEFAULT_ZOOM,
} from "@/lib/geo";
import { Loader2, LocateFixed, Search } from "lucide-react";

/* ── Custom pulsing pin icon (no default-leaflet image assets needed) ── */

function pulseIconHtml(color = "#059669") {
  return `<div style="position:relative;width:32px;height:40px;">
    <div style="position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:14px;height:14px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 0 0 2px ${color}40;"></div>
    <div style="position:absolute;bottom:4px;left:50%;transform:translateX(-50%);width:28px;height:28px;border-radius:50%;background:${color}18;animation:pulse 2s infinite;"></div>
    <style>@keyframes pulse{0%,100%{transform:translateX(-50%) scale(1);opacity:.6}50%{transform:translateX(-50%) scale(1.3);opacity:0}}</style>
  </div>`;
}

const defaultIcon = L.divIcon({
  html: pulseIconHtml(),
  iconSize: [32, 40],
  iconAnchor: [16, 36],
  className: "",
});

export interface PickedLocation {
  lat: number;
  lng: number;
  address: string;
}

interface InteractiveMapPickerProps {
  initialLat?: number;
  initialLng?: number;
  onPick: (loc: PickedLocation) => void;
  height?: string;
}

/** Inner component that can access the map instance. */
function MapHooks({ onMoveEnd }: { onMoveEnd: (lat: number, lng: number) => void }) {
  const map = useMap();
  useMapEvents({
    click(e) {
      onMoveEnd(e.latlng.lat, e.latlng.lng);
    },
  });
  // Expose map ref for teleporting
  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__sahakarMap = map;
    return () => { delete w.__sahakarMap; };
  }, [map]);
  return null;
}

/** Fly-to when lat/lng change externally (GPS, search, manual input). */
function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], 16, { duration: 0.6 });
  }, [lat, lng, map]);
  return null;
}

export default function InteractiveMapPicker({
  initialLat,
  initialLng,
  onPick,
  height = "320px",
}: InteractiveMapPickerProps) {
  const center = useMemo(
    () => [initialLat ?? HYD_CENTER[0], initialLng ?? HYD_CENTER[1]],
    [initialLat, initialLng],
  );

  const [lat, setLat] = useState(center[0]);
  const [lng, setLng] = useState(center[1]);
  const [address, setAddress] = useState("");
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsAcc, setGpsAcc] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ lat: number; lng: number; label: string }>>([]);
  const [searching, setSearching] = useState(false);
  const [manualLat, setManualLat] = useState(String(initialLat ?? ""));
  const [manualLng, setManualLng] = useState(String(initialLng ?? ""));
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const addressDebounce = useRef<ReturnType<typeof setTimeout>>(undefined);

  const reverse = useCallback(async (a: number, b: number) => {
    const result = await reverseGeocode(a, b);
    setAddress(result.address);
  }, []);

  const handleMoveEnd = useCallback(
    (a: number, b: number) => {
      setLat(a);
      setLng(b);
      setManualLat(a.toFixed(5));
      setManualLng(b.toFixed(5));
      // Debounce reverse geocode
      clearTimeout(addressDebounce.current);
      addressDebounce.current = setTimeout(() => reverse(a, b), 300);
    },
    [reverse],
  );

  // Initial reverse geocode (sync external Nominatim state on mount)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (initialLat && initialLng) void reverse(initialLat, initialLng);
  }, []);

  // GPS button
  const handleGps = useCallback(() => {
    if (!navigator.geolocation) return;
    setGpsLoading(true);
    getAccuratePosition(12000)
      .then((pos) => {
        const a = pos.coords.latitude;
        const b = pos.coords.longitude;
        setLat(a);
        setLng(b);
        setManualLat(a.toFixed(5));
        setManualLng(b.toFixed(5));
        setGpsAcc(pos.coords.accuracy);
        setGpsLoading(false);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        reverse(a, b); // syncs address from external Nominatim API
      })
      .catch(() => setGpsLoading(false));
  }, [reverse]);

  // Search debounce
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 3) {
      setSearchResults([]);
      return;
    }
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      const results = await searchPlaces(searchQuery, 5);
      setSearchResults(results);
      setSearching(false);
    }, 400);
    return () => clearTimeout(searchTimer.current);
  }, [searchQuery]);

  function selectSearchResult(r: { lat: number; lng: number }) {
    setLat(r.lat);
    setLng(r.lng);
    setManualLat(r.lat.toFixed(5));
    setManualLng(r.lng.toFixed(5));
    setSearchResults([]);
    setSearchQuery("");
    reverse(r.lat, r.lng);
  }

  function handleManualSubmit() {
    const a = parseFloat(manualLat);
    const b = parseFloat(manualLng);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      setLat(a);
      setLng(b);
      reverse(a, b);
    }
  }

  function handleConfirm() {
    onPick({ lat, lng, address });
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
        <input
          className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          placeholder="Search landmark or area…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searching && (
          <Loader2 className="absolute right-3 top-2.5 size-4 animate-spin text-slate-400" />
        )}
        {searchResults.length > 0 && (
          <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
            {searchResults.map((r, i) => (
              <button
                key={i}
                type="button"
                className="w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-emerald-50"
                onClick={() => selectSearchResult(r)}
              >
                {r.label.length > 60 ? r.label.slice(0, 60) + "…" : r.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Map */}
      <div style={{ height, borderRadius: "16px", overflow: "hidden", border: "1px solid #e2e8f0" }}>
        <MapContainer
          center={center as [number, number]}
          zoom={initialLat ? 16 : DEFAULT_ZOOM}
          style={{ height: "100%", width: "100%" }}
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapHooks onMoveEnd={handleMoveEnd} />
          <Recenter lat={lat} lng={lng} />
          <Marker
            position={[lat, lng]}
            icon={defaultIcon}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const p = (e.target as L.Marker).getLatLng();
                handleMoveEnd(p.lat, p.lng);
              },
            }}
          />
        </MapContainer>
      </div>

      {/* GPS + Accuracy */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleGps}
          disabled={gpsLoading}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
        >
          {gpsLoading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <LocateFixed className="size-3.5" />
          )}
          Use my GPS
        </button>
        {gpsAcc !== null && (
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
            {accuracyText(gpsAcc)}
          </span>
        )}
      </div>

      {/* Manual lat/lng inputs */}
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Latitude
          </label>
          <input
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-900 transition focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            value={manualLat}
            onChange={(e) => setManualLat(e.target.value)}
            onBlur={handleManualSubmit}
            onKeyDown={(e) => e.key === "Enter" && handleManualSubmit()}
          />
        </div>
        <div className="flex-1">
          <label className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Longitude
          </label>
          <input
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-900 transition focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            value={manualLng}
            onChange={(e) => setManualLng(e.target.value)}
            onBlur={handleManualSubmit}
            onKeyDown={(e) => e.key === "Enter" && handleManualSubmit()}
          />
        </div>
      </div>

      {/* Address + confirm */}
      {address && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <span className="font-bold text-slate-900">Address:</span> {address}
        </div>
      )}

      <button
        type="button"
        onClick={handleConfirm}
        className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 active:scale-95"
      >
        Confirm location
      </button>
    </div>
  );
}
