import { Link, useNavigate, useParams } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useLang } from "@/lib/i18n";
import { getService, getTrade, COLOR_SOFT, TRADES } from "@/lib/trades";
import { AppHeader } from "@/components/AppHeader";
import { MonoBadge, Panel, SectionHeader, TlButton } from "@/components/terminal";
import { ArrowLeft, ArrowRight, BadgeCheck, Clock, Zap, ShieldCheck, ListChecks } from "lucide-react";

export default function ServiceDetail() {
  const { id } = useParams();
  const { t } = useLang();
  const navigate = useNavigate();
  const svc = getService(id ?? "");

  const stats = useQuery(api.artisans.federationStats, {}) ?? {
    total: 0,
    online: 0,
    verified: 0,
    byTrade: {},
  };

  if (!svc) {
    return (
      <div className="tl-shell">
        <AppHeader />
        <main className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
          <p className="text-sm text-muted-foreground">Service not found.</p>
          <Link to="/services" className="mt-4 inline-block">
            <TlButton variant="outline">{t("bks_browse")}</TlButton>
          </Link>
        </main>
      </div>
    );
  }

  const trade = getTrade(svc.trade);
  const TradeIcon = trade?.icon;
  const soft = COLOR_SOFT[svc.color] ?? COLOR_SOFT.ok;
  const workersForTrade = stats.byTrade?.[svc.trade] ?? 0;

  return (
    <div className="tl-shell">
      <AppHeader />
      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        <Link
          to="/services"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          {t("bks_browse")}
        </Link>

        <div className="mt-5 grid gap-5 md:grid-cols-5">
          {/* Main info */}
          <div className="md:col-span-3">
            <Panel bodyClassName="p-6">
              <div className="flex items-start gap-4">
                <span
                  className={`flex size-14 shrink-0 items-center justify-center rounded-sm ${soft}`}
                >
                  {TradeIcon && <TradeIcon className="size-7" />}
                </span>
                <div>
                  <h1 className="text-xl font-bold tracking-tight">{svc.name}</h1>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {svc.trade} · {t("cat_all")}
                  </p>
                </div>
              </div>

              {svc.urgent && (
                <div className="mt-4 flex items-center gap-2 rounded-sm border border-warn/40 bg-warn-soft px-3 py-2 text-xs font-semibold text-warn">
                  <Zap className="size-4" />
                  {t("sv_urgent")} — {t("bk_asap")}
                </div>
              )}

              <div className="mt-5">
                <SectionHeader title={t("dt_includes")} />
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {svc.desc}
                </p>
                <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <ListChecks className="size-3.5 text-ok" />
                    {t("dt_price_note")}
                  </li>
                  <li className="flex items-center gap-2">
                    <Clock className="size-3.5 text-ok" />
                    {svc.hourly > 0
                      ? `₹${svc.hourly} ${t("sv_hourly")}`
                      : t("fixed_job")}
                  </li>
                  <li className="flex items-center gap-2">
                    <ShieldCheck className="size-3.5 text-ok" />
                    {t("kyc_badge")} · 0% {t("stat_commission")}
                  </li>
                </ul>
              </div>
            </Panel>
          </div>

          {/* Booking card */}
          <div className="md:col-span-2">
            <Panel title={t("bk_summary")} bodyClassName="p-6">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-muted-foreground">
                  {t("sv_base")}
                </span>
                <span className="text-2xl font-bold tracking-tight">
                  ₹{svc.base}
                </span>
              </div>
              {svc.hourly > 0 && (
                <p className="mt-1 text-right text-[10px] text-muted-foreground">
                  + ₹{svc.hourly} {t("sv_hourly")}
                </p>
              )}

              <div className="mt-4 rounded-sm border border-ok/25 bg-ok-soft px-3 py-2.5 text-xs text-forest">
                <div className="flex items-center gap-2 font-semibold">
                  <BadgeCheck className="size-4" />
                  {workersForTrade} {t("dt_workers")}
                </div>
              </div>

              <TlButton
                variant="saffron"
                className="tl-btn-saffron mt-5 w-full"
                onClick={() => navigate(`/book/${svc.id}`)}
              >
                {t("dt_book")}
                <ArrowRight className="size-4" />
              </TlButton>
              <p className="mt-3 text-center text-[10px] text-muted-foreground">
                {t("bd_upi_note")}
              </p>
            </Panel>
          </div>
        </div>
      </main>
    </div>
  );
}
