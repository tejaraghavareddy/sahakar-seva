import { Link } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useLang } from "@/lib/i18n";
import { getTrade, COLOR_SOFT } from "@/lib/trades";
import { AppHeader } from "@/components/AppHeader";
import { MonoBadge, Panel, StatusDot, TlButton } from "@/components/terminal";
import {
  Loader2,
  ShieldAlert,
  Users,
  CalendarCheck,
  Wallet,
  HeartPulse,
} from "lucide-react";

export default function Admin() {
  const { t } = useLang();
  const overview = useQuery(api.admin.overview, {});
  const directory = useQuery(api.admin.workerDirectory, {});
  const bookings = useQuery(api.bookings.listForAdmin, {});
  const adminCancel = useMutation(api.admin.adminCancelBooking);

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

  const pipeline = Object.entries(overview.byStatus);

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">
          {t("ad_title")}
        </h1>
        <p className="mt-1 text-sm text-slate-600">{t("ad_sub")}</p>

        {/* Stat tiles */}
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
          <StatTile
            icon={<Users className="size-3.5" />}
            label={t("ad_workers")}
            value={String(overview.workers)}
          />
          <StatTile
            icon={<StatusDot tone="ok" blink />}
            label={t("ad_online")}
            value={String(overview.online)}
            tone="ok"
          />
          <StatTile
            icon={<CalendarCheck className="size-3.5" />}
            label={t("ad_bookings")}
            value={String(overview.bookings)}
          />
          <StatTile
            icon={<Wallet className="size-3.5" />}
            label={t("ad_settled")}
            value={`₹${overview.revenueSettled.toLocaleString("en-IN")}`}
          />
          <StatTile
            icon={<HeartPulse className="size-3.5" />}
            label={t("ad_welfare")}
            value={`₹${overview.welfarePool.toLocaleString("en-IN")}`}
            tone="orange"
          />
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-5">
          {/* Booking pipeline */}
          <Panel
            title={t("ad_pipeline")}
            className="lg:col-span-2"
            bodyClassName="p-4"
          >
            <div className="space-y-2.5">
              {pipeline.length === 0 && (
                <p className="py-6 text-center text-xs text-slate-500">
                  {t("bks_empty")}
                </p>
              )}
              {pipeline.map(([status, count]) => (
                <div
                  key={status}
                  className="flex items-center justify-between gap-3"
                >
                  <MonoBadge
                    tone={
                      status === "cancelled"
                        ? "neutral"
                        : status === "settled" || status === "completed"
                          ? "ok"
                          : "saffron"
                    }
                  >
                    {t(`st_${status}`)}
                  </MonoBadge>
                  <div className="flex flex-1 items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-emerald-600"
                        style={{
                          width: `${Math.round(
                            (count / Math.max(overview.bookings, 1)) * 100,
                          )}%`,
                        }}
                      />
                    </div>
                    <span className="w-6 text-right text-xs font-bold text-slate-900">
                      {count}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 border-t border-dashed border-slate-200 pt-3">
              <p className="tl-label mb-2">by trade</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(overview.byTrade).map(([tr, count]) => (
                  <MonoBadge key={tr} tone="neutral">
                    {tr} · {count}
                  </MonoBadge>
                ))}
              </div>
            </div>
          </Panel>

          {/* Worker directory */}
          <Panel
            title={t("ad_directory")}
            className="lg:col-span-3"
            bodyClassName="p-0"
          >
            <div className="max-h-[420px] overflow-y-auto">
              {(directory ?? []).map((a) => {
                const trade = getTrade(a.trade);
                const Icon = trade?.icon;
                return (
                  <div
                    key={a._id}
                    className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-0"
                  >
                    <span
                      className={`flex size-8 shrink-0 items-center justify-center rounded-lg border ${COLOR_SOFT[trade?.color ?? "ok"]}`}
                    >
                      {Icon && <Icon className="size-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-slate-900">
                        {a.fullName}
                      </p>
                      <p className="truncate text-[11px] text-slate-500">
                        {a.district} · {a.phone}
                      </p>
                    </div>
                    <MonoBadge
                      tone={a.kycStatus === "verified" ? "ok" : "warn"}
                    >
                      {a.kycStatus === "verified"
                        ? t("kyc_badge")
                        : t("kyc_pending")}
                    </MonoBadge>
                    {a.credentialId && (
                      <span className="hidden text-[10px] font-semibold text-emerald-700 sm:inline">
                        {a.credentialId}
                      </span>
                    )}
                    <StatusDot
                      tone={a.isOnline ? "ok" : "idle"}
                      blink={a.isOnline}
                    />
                  </div>
                );
              })}
              {(directory ?? []).length === 0 && (
                <p className="py-10 text-center text-xs text-slate-500">
                  {t("myjobs_empty")}
                </p>
              )}
            </div>
          </Panel>
        </div>

        {/* All bookings */}
        <Panel title={t("ad_pipeline")} className="mt-5" bodyClassName="p-0">
          <div className="max-h-[480px] overflow-y-auto">
            {(bookings ?? []).map((b) => (
              <div
                key={b._id}
                className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-0"
              >
                <Link
                  to={`/bookings/${b._id}`}
                  className="min-w-0 flex-1 hover:underline"
                >
                  <p className="truncate text-xs font-bold text-slate-900">
                    {b.serviceName}
                  </p>
                  <p className="truncate text-[11px] text-slate-500">
                    {b.address.slice(0, 40)} ·{" "}
                    {new Date(b.scheduledFor).toLocaleDateString("en-IN")}
                  </p>
                </Link>
                <MonoBadge
                  tone={
                    b.status === "cancelled"
                      ? "neutral"
                      : b.status === "settled" || b.status === "completed"
                        ? "ok"
                        : "saffron"
                  }
                >
                  {t(`st_${b.status}`)}
                </MonoBadge>
                <span className="text-xs font-bold text-slate-900">
                  ₹{b.total}
                </span>
                {!["completed", "settled", "cancelled"].includes(b.status) && (
                  <button
                    type="button"
                    onClick={() => void adminCancel({ id: b._id })}
                    className="rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 transition hover:bg-rose-100"
                  >
                    {t("ad_cancel")}
                  </button>
                )}
              </div>
            ))}
            {(bookings ?? []).length === 0 && (
              <p className="py-10 text-center text-xs text-slate-500">
                {t("bks_empty")}
              </p>
            )}
          </div>
        </Panel>
      </main>
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
  tone = "neutral",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "neutral" | "ok" | "orange";
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
      <div className="flex items-center gap-1.5">
        <span
          className={
            tone === "ok"
              ? "text-emerald-600"
              : tone === "orange"
                ? "text-orange-600"
                : "text-slate-400"
          }
        >
          {icon}
        </span>
        <span className="tl-label">{label}</span>
      </div>
      <p
        className={`mt-1.5 text-xl font-black tracking-tight ${
          tone === "ok"
            ? "text-emerald-800"
            : tone === "orange"
              ? "text-orange-800"
              : "text-slate-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
