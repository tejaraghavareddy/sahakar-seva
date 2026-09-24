import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Sparkles } from "lucide-react";

/**
 * "Cooperative Demand & Fair-Price Forecasting" card — Gemini AI engine.
 * Rendered in the worker dashboard and the admin console (not public).
 */
export default function ForecastCard() {
  const aiForecast = useQuery(api.forecasts.publicLatest, {});

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <h2 className="max-w-[16rem] text-2xl font-black italic leading-tight tracking-tight text-slate-900 sm:max-w-none sm:text-3xl">
          Cooperative Demand &amp; Fair-Price Forecasting
        </h2>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3.5 py-2 text-right text-sm font-black italic leading-tight text-amber-700 shadow-xs">
          <Sparkles className="size-4 shrink-0" />
          <span>
            Gemini
            <br />
            AI Engine
          </span>
        </span>
      </div>
      <p className="mt-3 text-sm italic leading-relaxed text-slate-400 sm:text-base">
        Machine learning analysis of weather, festival seasons, and historical
        trade demand to avoid predatory surge pricing
      </p>

      <div className="mt-7 space-y-5">
        {/* Forecasted high-demand trade */}
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 px-5 py-5">
          <p className="text-sm font-black uppercase italic tracking-wide text-emerald-800">
            Forecasted High-Demand Trade
          </p>
          <p className="mt-2 text-xl font-black capitalize italic text-emerald-900">
            {aiForecast?.topTrade ?? "—"}
          </p>
          <p className="mt-2 text-sm font-semibold italic text-emerald-800">
            Reason:{" "}
            <span className="font-medium">
              {aiForecast?.topTradeReason ?? "Analyzing seasonal demand patterns…"}
            </span>
          </p>
        </div>

        {/* Recommended cooperative fair rate */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-5">
          <p className="text-sm font-black uppercase italic tracking-wide text-slate-700">
            Recommended Cooperative Fair Rate
          </p>
          <p className="mt-1 text-3xl font-black italic text-slate-900">
            ₹{aiForecast ? aiForecast.fairRatePerHour.toLocaleString("en-IN") : "—"}
            <span className="text-xl">/hr</span>
          </p>
          <p className="mt-2 text-sm font-semibold italic text-slate-500">
            Guarantees livable wage while protecting consumer equity across
            housing societies.
          </p>
        </div>

        {/* AI confidence level */}
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 px-5 py-5">
          <p className="text-sm font-black uppercase italic tracking-wide text-amber-700">
            AI Confidence Level
          </p>
          <p className="mt-1 text-3xl font-black italic text-amber-900">
            {aiForecast ? `${Math.round(aiForecast.confidence)}%` : "—"}
          </p>
          <p className="mt-2 text-sm font-semibold italic text-amber-800">
            Calculated across historical job completions in the federation
            cluster.
          </p>
        </div>
      </div>
    </div>
  );
}
