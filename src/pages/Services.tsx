import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { Link } from "react-router";
import { api } from "@/convex/_generated/api";
import { useLang } from "@/lib/i18n";
import { SERVICES, TRADES, COLOR_SOFT } from "@/lib/trades";
import { AppHeader } from "@/components/AppHeader";
import { MonoBadge } from "@/components/terminal";
import { useDetectedLocation, formatAccuracy } from "@/lib/useLocation";
import { formatDistance } from "@/lib/geo";
import { computeTradeAvailability, serviceAvailability } from "@/lib/availability";
import {
  Search,
  ArrowRight,
  Zap,
  HardHat,
  MapPin,
  RefreshCcw,
  ShieldCheck,
  Siren,
  Plus,
  Navigation,
} from "lucide-react";

type Tab = "artisans" | "radar" | "orders";

const EMERGENCY_RADIUS_M = 3000;

export default function Services() {
  const { t } = useLang();
  const [q, setQ] = useState("");
  const [trade, setTrade] = useState<string>("all");
  const [tab, setTab] = useState<Tab>("artisans");
  const [sortByDistance, setSortByDistance] = useState(true);
  const [emergencyMode, setEmergencyMode] = useState(false);
  const { location, detect } = useDetectedLocation();

  const artisans = useQuery(api.artisans.listArtisans, {});

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    // Live availability per trade from actual registered artisans — never demo
    // pins, so distance/ETA pills only appear when real workers exist.
    const byTrade = computeTradeAvailability(artisans, location);
    const loading = artisans === undefined;
    let list = SERVICES.map((s) => {
      const a = serviceAvailability(byTrade, s.trade, loading);
      return { ...s, artisanCount: a.artisanCount, distM: a.distM, etaM: a.etaM };
    }).filter((s) => {
      const inTrade = trade === "all" || s.trade === trade;
      const inSearch =
        !needle ||
        s.name.toLowerCase().includes(needle) ||
        s.desc.toLowerCase().includes(needle) ||
        s.trade.includes(needle);
      const inEmergency =
        !emergencyMode ||
        (s.urgent && s.distM !== null && s.distM <= EMERGENCY_RADIUS_M);
      return inTrade && inSearch && inEmergency;
    });
    if (sortByDistance) {
      list = [...list].sort(
        (a, b) => (a.distM ?? Infinity) - (b.distM ?? Infinity),
      );
    }
    return list;
  }, [q, trade, location, sortByDistance, emergencyMode, artisans]);

  const nearest = filtered.length > 0 ? filtered[0] : null;

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-50 via-emerald-50/30 to-slate-100 font-sans text-slate-900 antialiased">
      <AppHeader />

      {/* ── Portal banner + location/user row ────────────────── */}
      <div className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-emerald-300 bg-emerald-100 px-3 py-1 text-[11px] font-black tracking-wide text-emerald-900 uppercase">
            Customer Booking Portal
          </span>
          <span className="text-[11px] text-slate-500 italic">
            Verified Cooperative Artisans &amp; Direct Local Dispatch
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 shadow-xs">
            <MapPin className="size-3.5 shrink-0 text-emerald-600" />
            <span className="max-w-[13rem] truncate italic">{location.label}</span>
            <span className="rounded border border-emerald-200 bg-emerald-50 px-1 font-semibold text-emerald-700">
              {formatAccuracy(location)}
            </span>
            <button
              type="button"
              onClick={() => detect(false)}
              className="text-slate-400 transition hover:text-emerald-700"
              title="Re-detect GPS location"
            >
              <RefreshCcw className="size-3" />
            </button>
            <Link
              to="/"
              className="font-bold text-emerald-700 underline underline-offset-2"
            >
              Change
            </Link>
          </span>
          <button
            type="button"
            onClick={() => setEmergencyMode((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold shadow-xs transition active:scale-95 ${
              emergencyMode
                ? "border-rose-600 bg-rose-600 text-white"
                : "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
            }`}
          >
            <Siren className="size-3.5" />
            {emergencyMode ? "Emergency dispatch active" : "Emergency Rapid Dispatch"}
          </button>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 shadow-xs">
            <HardHat className="size-3.5 text-teal-700" />
            I'm a Worker →
          </span>
        </div>
      </div>

      {/* ── Dark hero banner ─────────────────────────────────── */}
      <div className="mx-auto mt-4 w-full max-w-6xl px-4 sm:px-6">
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-900 via-emerald-900 to-slate-900 px-5 py-7 sm:px-8 sm:py-9">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl">
              <p className="text-[11px] font-medium text-emerald-200/80 italic">
                Your Detected Location:{" "}
                <span className="text-emerald-100">{location.label}</span>
              </p>
              <p className="mt-0.5 text-[10px] text-emerald-300/70">
                GPS: {location.lat.toFixed(4)}, {location.lng.toFixed(4)} · {formatAccuracy(location)}
              </p>
              <h1 className="mt-3 text-2xl font-black leading-tight tracking-tight text-white sm:text-4xl">
                Book Verified Skilled
                <br />
                Artisans Near You
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-emerald-100/80 italic">
                Every artisan on Sahakar Seva is trade-certified and
                background-verified with direct local dispatch.
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-stretch gap-2.5 md:items-end">
              <Link
                to="/onboarding"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-bold text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-white/20 active:scale-95"
              >
                <HardHat className="size-4" /> + Register Skilled Worker
              </Link>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-rose-700 active:scale-95"
              >
                <Siren className="size-4" /> Emergency SOS (15m SLA)
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-slate-950 shadow-lg transition hover:bg-emerald-400 active:scale-95"
              >
                <Plus className="size-4" /> + Post Service Request
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────── */}
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="mt-5 flex flex-wrap items-center gap-4 border-b border-slate-200">
          <TabButton active={tab === "artisans"} onClick={() => setTab("artisans")}>
            Available Verified Artisans ({filtered.length})
          </TabButton>
          <TabButton active={tab === "radar"} onClick={() => setTab("radar")}>
            <span className="inline-flex items-center gap-1.5">
              ◎ Real-Time Radar Map
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
            </span>
          </TabButton>
          <TabButton active={tab === "orders"} onClick={() => setTab("orders")}>
            My Booking Orders
          </TabButton>
          <span className="ml-auto hidden pb-2 text-[10px] text-slate-400 italic sm:block">
            Connected to live federation database · Real records
          </span>
        </div>

        {/* ── Tab content ───────────────────────────────────── */}
        {tab === "artisans" && (
          <>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
                <input
                  className="tl-input pl-9"
                  placeholder={t("cat_search_ph")}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <FilterChip
                active={trade === "all"}
                onClick={() => setTrade("all")}
                label="All Services"
                icon={<Zap className="size-3 text-emerald-600" />}
              />
              {TRADES.map((tr) => (
                <FilterChip
                  key={tr.id}
                  active={trade === tr.id}
                  onClick={() => setTrade(tr.id)}
                  label={tr.id}
                  icon={<tr.icon className="size-3 text-emerald-600" />}
                />
              ))}
              <FilterChip
                active={false}
                onClick={() => setTrade("all")}
                label="24x7 Emergency"
                icon={<Siren className="size-3 text-rose-500" />}
              />
              <FilterChip
                active={sortByDistance}
                onClick={() => setSortByDistance((v) => !v)}
                label="Closest to Me First"
                icon={<Navigation className="size-3 text-emerald-600" />}
              />
            </div>

            {emergencyMode && (
              <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-800">
                ⚡ Rapid dispatch mode — highlighting the closest urgent service
                within {EMERGENCY_RADIUS_M / 1000} km of your confirmed GPS
                location.
              </p>
            )}

            {/* Grid */}
            <div className="mt-6 grid gap-4 pb-14 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((s) => {
                const Icon = s.icon;
                const soft = COLOR_SOFT[s.color] ?? COLOR_SOFT.ok;
                return (
                  <Link key={s.id} to={`/services/${s.id}`} className="h-full">
                    <article className={`flex h-full flex-col justify-between rounded-2xl border p-5 shadow-xs transition hover:-translate-y-0.5 hover:shadow-md ${
                      emergencyMode && s.id === nearest?.id
                        ? "border-rose-400 bg-rose-50/40 ring-1 ring-rose-300"
                        : "border-slate-200 bg-white hover:border-emerald-300"
                    }`}>
                      {emergencyMode && s.id === nearest?.id && (
                        <span className="mb-2 w-fit rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-black text-white">
                          ⚡ FASTEST AVAILABLE
                        </span>
                      )}
                      <div>
                        <div className="flex items-start justify-between">
                          <span
                            className={`flex size-10 items-center justify-center rounded-xl border ${soft}`}
                          >
                            <Icon className="size-5" />
                          </span>
                          {s.urgent && (
                            <MonoBadge tone="warn">
                              <Zap className="size-3" /> {t("sv_urgent")}
                            </MonoBadge>
                          )}
                        </div>
                        <h2 className="mt-3.5 text-sm font-bold text-slate-900">
                          {s.name}
                        </h2>
                        {(s.artisanCount ?? 0) === 0 && (
                          <p className="mt-1 inline-flex w-fit items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                            <Navigation className="size-2.5" />
                            No verified {s.trade} artisans yet
                          </p>
                        )}
                        {(s.artisanCount ?? 0) > 0 && s.distM !== null && (
                          <p className="mt-1 inline-flex w-fit items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                            <Navigation className="size-2.5" />
                            {s.artisanCount} {s.artisanCount === 1 ? "artisan" : "artisans"} nearby · {formatDistance(s.distM!)} away · ~{s.etaM} min arrival
                          </p>
                        )}
                        {(s.artisanCount ?? 0) > 0 && s.distM === null && (
                          <p className="mt-1 inline-flex w-fit items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                            <Navigation className="size-2.5" />
                            {s.artisanCount} verified {s.artisanCount === 1 ? "artisan" : "artisans"} available
                          </p>
                        )}
                        <p className="tl-line-clamp-2 mt-1 text-sm leading-6 text-slate-500 italic">
                          {s.desc}
                        </p>
                      </div>
                      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                        <div>
                          <p className="tl-label">{t("sv_base")}</p>
                          <p className="text-sm font-bold text-slate-900">
                            ₹{s.base}
                          </p>
                          {s.hourly > 0 && (
                            <p className="text-[11px] text-slate-400">
                              + ₹{s.hourly} {t("sv_hourly")}
                            </p>
                          )}
                        </div>
                        <span className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-emerald-700 transition hover:bg-emerald-50">
                          {t("sv_view")}
                          <ArrowRight className="size-3.5" />
                        </span>
                      </div>
                    </article>
                  </Link>
                );
              })}
            </div>

            {filtered.length === 0 && (
              <div className="mx-auto mb-16 mt-8 max-w-lg rounded-3xl border border-slate-200 bg-white px-6 py-10 text-center shadow-xs">
                <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-teal-100 text-teal-700">
                  <HardHat className="size-7" />
                </span>
                <p className="mt-4 text-base font-bold text-slate-900">
                  No skilled workers registered in this category yet
                </p>
                <p className="mt-2 text-sm leading-relaxed text-slate-500 italic">
                  When a worker registers with the federation, their profile,
                  visit rate, contact and the specific work they can do will
                  appear right here on this booking page.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <Link
                    to="/onboarding"
                    className="inline-flex items-center gap-2 rounded-xl bg-teal-900 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-teal-800 active:scale-95"
                  >
                    <HardHat className="size-3.5" /> + Register a Skilled Worker
                  </Link>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-200 active:scale-95"
                  >
                    <Plus className="size-3.5" /> + Post Open Job Request
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {tab === "radar" && (
          <div className="my-8 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xs">
            <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
              <ShieldCheck className="size-6" />
            </span>
            <p className="mt-3 text-base font-bold text-slate-900">
              Real-time radar activates once a booking is confirmed
            </p>
            <p className="mt-1 text-sm text-slate-500 italic">
              Track your assigned artisan en route with live GPS telemetry from
              the booking detail page.
            </p>
            <Link
              to="/bookings"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-700 active:scale-95"
            >
              View my bookings <ArrowRight className="size-3.5" />
            </Link>
          </div>
        )}

        {tab === "orders" && (
          <div className="my-8 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xs">
            <p className="text-base font-bold text-slate-900">
              Your booking orders live here
            </p>
            <p className="mt-1 text-sm text-slate-500 italic">
              Every request you post, its assigned artisan, and payment status
              in one place.
            </p>
            <Link
              to="/bookings"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-700 active:scale-95"
            >
              Open booking orders <ArrowRight className="size-3.5" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Tab pill ─────────────────────────────────────────────────── */

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px border-b-2 px-1 pb-2.5 text-sm font-bold transition ${
        active
          ? "border-emerald-600 text-emerald-800"
          : "border-transparent text-slate-500 hover:text-slate-800"
      }`}
    >
      {children}
    </button>
  );
}

/* ── Filter chip ──────────────────────────────────────────────── */

function FilterChip({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold capitalize transition ${
        active
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-emerald-200 bg-emerald-50 text-slate-800 hover:bg-emerald-100"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
