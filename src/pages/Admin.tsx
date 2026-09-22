import { Link } from "react-router";
import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useLang } from "@/lib/i18n";
import { getTrade, COLOR_SOFT } from "@/lib/trades";
import { AppHeader } from "@/components/AppHeader";
import { MonoBadge, Panel, StatusDot, TlButton } from "@/components/terminal";
import FederationGISMap from "@/components/map/FederationGISMap";
import {
  Loader2,
  ShieldAlert,
  Users,
  CalendarCheck,
  Wallet,
  HeartPulse,
  Map,
  BrainCircuit,
  ShieldCheck,
  Building2,
  CheckCircle2,
  XCircle,
  Plus,
} from "lucide-react";

type TabId = "overview" | "gis" | "forecast" | "governance" | "societies";

const TABS: Array<{ id: TabId; label: string; icon: typeof Users }> = [
  { id: "overview", label: "Overview", icon: Users },
  { id: "gis", label: "GIS Command Map", icon: Map },
  { id: "forecast", label: "AI Forecast", icon: BrainCircuit },
  { id: "governance", label: "KYC Queue", icon: ShieldCheck },
  { id: "societies", label: "District Societies", icon: Building2 },
];

export default function Admin() {
  const { t } = useLang();
  const overview = useQuery(api.admin.overview, {});
  const [tab, setTab] = useState<TabId>("overview");

  if (overview === undefined) {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <main className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="size-6 animate-spin text-slate-400" />
        </main>
      </div>
    );
  }

  if (overview === null) {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <main className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
          <span className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50">
            <ShieldAlert className="size-6 text-amber-700" />
          </span>
          <h1 className="mt-4 text-lg font-extrabold text-slate-900">
            {t("ad_no_access")}
          </h1>
          <Link to="/" className="mt-4 inline-block">
            <TlButton variant="outline">{t("nav_home")}</TlButton>
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">
          {t("ad_title")}
        </h1>
        <p className="mt-1 text-sm text-slate-600">{t("ad_sub")}</p>

        {/* Tab bar */}
        <div className="mt-5 flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1 shadow-xs">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl px-4 py-2 text-xs font-bold transition ${
                tab === id
                  ? "bg-emerald-600 text-white"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {tab === "overview" && <OverviewPanel overview={overview} />}
          {tab === "gis" && <GISPanel />}
          {tab === "forecast" && <ForecastPanel />}
          {tab === "governance" && <GovernancePanel />}
          {tab === "societies" && <SocietiesPanel />}
        </div>
      </main>
    </div>
  );
}

/* ── Overview tab ── */

function OverviewPanel({
  overview,
}: {
  overview: {
    workers: number;
    online: number;
    bookings: number;
    revenueSettled: number;
    welfarePool: number;
    byStatus: Record<string, number>;
    byTrade: Record<string, number>;
  };
}) {
  const { t } = useLang();
  const directory = useQuery(api.admin.workerDirectory, {});
  const bookings = useQuery(api.bookings.listForAdmin, {});
  const adminCancel = useMutation(api.admin.adminCancelBooking);
  const pipeline = Object.entries(overview.byStatus);

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatTile icon={<Users className="size-3.5" />} label={t("ad_workers")} value={String(overview.workers)} />
        <StatTile icon={<StatusDot tone="ok" blink />} label={t("ad_online")} value={String(overview.online)} tone="ok" />
        <StatTile icon={<CalendarCheck className="size-3.5" />} label={t("ad_bookings")} value={String(overview.bookings)} />
        <StatTile icon={<Wallet className="size-3.5" />} label={t("ad_settled")} value={`₹${overview.revenueSettled.toLocaleString("en-IN")}`} />
        <StatTile icon={<HeartPulse className="size-3.5" />} label={t("ad_welfare")} value={`₹${overview.welfarePool.toLocaleString("en-IN")}`} tone="orange" />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-5">
        <Panel title={t("ad_pipeline")} className="lg:col-span-2" bodyClassName="p-4">
          <div className="space-y-2.5">
            {pipeline.length === 0 && <p className="py-6 text-center text-xs text-slate-500">{t("bks_empty")}</p>}
            {pipeline.map(([status, count]) => (
              <div key={status} className="flex items-center justify-between gap-3">
                <MonoBadge tone={status === "cancelled" ? "neutral" : status === "settled" || status === "completed" ? "ok" : "saffron"}>
                  {t(`st_${status}`)}
                </MonoBadge>
                <div className="flex flex-1 items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-emerald-600" style={{ width: `${Math.round((count / Math.max(overview.bookings, 1)) * 100)}%` }} />
                  </div>
                  <span className="w-6 text-right text-xs font-bold text-slate-900">{count}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 border-t border-dashed border-slate-200 pt-3">
            <p className="tl-label mb-2">by trade</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(overview.byTrade).map(([tr, count]) => (
                <MonoBadge key={tr} tone="neutral">{tr} · {count}</MonoBadge>
              ))}
            </div>
          </div>
        </Panel>

        <Panel title={t("ad_directory")} className="lg:col-span-3" bodyClassName="p-0">
          <div className="max-h-[420px] overflow-y-auto">
            {(directory ?? []).map((a) => {
              const trade = getTrade(a.trade);
              const Icon = trade?.icon;
              return (
                <div key={a._id} className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-0">
                  <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg border ${COLOR_SOFT[trade?.color ?? "ok"]}`}>
                    {Icon && <Icon className="size-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-slate-900">{a.fullName}</p>
                    <p className="truncate text-[11px] text-slate-500">{a.district} · {a.phone}</p>
                  </div>
                  <MonoBadge tone={a.kycStatus === "verified" ? "ok" : "warn"}>
                    {a.kycStatus === "verified" ? t("kyc_badge") : t("kyc_pending")}
                  </MonoBadge>
                  {a.credentialId && <span className="hidden text-[10px] font-semibold text-emerald-700 sm:inline">{a.credentialId}</span>}
                  <StatusDot tone={a.isOnline ? "ok" : "idle"} blink={a.isOnline} />
                </div>
              );
            })}
            {(directory ?? []).length === 0 && <p className="py-10 text-center text-xs text-slate-500">{t("myjobs_empty")}</p>}
          </div>
        </Panel>
      </div>

      <Panel title={t("ad_pipeline")} className="mt-5" bodyClassName="p-0">
        <div className="max-h-[480px] overflow-y-auto">
          {(bookings ?? []).map((b) => (
            <div key={b._id} className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-0">
              <Link to={`/bookings/${b._id}`} className="min-w-0 flex-1 hover:underline">
                <p className="truncate text-xs font-bold text-slate-900">{b.serviceName}</p>
                <p className="truncate text-[11px] text-slate-500">{b.address.slice(0, 40)} · {new Date(b.scheduledFor).toLocaleDateString("en-IN")}</p>
              </Link>
              <MonoBadge tone={b.status === "cancelled" ? "neutral" : b.status === "settled" || b.status === "completed" ? "ok" : "saffron"}>
                {t(`st_${b.status}`)}
              </MonoBadge>
              <span className="text-xs font-bold text-slate-900">₹{b.total}</span>
              {!["completed", "settled", "cancelled"].includes(b.status) && (
                <button type="button" onClick={() => void adminCancel({ id: b._id })} className="rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 transition hover:bg-rose-100">
                  {t("ad_cancel")}
                </button>
              )}
            </div>
          ))}
          {(bookings ?? []).length === 0 && <p className="py-10 text-center text-xs text-slate-500">{t("bks_empty")}</p>}
        </div>
      </Panel>
    </>
  );
}

/* ── GIS Command Map tab ── */

function GISPanel() {
  const mapData = useQuery(api.gis.mapData, {});
  if (mapData === undefined) return <LoadingPlaceholder text="Loading map data…" />;
  if (mapData === null) return <LoadingPlaceholder text="Access denied" />;

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-600 text-white">
          <Map className="size-4" />
        </span>
        <div>
          <h2 className="text-base font-extrabold text-slate-900">Federation GIS Command Map</h2>
          <p className="text-xs text-slate-500">
            Live artisan positions, active dispatches, and district society HQs
          </p>
        </div>
      </div>
      <FederationGISMap
        artisans={mapData.artisans}
        bookings={mapData.bookings}
        societies={mapData.societies}
        demandPoints={mapData.demandPoints}
        height="520px"
      />
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile icon={<Users className="size-3.5" />} label="Total artisans" value={String(mapData.artisans.length)} />
        <StatTile icon={<StatusDot tone="ok" blink />} label="Online" value={String(mapData.artisans.filter((a: { isOnline: boolean }) => a.isOnline).length)} tone="ok" />
        <StatTile icon={<CalendarCheck className="size-3.5" />} label="Active dispatches" value={String(mapData.bookings.length)} />
        <StatTile icon={<Building2 className="size-3.5" />} label="Societies" value={String(mapData.societies.length)} tone="orange" />
      </div>
    </div>
  );
}

/* ── AI Forecast tab ── */

function ForecastPanel() {
  const latest = useQuery(api.forecasts.latest, {});
  const forecastAction = useAction(api.forecastAi.runForecast);
  const [forecasting, setForecasting] = useState(false);
  const [forecast, setForecast] = useState<Awaited<
    ReturnType<typeof forecastAction>
  > | { error: string } | null>(null);
  const [kind, setKind] = useState<"forecast" | "stabilization">("forecast");

  async function runForecast() {
    setForecasting(true);
    try {
      const result = await forecastAction({ kind });
      setForecast(result);
    } catch (e) {
      setForecast({ error: e instanceof Error ? e.message : "Forecast failed" });
    } finally {
      setForecasting(false);
    }
  }

  const display = forecast ?? latest;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-600 text-white">
            <BrainCircuit className="size-4" />
          </span>
          <div>
            <h2 className="text-base font-extrabold text-slate-900">Gemini AI Demand Forecast</h2>
            <p className="text-xs text-slate-500">Regional labor demand analysis & fair pricing intelligence</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as "forecast" | "stabilization")}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
          >
            <option value="forecast">Demand Forecast</option>
            <option value="stabilization">Fair Pricing Stabilization</option>
          </select>
          <TlButton onClick={() => void runForecast()} disabled={forecasting}>
            {forecasting ? <Loader2 className="size-4 animate-spin" /> : <BrainCircuit className="size-4" />}
            {forecasting ? "Analyzing…" : "Run analysis"}
          </TlButton>
        </div>
      </div>

      {display?.error && (
        <Panel className="border-amber-200 bg-amber-50" bodyClassName="p-4">
          <p className="text-xs font-bold text-amber-800">⚠ {display.error}</p>
          <p className="mt-1 text-[11px] text-amber-700">
            Add GOOGLE_API_KEY to the Convex environment to enable Gemini forecasting. Running with heuristic fallback.
          </p>
        </Panel>
      )}

      {display && !display.error && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel bodyClassName="p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="tl-label">Demand Index</span>
              <span className={`text-2xl font-black ${display.demandIndex >= 70 ? "text-rose-700" : display.demandIndex >= 40 ? "text-amber-700" : "text-emerald-700"}`}>
                {display.demandIndex}/100
              </span>
            </div>
            <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${display.demandIndex >= 70 ? "bg-rose-600" : display.demandIndex >= 40 ? "bg-amber-500" : "bg-emerald-600"}`}
                style={{ width: `${display.demandIndex}%` }}
              />
            </div>
            {display.source && (
              <p className="text-[10px] text-slate-400">
                Source: {display.source} {display.model ? `(${display.model})` : ""}
                {display.createdAt ? ` · ${new Date(display.createdAt).toLocaleString("en-IN")}` : ""}
              </p>
            )}
          </Panel>

          <Panel title="Welfare Pool Allocation" bodyClassName="p-4">
            <span className="text-2xl font-black text-orange-800">{display.welfarePoolAllocation}%</span>
            <p className="mt-1 text-xs text-slate-500">Recommended welfare reserve allocation of transaction revenue</p>
          </Panel>

          <Panel title="Price Recommendation" bodyClassName="p-4">
            <p className="text-sm font-bold text-slate-900">{display.priceRecommendation}</p>
          </Panel>

          <Panel title="Deficit Trades" bodyClassName="p-4">
            {display.primaryDeficitTrades?.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {display.primaryDeficitTrades.map((tr: string) => (
                  <MonoBadge key={tr} tone="warn">{tr}</MonoBadge>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">No critical shortages detected across trades</p>
            )}
          </Panel>

          <Panel title="Actionable Advisories" className="lg:col-span-2" bodyClassName="p-4">
            <ol className="space-y-2">
              {display.advisories?.map((ad: string, i: number) => (
                <li key={i} className="flex gap-2 text-sm text-slate-700">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-800">
                    {i + 1}
                  </span>
                  {ad}
                </li>
              ))}
            </ol>
          </Panel>

          {display.summary && (
            <Panel className="lg:col-span-2" bodyClassName="p-4">
              <p className="text-sm leading-relaxed text-slate-600">{display.summary}</p>
            </Panel>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Governance KYC Queue tab ── */

function GovernancePanel() {
  const queue = useQuery(api.admin.verificationQueue, {});
  const reviewKyc = useMutation(api.admin.reviewKyc);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleReview(artisanId: Id<"artisans">, approve: boolean) {
    setBusyId(artisanId);
    try {
      await reviewKyc({ artisanId, approve });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-600 text-white">            <ShieldCheck className="size-4" />
        </span>
        <div>
          <h2 className="text-base font-extrabold text-slate-900">Artisan Verification Queue</h2>
          <p className="text-xs text-slate-500">Review identity documents and approve artisan registrations</p>
        </div>
      </div>

      <Panel bodyClassName="p-0">
        <div className="max-h-[500px] overflow-y-auto">
          {queue === undefined && <LoadingPlaceholder text="Loading queue…" />}
          {queue && queue.length === 0 && (
            <div className="py-12 text-center">
              <CheckCircle2 className="mx-auto size-8 text-emerald-400" />
              <p className="mt-2 text-sm font-bold text-slate-600">All clear — no pending verifications</p>
              <p className="mt-1 text-xs text-slate-400">New artisan KYC submissions will appear here</p>
            </div>
          )}
          {queue?.map((a) => {
            const trade = getTrade(a.trade);
            const isBusy = busyId === a._id;
            return (
              <div key={a._id} className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-0">
                <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl border ${COLOR_SOFT[trade?.color ?? "ok"]}`}>
                  {trade?.icon && <trade.icon className="size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-slate-900">{a.fullName}</p>
                  <p className="text-[11px] text-slate-500">
                    {a.trade} · {a.district} · {a.idType?.toUpperCase()} ****{a.idLast4}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    📞 {a.phone} · {a.experienceYears}yr exp · ₹{a.dailyRate}/day
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => void handleReview(a._id, true)}
                    disabled={isBusy}
                    className="flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {isBusy ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle2 className="size-3" />}
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleReview(a._id, false)}
                    disabled={isBusy}
                    className="flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] font-bold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                  >
                    <XCircle className="size-3" />
                    Reject
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

/* ── District Societies Registration tab ── */

function SocietiesPanel() {
  const societies = useQuery(api.societies.listForAdmin, {});
  const register = useMutation(api.societies.register);
  const review = useMutation(api.societies.review);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [district, setDistrict] = useState("");
  const [state, setState] = useState("Telangana");
  const [jurisdiction, setJurisdiction] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleRegister() {
    if (!name.trim() || !district.trim()) return;
    setBusy(true);
    try {
      await register({
        name: name.trim(),
        district: district.trim(),
        state,
        jurisdiction: jurisdiction.trim() || undefined,
      });
      setName("");
      setDistrict("");
      setJurisdiction("");
      setShowForm(false);
    } finally {
      setBusy(false);
    }
  }

  async function handleSocietyReview(id: Id<"societies">, status: string) {
    await review({ id, status });
  }

  const STATES = ["Telangana", "Andhra Pradesh", "Karnataka", "Tamil Nadu", "Kerala", "Maharashtra", "Delhi", "West Bengal", "Uttar Pradesh", "Gujarat", "Rajasthan"];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-600 text-white">
            <Building2 className="size-4" />
          </span>
          <div>
            <h2 className="text-base font-extrabold text-slate-900">District Cooperative Societies</h2>
            <p className="text-xs text-slate-500">Register and manage district cooperative society charters</p>
          </div>
        </div>
        <TlButton onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : <><Plus className="size-3.5" /> Register new society</>}
        </TlButton>
      </div>

      {showForm && (
        <Panel className="mb-5" title="New Society Registration" bodyClassName="p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Society name</label>
              <input className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 transition focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Secunderabad Electrical Workers Co-op" />
            </div>
            <div>
              <label className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">District</label>
              <input className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 transition focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20" value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="e.g. Secunderabad" />
            </div>
            <div>
              <label className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">State</label>
              <select className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 transition focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20" value={state} onChange={(e) => setState(e.target.value)}>
                {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Jurisdiction (optional)</label>
              <input className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 transition focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20" value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} placeholder="e.g. Secunderabad, Malkajgiri mandals" />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <TlButton onClick={() => void handleRegister()} disabled={busy || !name.trim() || !district.trim()}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Register society
            </TlButton>
          </div>
        </Panel>
      )}

      <Panel bodyClassName="p-0">
        <div className="max-h-[500px] overflow-y-auto">
          {societies === undefined && <LoadingPlaceholder text="Loading societies…" />}
          {societies && societies.length === 0 && (
            <div className="py-12 text-center">
              <Building2 className="mx-auto size-8 text-slate-300" />
              <p className="mt-2 text-sm font-bold text-slate-600">No societies registered yet</p>
              <p className="mt-1 text-xs text-slate-400">Register the first district cooperative society above</p>
            </div>
          )}
          {societies?.map((s) => (
            <div key={s._id} className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-0">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-700">
                <Building2 className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-slate-900">{s.name}</p>
                <p className="text-[11px] text-slate-500">
                  {s.code} · {s.district}, {s.state} · {s.registrationNo}
                </p>
                <p className="text-[11px] text-slate-500">
                  {s.memberCount} artisan members
                </p>
              </div>
              <MonoBadge tone={s.status === "active" ? "ok" : s.status === "pending" ? "warn" : "neutral"}>
                {s.status}
              </MonoBadge>
              {s.status === "pending" && (
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => void handleSocietyReview(s._id, "active")}
                    className="flex items-center gap-1 rounded-xl bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white transition hover:bg-emerald-700"
                  >
                    <CheckCircle2 className="size-3" /> Charter
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSocietyReview(s._id, "rejected")}
                    className="flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 transition hover:bg-rose-100"
                  >
                    <XCircle className="size-3" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

/* ── Shared helpers ── */

function StatTile({ icon, label, value, tone = "neutral" }: { icon: React.ReactNode; label: string; value: string; tone?: "neutral" | "ok" | "orange" }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
      <div className="flex items-center gap-1.5">
        <span className={tone === "ok" ? "text-emerald-600" : tone === "orange" ? "text-orange-600" : "text-slate-400"}>{icon}</span>
        <span className="tl-label">{label}</span>
      </div>
      <p className={`mt-1.5 text-xl font-black tracking-tight ${tone === "ok" ? "text-emerald-800" : tone === "orange" ? "text-orange-800" : "text-slate-900"}`}>
        {value}
      </p>
    </div>
  );
}

function LoadingPlaceholder({ text }: { text: string }) {
  return (
    <div className="flex min-h-[200px] items-center justify-center gap-2">
      <Loader2 className="size-5 animate-spin text-slate-400" />
      <span className="text-sm text-slate-400">{text}</span>
    </div>
  );
}
