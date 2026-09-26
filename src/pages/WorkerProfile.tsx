import { Link, useParams } from "react-router";
import { useQuery } from "convex/react";
import {
  ArrowLeft,
  BadgeCheck,
  Camera,
  Clock,
  Loader2,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useLang } from "@/lib/i18n";
import { getTrade, COLOR_SOFT } from "@/lib/trades";
import { AppHeader } from "@/components/AppHeader";
import { BackToHome } from "@/components/BackToHome";
import { MonoBadge, Panel, SectionHeader } from "@/components/terminal";
import RatingStars from "@/components/RatingStars";
import { ReviewFeed } from "@/components/ReviewForm";
import { isSlotSet, upcomingDays, SLOT_PARTS, type SlotPart } from "@/lib/slots";

/**
 * A worker's public page — the page that makes reputation readable.
 *
 * A verification badge answers "is this person who they say they are". It does
 * not answer "should I let this person into my house", which is the question a
 * household is actually asking when it chooses between two plumbers. This is
 * where the second half lands: how long they have done the work, what they have
 * actually completed, and what the people who paid them said about it.
 *
 * Everything here comes from a projected query, so no phone number, document
 * digit, UPI address or live GPS crosses this boundary.
 */
export default function WorkerProfile() {
  const { id } = useParams();
  const { t } = useLang();
  const worker = useQuery(api.artisans.profile, {
    id: (id ?? "") as Id<"artisans">,
  });

  if (worker === undefined) {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <main className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="size-6 animate-spin text-slate-400" />
        </main>
      </div>
    );
  }

  if (worker === null) {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <main className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
          <p className="text-sm text-slate-500">{t("wp_missing")}</p>
          <Link to="/services" className="mt-4 inline-block">
            <MonoBadge tone="neutral">{t("bks_browse")}</MonoBadge>
          </Link>
        </main>
      </div>
    );
  }

  const trade = getTrade(worker.trade);
  const TradeIcon = trade?.icon;
  const soft = COLOR_SOFT[trade?.color ?? "ok"] ?? COLOR_SOFT.ok;
  const skillVerified = worker.skillStatus === "verified";

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
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

        {/* Identity card */}
        <Panel className="mt-5" bodyClassName="p-6">
          <div className="flex items-start gap-4">
            <span
              className={`flex size-14 shrink-0 items-center justify-center rounded-2xl border ${soft}`}
            >
              {TradeIcon && <TradeIcon className="size-7" />}
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
                {worker.fullName}
              </h1>
              <p className="mt-0.5 text-xs font-semibold text-slate-500">
                {trade?.id ?? worker.trade} · {worker.district}, {worker.state}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {worker.kycStatus === "verified" && (
                  <MonoBadge tone="ok">
                    <ShieldCheck className="size-3" /> {t("kyc_badge")}
                  </MonoBadge>
                )}
                {skillVerified && (
                  <MonoBadge tone="ok">
                    <Camera className="size-3" /> {t("wp_skill_verified")}
                  </MonoBadge>
                )}
                {worker.isOnline && (
                  <MonoBadge tone="saffron">
                    <Zap className="size-3" /> {t("wp_online")}
                  </MonoBadge>
                )}
              </div>
            </div>
          </div>

          {/* Reputation, front and centre */}
          <div className="mt-5 flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                {t("wp_reputation")}
              </p>
              <div className="mt-1">
                {worker.ratingCount > 0 ? (
                  <RatingStars
                    value={worker.ratingAvg ?? 0}
                    count={worker.ratingCount}
                    size="lg"
                  />
                ) : (
                  <p className="text-sm font-bold text-slate-500">
                    {t("wp_no_reviews")}
                  </p>
                )}
              </div>
            </div>
            <div className="ml-auto grid grid-cols-2 gap-2 text-center">
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                <p className="text-base font-black text-slate-900">
                  {worker.completedJobs}
                </p>
                <p className="text-[10px] font-semibold text-slate-500">
                  {t("wf_jobs")}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                <p className="text-base font-black text-slate-900">
                  {worker.experienceYears}
                </p>
                <p className="text-[10px] font-semibold text-slate-500">
                  {t("wp_years")}
                </p>
              </div>
            </div>
          </div>

          {/* Weekly availability, the same grid the worker edits */}
          <div className="mt-4">
            <p className="tl-label mb-2">{t("av_title")}</p>
            <div className="grid grid-cols-[64px_repeat(3,1fr)] gap-1.5">
              <span />
              {SLOT_PARTS.map((p) => (
                <span
                  key={p}
                  className="pb-1 text-center text-[10px] font-bold uppercase tracking-wide text-slate-400"
                >
                  {t(`av_${p}`)}
                </span>
              ))}
              {upcomingDays().map((d) => (
                <div key={d.offset} className="contents">
                  <span className="flex items-center text-[11px] font-semibold text-slate-600">
                    {d.label}
                  </span>
                  {SLOT_PARTS.map((p) => {
                    const on = isSlotSet(worker.slots, d.offset, p as SlotPart);
                    return (
                      <span
                        key={p}
                        className={`rounded-lg border py-1.5 text-center text-[10px] font-bold ${
                          on
                            ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                            : "border-slate-100 bg-slate-50 text-slate-300"
                        }`}
                      >
                        {on ? "✓" : "—"}
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {worker.credentialId && (
            <p className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
              <BadgeCheck className="size-3.5 text-emerald-600" />
              {t("wp_credential")} {worker.credentialId}
            </p>
          )}
          {worker.skillVerifiedAt && (
            <p className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400">
              <Clock className="size-3" />
              {t("wp_skill_on")}{" "}
              {new Date(worker.skillVerifiedAt).toLocaleDateString("en-IN", {
                dateStyle: "medium",
              })}
            </p>
          )}
        </Panel>

        {/* What this worker publishes */}
        {worker.listings.length > 0 && (
          <div className="mt-5">
            <SectionHeader title={t("wp_work")} />
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {worker.listings.map((l) => (
                <Link
                  key={l._id}
                  to={`/services/cs_${l._id}`}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs transition hover:border-emerald-300 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-bold text-slate-900">{l.name}</p>
                    {l.urgent && (
                      <MonoBadge tone="warn">
                        <Zap className="size-3" />
                      </MonoBadge>
                    )}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    {l.description}
                  </p>
                  <p className="mt-2 text-[11px] font-bold text-slate-500">
                    ₹{l.base}
                    {l.hourly > 0 ? ` + ₹${l.hourly}/${t("sv_hourly")}` : ""}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Reviews — the other half of the trust story */}
        <div className="mt-6 pb-14">
          <SectionHeader title={t("rv_title")} />
          <div className="mt-2">
            <ReviewFeed artisanId={worker._id} />
          </div>
        </div>
      </main>
    </div>
  );
}
