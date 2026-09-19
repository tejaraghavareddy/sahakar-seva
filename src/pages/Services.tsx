import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useLang } from "@/lib/i18n";
import { SERVICES, TRADES, COLOR_SOFT } from "@/lib/trades";
import { AppHeader } from "@/components/AppHeader";
import { MonoBadge } from "@/components/terminal";
import { Search, ArrowRight, Zap } from "lucide-react";

export default function Services() {
  const { t } = useLang();
  const [q, setQ] = useState("");
  const [trade, setTrade] = useState<string>("all");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return SERVICES.filter((s) => {
      const inTrade = trade === "all" || s.trade === trade;
      const inSearch =
        !needle ||
        s.name.toLowerCase().includes(needle) ||
        s.desc.toLowerCase().includes(needle) ||
        s.trade.includes(needle);
      return inTrade && inSearch;
    });
  }, [q, trade]);

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">
          {t("browse_title")}
        </h1>
        <p className="mt-1 text-sm text-slate-600">{t("browse_sub")}</p>

        {/* Search + filters */}
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
            <input
              className="tl-input pl-9"
              placeholder={t("cat_search_ph")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <FilterChip
            active={trade === "all"}
            onClick={() => setTrade("all")}
            label={t("cat_all")}
          />
          {TRADES.map((tr) => (
            <FilterChip
              key={tr.id}
              active={trade === tr.id}
              onClick={() => setTrade(tr.id)}
              label={tr.id}
            />
          ))}
        </div>

        {/* Grid */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => {
            const Icon = s.icon;
            const soft = COLOR_SOFT[s.color] ?? COLOR_SOFT.ok;
            return (
              <Link key={s.id} to={`/services/${s.id}`} className="h-full">
                <article className="flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-emerald-300">
                  <div>
                    <div className="flex items-start justify-between">
                      <span
                        className={`flex size-10 items-center justify-center rounded-xl border ${soft}`}
                      >
                        <Icon className="size-5" />
                      </span>
                      {s.urgent && (
                        <MonoBadge tone="warn">
                          <Zap className="size-3" /> {t("sv_urgent")}
                        </MonoBadge>
                      )}
                    </div>
                    <h2 className="mt-3.5 text-sm font-bold text-slate-900">
                      {s.name}
                    </h2>
                    <p className="tl-line-clamp-2 mt-1 text-sm leading-6 text-slate-600">
                      {s.desc}
                    </p>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                    <div>
                      <p className="tl-label">{t("sv_base")}</p>
                      <p className="text-sm font-bold text-slate-900">₹{s.base}</p>
                      {s.hourly > 0 && (
                        <p className="text-[11px] text-slate-400">
                          + ₹{s.hourly} {t("sv_hourly")}
                        </p>
                      )}
                    </div>
                    <span className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-emerald-700 transition hover:bg-emerald-50">
                      {t("sv_view")}
                      <ArrowRight className="size-3.5" />
                    </span>
                  </div>
                </article>
              </Link>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <p className="py-16 text-center text-sm text-slate-500">
            {t("bks_empty")}
          </p>
        )}
      </main>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold capitalize transition ${
        active
          ? "border-emerald-600 bg-emerald-600 text-white"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      {label}
    </button>
  );
}
