import { Link } from "react-router";
import { Camera, MapPin, ShieldCheck, Star } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { getTrade, COLOR_SOFT } from "@/lib/trades";
import { isSlotSet, upcomingDays, type SlotPart } from "@/lib/slots";
import { MonoBadge } from "@/components/terminal";
import RatingStars from "@/components/RatingStars";

/**
 * A worker, browsable.
 *
 * The catalog has always organised itself around *services*, which is right for
 * booking and wrong for choosing. "Tap repair" tells you nothing about whether
 * this particular person is any good. This card is the other half: a household
 * comparing two plumbers needs the name, the years, the verification and the
 * rating side by side before they commit to an address and a slot.
 */
export default function WorkerCard({
  worker,
}: {
  worker: {
    _id: string;
    fullName: string;
    trade: string;
    district: string;
    experienceYears: number;
    kycStatus: string;
    skillStatus: string;
    /** Bitmask over the coming week — see lib/slots.ts. */
    slots: number;
    ratingAvg: number | null;
    ratingCount: number;
    completedJobs: number;
    isOnline: boolean;
  };
}) {
  const { t } = useLang();
  const trade = getTrade(worker.trade);
  const Icon = trade?.icon;
  const soft = COLOR_SOFT[trade?.color ?? "ok"] ?? COLOR_SOFT.ok;

  // The next two working slots, which is what a household actually decides on.
  const next = upcomingDays()
    .flatMap((d) =>
      (["morning", "afternoon", "evening"] as const)
        .filter((p) => isSlotSet(worker.slots, d.offset, p as SlotPart))
        .map((p) => `${d.label} ${t(`av_${p}`).toLowerCase()}`),
    )
    .slice(0, 2);

  return (
    <Link
      to={`/workers/${worker._id}`}
      className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-xs transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex size-10 shrink-0 items-center justify-center rounded-xl border ${soft}`}
        >
          {Icon && <Icon className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-900">
            {worker.fullName}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500">
            <MapPin className="size-3" />
            {worker.district} · {worker.experienceYears} {t("wp_years").toLowerCase()}
          </p>
        </div>
        {worker.isOnline && (
          <span className="size-2 shrink-0 animate-pulse rounded-full bg-emerald-500" />
        )}
      </div>

      <div className="mt-3">
        {worker.ratingCount > 0 ? (
          <RatingStars
            value={worker.ratingAvg ?? 0}
            count={worker.ratingCount}
            size="sm"
          />
        ) : (
          <p className="text-[11px] font-semibold text-slate-400">
            {t("wp_no_reviews")}
          </p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {worker.kycStatus === "verified" && (
          <MonoBadge tone="ok">
            <ShieldCheck className="size-3" /> {t("kyc_badge")}
          </MonoBadge>
        )}
        {worker.skillStatus === "verified" && (
          <MonoBadge tone="ok">
            <Camera className="size-3" /> {t("wp_work_verified")}
          </MonoBadge>
        )}
        {worker.ratingCount >= 5 && (
          <MonoBadge tone="saffron">
            <Star className="size-3 fill-amber-400" /> {t("wp_top_rated")}
          </MonoBadge>
        )}
      </div>

      <p className="mt-3 text-[11px] font-semibold text-slate-400">
        {worker.completedJobs} {t("wf_jobs").toLowerCase()}
        {next.length > 0 ? ` · ${next.join(" · ")}` : ""}
      </p>
      <p className="mt-1 text-[11px] font-bold text-emerald-700">
        {t("wp_tap")} →
      </p>
    </Link>
  );
}
