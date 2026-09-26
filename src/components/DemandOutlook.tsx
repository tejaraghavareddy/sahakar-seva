import { useQuery } from "convex/react";
import { CloudRain, TrendingUp } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useLang } from "@/lib/i18n";
import { MonoBadge, Panel } from "@/components/terminal";
import RatingStars from "@/components/RatingStars";

/**
 * What this worker's own trade looks like this week.
 *
 * Prediction that only reaches the dispatch desk is half a prediction. The
 * forecast already names a hot trade; this is the same signal delivered to the
 * person who can act on it — keep the drain kit ready, expect a busy Thursday —
 * without any of it being a promise about income.
 */
export default function DemandOutlook() {
  const { t } = useLang();
  const outlook = useQuery(api.demand.myOutlook, {});
  if (!outlook) return null;

  const tone =
    outlook.outlook.expectedDemand === "high"
      ? "saffron"
      : outlook.outlook.expectedDemand === "elevated"
        ? "warn"
        : "neutral";

  return (
    <Panel
      title={t("dl_title")}
      bodyClassName="p-4"
      className={outlook.outlook.isTopTrade ? "border-amber-200" : undefined}
    >
      <div className="flex flex-wrap items-center gap-2">
        <MonoBadge tone={tone}>
          {outlook.outlook.isTopTrade ? (
            <TrendingUp className="size-3" />
          ) : (
            <CloudRain className="size-3" />
          )}
          {t(`dl_${outlook.outlook.expectedDemand}`)}
        </MonoBadge>
        <span className="text-[11px] font-semibold text-slate-500">
          {outlook.trade}
        </span>
        {outlook.ratingCount > 0 && (
          <span className="ml-auto">
            <RatingStars
              value={outlook.ratingAvg ?? 0}
              count={outlook.ratingCount}
              size="sm"
            />
          </span>
        )}
      </div>

      {outlook.outlook.reason && (
        <p className="mt-2 text-xs leading-relaxed text-slate-600">
          {outlook.outlook.reason}
        </p>
      )}

      <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
        {t("dl_footnote")}
      </p>
    </Panel>
  );
}
