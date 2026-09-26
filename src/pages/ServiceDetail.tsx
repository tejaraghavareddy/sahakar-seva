import { Link, useNavigate, useParams } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useLang } from "@/lib/i18n";
import { getService, getTrade, COLOR_SOFT, isCustomServiceId, listingAsService } from "@/lib/trades";
import { AppHeader } from "@/components/AppHeader";
import { BackToHome } from "@/components/BackToHome";
import { Panel, SectionHeader, TlButton, StatusDot } from "@/components/terminal";
import { RevenueSplitBar } from "@/components/RevenueSplit";
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  Loader2,
  Zap,
  ShieldCheck,
  ListChecks,
} from "lucide-react";

export default function ServiceDetail() {
  const { id } = useParams();
  const { t } = useLang();
  const navigate = useNavigate();
  const svc = getService(id ?? "");
  // A worker-created listing is addressed as `cs_<id>`; it is only bookable
  // once the board approved it, so an unapproved id reads as "not found".
  const custom = useQuery(api.customServices.approvedByRouteId, {
    serviceId: isCustomServiceId(id ?? "") ? (id as string) : "none",
  });
  const listing = custom ?? null;
  const shown = svc ?? (listing ? listingAsService(listing) : undefined);

  const stats = useQuery(api.artisans.federationStats, {}) ?? {
    total: 0,
    online: 0,
    verified: 0,
    byTrade: {},
  };

  if (!shown) {
    if (isCustomServiceId(id ?? "") && custom === undefined) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="size-6 animate-spin text-slate-400" />
        </div>
      );
    }
    return (
      <div className="min-h-screen">
        <AppHeader />
        <main className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
          <p className="text-sm text-slate-500">Service not found.</p>
          <Link to="/services" className="mt-4 inline-block">
            <TlButton variant="outline">{t("bks_browse")}</TlButton>
          </Link>
        </main>
      </div>
    );
  }

  const trade = getTrade(shown.trade);
  const TradeIcon = trade?.icon;
  const soft = COLOR_SOFT[shown.color] ?? COLOR_SOFT.ok;
  const workersForTrade = stats.byTrade?.[shown.trade] ?? 0;

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <BackToHome />
          <span className="text-slate-300">·</span>
          <Link
          to="/services"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-emerald-700"
        >
          <ArrowLeft className="size-3.5" />
          {t("bks_browse")}
        </Link>
        </div>

        <div className="mt-5 grid gap-5 md:grid-cols-5">
          {/* Main info */}
          <div className="md:col-span-3">
            <Panel bodyClassName="p-6">
              <div className="flex items-start gap-4">
                <span
                  className={`flex size-14 shrink-0 items-center justify-center rounded-2xl border ${soft}`}
                >
                  {TradeIcon && <TradeIcon className="size-7" />}
                </span>
                <div>
                  <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
                    {shown.name}
                  </h1>
                  <p className="mt-1 text-xs font-semibold capitalize text-slate-400">
                    {listing ? `${t("wc_own_category")}: ${listing.category}` : `${shown.trade} · ${t("cat_all")}`}
                  </p>
                  {listing && (
                    <p className="mt-0.5 text-[11px] font-semibold text-emerald-700">
                      {t("wc_by_worker", { name: listing.workerName })} · {listing.district}
                    </p>
                  )}
                </div>
              </div>

              {shown.urgent && (
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
                  <Zap className="size-4" />
                  {t("sv_urgent")} — {t("bk_asap")}
                </div>
              )}

              <div className="mt-5">
                <SectionHeader title={t("dt_includes")} />
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {shown.desc}
                </p>
                <ul className="mt-3 space-y-2 text-sm text-slate-600">
                  <li className="flex items-center gap-2">
                    <ListChecks className="size-3.5 text-emerald-600" />
                    {t("dt_price_note")}
                  </li>
                  <li className="flex items-center gap-2">
                    <Clock className="size-3.5 text-emerald-600" />
                    {shown.hourly > 0
                      ? `₹${shown.hourly} ${t("sv_hourly")}`
                      : t("fixed_job")}
                  </li>
                  <li className="flex items-center gap-2">
                    <ShieldCheck className="size-3.5 text-emerald-600" />
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
                <span className="text-xs text-slate-500">{t("sv_base")}</span>
                <span className="text-2xl font-black tracking-tight text-slate-900">
                  ₹{shown.base}
                </span>
              </div>
              {shown.hourly > 0 && (
                <p className="mt-1 text-right text-[11px] text-slate-400">
                  + ₹{shown.hourly} {t("sv_hourly")}
                </p>
              )}

              <div className="mt-4 flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2.5 text-xs font-bold text-teal-800">
                <StatusDot tone="ok" blink />
                {workersForTrade} {t("dt_workers")}
              </div>

              <div className="mt-4 border-t border-slate-200 pt-3">
                <RevenueSplitBar
                  compact
                  total={shown.base}
                  workerShare={Math.round(shown.base * 0.9)}
                  welfareAmt={Math.round(shown.base * 0.07)}
                  opsAmt={shown.base - Math.round(shown.base * 0.9) - Math.round(shown.base * 0.07)}
                />
                <p className="mt-1.5 text-[10px] font-semibold text-slate-400">
                  0% platform commission — workers keep 90%
                </p>
              </div>

              <TlButton
                className="mt-5 w-full"
                onClick={() => navigate(`/book/${shown.id}`)}
              >
                {t("dt_book")}
                <ArrowRight className="size-4" />
              </TlButton>
              <p className="mt-3 text-center text-[11px] text-slate-400">
                {t("bd_upi_note")}
              </p>
            </Panel>
          </div>
        </div>
      </main>
    </div>
  );
}
