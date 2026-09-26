import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { Link } from "react-router";
import { api } from "@/convex/_generated/api";
import { useLang } from "@/lib/i18n";
import { Id } from "@/convex/_generated/dataModel";
import {
  Building2,
  ShieldCheck,
  ShieldOff,
  Landmark,
  Users,
  IndianRupee,
  HeartHandshake,
  Plus,
  Loader2,
  UserPlus,
  ArrowLeft,
  CheckCircle2,
  PauseCircle,
} from "lucide-react";

function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Panel className="flex items-center gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {label}
        </p>
        <p className="truncate text-lg font-black text-slate-900">{value}</p>
      </div>
    </Panel>
  );
}

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20";

export default function SuperAdmin() {
  const { t } = useLang();

  const overview = useQuery(api.superAdmin.platformOverview, {});
  const federations = useQuery(api.superAdmin.listFederations, {});
  const admins = useQuery(api.superAdmin.listFederationAdmins, {});
  const createFederation = useMutation(api.superAdmin.createFederation);
  const setFedStatus = useMutation(api.superAdmin.setFederationStatus);
  const appointAdmin = useMutation(api.superAdmin.appointFederationAdmin);
  const removeAdmin = useMutation(api.superAdmin.removeFederationAdmin);

  const [fedError, setFedError] = useState<string | null>(null);
  const [showNewFed, setShowNewFed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [nf, setNf] = useState({ name: "", district: "", state: "" });
  const [appt, setAppt] = useState<{
    societyId: string;
    email: string;
    name: string;
  }>({ societyId: "", email: "", name: "" });

  async function handleCreateFederation() {
    setBusy(true);
    setFedError(null);
    try {
      await createFederation({
        name: nf.name,
        district: nf.district,
        state: nf.state,
      });
      setNf({ name: "", district: "", state: "" });
      setShowNewFed(false);
    } catch (e) {
      setFedError(e instanceof Error ? e.message : "Could not charter");
    } finally {
      setBusy(false);
    }
  }

  async function handleAppoint() {
    setBusy(true);
    setFedError(null);
    try {
      await appointAdmin({
        email: appt.email,
        name: appt.name || undefined,
        societyId: appt.societyId as Id<"societies">,
      });
      setAppt({ societyId: "", email: "", name: "" });
    } catch (e) {
      setFedError(e instanceof Error ? e.message : "Could not appoint");
    } finally {
      setBusy(false);
    }
  }

  const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-emerald-700"
            >
              <ArrowLeft className="size-3.5" />
              {t("sa_home")}
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-slate-900 text-white">
              <Landmark className="size-4" />
            </span>
            <span className="text-sm font-black tracking-tight text-slate-900">
              {t("sa_title")}
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
            <ShieldCheck className="size-3.5 text-emerald-600" />
            <span className="text-[11px] font-bold text-slate-600">
              {t("sa_badge")}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
        {overview === undefined || federations === undefined ? (
          <div className="flex justify-center py-24">
            <Loader2 className="size-6 animate-spin text-slate-300" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Platform stats */}
            <section>
              <h2 className="tl-label mb-3">{t("sa_platform")}</h2>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                <Stat
                  icon={<Building2 className="size-4" />}
                  label={t("sa_federations")}
                  value={String(overview.federations)}
                />
                <Stat
                  icon={<ShieldCheck className="size-4" />}
                  label={t("sa_fed_admins")}
                  value={String(overview.federationAdmins)}
                />
                <Stat
                  icon={<Users className="size-4" />}
                  label={t("sa_workers")}
                  value={String(overview.workers)}
                />
                <Stat
                  icon={<IndianRupee className="size-4" />}
                  label={t("sa_revenue")}
                  value={fmt(overview.revenueSettled)}
                />
                <Stat
                  icon={<HeartHandshake className="size-4" />}
                  label={t("sa_welfare")}
                  value={fmt(overview.welfarePool)}
                />
                <Stat
                  icon={<Landmark className="size-4" />}
                  label={t("sa_bookings")}
                  value={String(overview.bookings)}
                />
              </div>
            </section>

            {fedError && (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-700">
                {fedError}
              </p>
            )}

            {/* Federations */}
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="tl-label">{t("sa_fed_list")}</h2>
                <button
                  type="button"
                  onClick={() => setShowNewFed((v) => !v)}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-800"
                >
                  <Plus className="size-3.5" />
                  {t("sa_new_fed")}
                </button>
              </div>

              {showNewFed && (
                <Panel className="mb-3">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <input
                      className={inputCls}
                      placeholder={t("sa_fed_name")}
                      value={nf.name}
                      onChange={(e) => setNf({ ...nf, name: e.target.value })}
                    />
                    <input
                      className={inputCls}
                      placeholder={t("sa_fed_district")}
                      value={nf.district}
                      onChange={(e) => setNf({ ...nf, district: e.target.value })}
                    />
                    <input
                      className={inputCls}
                      placeholder={t("sa_fed_state")}
                      value={nf.state}
                      onChange={(e) => setNf({ ...nf, state: e.target.value })}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleCreateFederation()}
                    disabled={busy || !nf.name.trim() || !nf.district.trim() || !nf.state.trim()}
                    className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-800 disabled:opacity-50"
                  >
                    {busy ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Building2 className="size-3.5" />
                    )}
                    {t("sa_charter")}
                  </button>
                </Panel>
              )}

              <div className="space-y-2">
                {federations.map((f) => (
                  <Panel key={f._id} className="!p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-bold text-slate-900">
                            {f.name}
                          </p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              f.status === "active"
                                ? "bg-emerald-50 text-emerald-700"
                                : f.status === "suspended"
                                  ? "bg-rose-50 text-rose-700"
                                  : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {f.status}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {f.code} · {f.district}, {f.state} ·{" "}
                          {f.memberCount} {t("sa_members")} ·{" "}
                          {f.admins.length === 0
                            ? t("sa_no_admins")
                            : f.admins
                                .map((a) => a.name || a.email)
                                .join(", ")}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          void setFedStatus({
                            id: f._id,
                            status: f.status === "active" ? "suspended" : "active",
                          })
                        }
                        className={
                          f.status === "active"
                            ? "flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] font-bold text-rose-700 transition hover:bg-rose-100"
                            : "flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-700 transition hover:bg-emerald-100"
                        }
                      >
                        {f.status === "active" ? (
                          <>
                            <ShieldOff className="size-3.5" />
                            {t("sa_suspend")}
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="size-3.5" />
                            {t("sa_reactivate")}
                          </>
                        )}
                      </button>
                    </div>
                  </Panel>
                ))}
              </div>
            </section>

            {/* Federation admins */}
            <section>
              <h2 className="tl-label mb-3">{t("sa_admins")}</h2>

              <Panel className="mb-3">
                <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <input
                    className={inputCls}
                    placeholder={t("sa_appt_email")}
                    value={appt.email}
                    onChange={(e) => setAppt({ ...appt, email: e.target.value })}
                  />
                  <select
                    className={inputCls}
                    value={appt.societyId}
                    onChange={(e) => setAppt({ ...appt, societyId: e.target.value })}
                  >
                    <option value="">{t("sa_pick_fed")}</option>
                    {federations
                      .filter((f) => f.status === "active")
                      .map((f) => (
                        <option key={f._id} value={f._id}>
                          {f.name} · {f.district}
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void handleAppoint()}
                    disabled={busy || !appt.email.includes("@") || !appt.societyId}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800 disabled:opacity-50"
                  >
                    <UserPlus className="size-3.5" />
                    {t("sa_appoint")}
                  </button>
                </div>
              </Panel>

              <div className="space-y-2">
                {(admins ?? []).map((a) => (
                  <Panel key={a._id} className="!p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900">
                          {a.name || a.email}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {a.email} ·{" "}
                          {a.societyName ? (
                            <span className="font-semibold text-emerald-700">
                              {a.societyName}
                            </span>
                          ) : (
                            <span className="font-semibold text-amber-600">
                              {t("sa_unscoped")}
                            </span>
                          )}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void removeAdmin({ userId: a._id })}
                        className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] font-bold text-rose-700 transition hover:bg-rose-100"
                      >
                        <PauseCircle className="size-3.5" />
                        {t("sa_remove")}
                      </button>
                    </div>
                  </Panel>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
