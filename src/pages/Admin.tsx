import { Link } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useLang } from "@/lib/i18n";
import { getTrade, COLOR_SOFT, COLOR_TEXT } from "@/lib/trades";
import { AppHeader } from "@/components/AppHeader";
import { MonoBadge, Panel, StatusDot, TlButton } from "@/components/terminal";
import { Loader2, ShieldAlert, Users, CalendarCheck, Wallet, HeartPulse } from "lucide-react";

export default function Admin() {
  const { t } = useLang();
  const overview = useQuery(api.admin.overview, {});
  const directory = useQuery(api.admin.workerDirectory, {});
  const bookings = useQuery(api.bookings.listForAdmin, {});
  const adminCancel = useMutation(api.admin.adminCancelBooking);

  if (overview === undefined) {
    return (
      <div className="tl-shell">
        <AppHeader />
        <main className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </main>
      </div>
    );
  }

  if (overview === null) {
    return (
      <div className="tl-shell">
        <AppHeader />
        <main className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full border border-warn/40 bg-warn-soft">
            <ShieldAlert className="size-6 text-warn" />
          </span>
          <h1 className="mt-4 text-lg font-bold">{t("ad_no_access")}</h1>
          <Link to="/" className="mt-4 inline-block">
            <TlButton variant="outline">{t("nav_home")}</TlButton>
          </Link>
        </main>
      </div>
    );
  }

  const pipeline = Object.entries(overview.byStatus);

  return (
    <div className="tl-shell">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight">{t("ad_title")}</h1>
        <p className="mt-1 text-xs text-muted-foreground">{t("ad_sub")}</p>

        {/* Stat tiles */}
        <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-border bg-border lg:grid-cols-5">
          <StatTile icon={<Users className="size-3.5" />} label={t("ad_workers")} value={String(overview.workers)} />
          <StatTile
            icon={<StatusDot tone="ok" blink />}
            label={t("ad_online")}
            value={String(overview.online)}
            tone="ok"
          />
          <StatTile icon={<CalendarCheck className="size-3.5" />} label={t("ad_bookings")} value={String(overview.bookings)} />
          <StatTile
            icon={<Wallet className="size-3.5" />}
            label={t("ad_settled")}
            value={`₹${overview.revenueSettled.toLocaleString("en-IN")}`}
          />
          <StatTile
            icon={<HeartPulse className="size-3.5" />}
            label={t("ad_welfare")}
            value={`₹${overview.welfarePool.toLocaleString("en-IN")}`}
            tone="saffron"
          />
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-5">
          {/* Booking pipeline */}
          <Panel title={t("ad_pipeline")} className="lg:col-span-2" bodyClassName="p-4">
            <div className="space-y-2">
              {pipeline.length === 0 && (
                <p className="py-6 text-center text-xs text-muted-foreground">
                  {t("bks_empty")}
                </p>
              )}
              {pipeline.map(([status, count]) => (
                <div key={status} className="flex items-center justify-between gap-3">
                  <MonoBadge tone={status === "cancelled" ? "neutral" : status === "settled" || status === "completed" ? "ok" : "saffron"}>
                    {t(`st_${status}`)}
                  </MonoBadge>
                  <div className="flex flex-1 items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
                      <div
                        className="h-full rounded-full bg-forest"
                        style={{
                          width: `${Math.round((count / Math.max(overview.bookings, 1)) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="w-6 text-right text-xs font-bold">{count}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 border-t border-dashed border-border pt-3 text-xs">
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
          <Panel title={t("ad_directory")} className="lg:col-span-3" bodyClassName="p-0">
            <div className="max-h-[420px] overflow-y-auto">
              {(directory ?? []).map((a) => {
                const trade = getTrade(a.trade);
                const Icon = trade?.icon;
                return (
                  <div
                    key={a._id}
                    className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0"
                  >
                    <span
                      className={`flex size-8 shrink-0 items-center justify-center rounded-sm ${COLOR_SOFT[trade?.color ?? "ok"]}`}
                    >
                      {Icon && <Icon className="size-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold">{a.fullName}</p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {a.district} · {a.phone}
                      </p>
                    </div>
                    <MonoBadge tone={a.kycStatus === "verified" ? "ok" : "warn"}>
                      {a.kycStatus === "verified" ? t("kyc_badge") : t("kyc_pending")}
                    </MonoBadge>
                    {a.credentialId && (
                      <code className="hidden text-[10px] text-ok sm:inline">
                        {a.credentialId}
                      </code>
                    )}
                    <StatusDot tone={a.isOnline ? "ok" : "idle"} blink={a.isOnline} />
                  </div>
                );
              })}
              {(directory ?? []).length === 0 && (
                <p className="py-10 text-center text-xs text-muted-foreground">
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
                className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0"
              >
                <Link
                  to={`/bookings/${b._id}`}
                  className="min-w-0 flex-1 hover:underline"
                >
                  <p className="truncate text-xs font-bold">{b.serviceName}</p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {b.address.slice(0, 40)} ·{" "}
                    {new Date(b.scheduledFor).toLocaleDateString("en-IN")}
                  </p>
                </Link>
                <MonoBadge tone={b.status === "cancelled" ? "neutral" : b.status === "settled" || b.status === "completed" ? "ok" : "saffron"}>
                  {t(`st_${b.status}`)}
                </MonoBadge>
                <span className="text-xs font-bold">₹{b.total}</span>
                {!["completed", "settled", "cancelled"].includes(b.status) && (
                  <button
                    type="button"
                    onClick={() => void adminCancel({ id: b._id })}
                    className="rounded-sm border border-destructive/40 px-2 py-1 text-[10px] font-semibold text-destructive hover:bg-destructive/5"
                  >
                    {t("ad_cancel")}
                  </button>
                )}
              </div>
            ))}
            {(bookings ?? []).length === 0 && (
              <p className="py-10 text-center text-xs text-muted-foreground">
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
  tone?: "neutral" | "ok" | "saffron";
}) {
  return (
    <div className="bg-card px-4 py-4">
      <div className="flex items-center gap-1.5">
        {tone === "ok" ? (
          <StatusDot tone="ok" blink />
        ) : (
          <span className={tone === "saffron" ? "text-saffron" : "text-muted-foreground"}>
            {icon}
          </span>
        )}
        <span className="tl-label">{label}</span>
      </div>
      <p
        className={`mt-1.5 text-xl font-bold tracking-tight ${
          tone === "ok" ? "text-ok" : tone === "saffron" ? "text-saffron" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}
