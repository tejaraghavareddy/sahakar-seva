import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useLang } from "@/lib/i18n";
import { SERVICES, TRADES, COLOR_SOFT } from "@/lib/trades";
import { AppHeader } from "@/components/AppHeader";
import { MonoBadge, TlButton } from "@/components/terminal";
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
    <div className="tl-shell">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight">
          {t("browse_title")}
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">{t("browse_sub")}</p>

        {/* Search + filters */}
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <input
              className="tl-input pl-9"
              placeholder={t("cat_search_ph")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setTrade("all")}
            className={`rounded-sm border px-3 py-1.5 text-xs font-semibold transition-colors ${
              trade === "all"
                ? "border-foreground bg-foreground text-background"
                : "border-input bg-card hover:bg-secondary"
            }`}
          >
            {t("cat_all")}
          </button>
          {TRADES.map((tr) => {
            const active = trade === tr.id;
            return (
              <button
                key={tr.id}
                type="button"
                onClick={() => setTrade(tr.id)}
                className={`rounded-sm border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  active
                    ? "border-foreground bg-foreground text-background"
                    : "border-input bg-card hover:bg-secondary"
                }`}
              >
                {tr.id}
              </button>
            );
          })}
        </div>

        {/* Grid */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => {
            const Icon = s.icon;
            const soft = COLOR_SOFT[s.color] ?? COLOR_SOFT.ok;
            return (
              <Link key={s.id} to={`/services/${s.id}`}>
                <article className="tl-panel h-full p-5 transition-shadow hover:shadow-md">
                  <div className="flex items-start justify-between">
                    <span
                      className={`flex size-10 items-center justify-center rounded-sm ${soft}`}
                    >
                      <Icon className="size-5" />
                    </span>
                    {s.urgent && (
                      <MonoBadge tone="warn">
                        <Zap className="size-3" /> {t("sv_urgent")}
                      </MonoBadge>
                    )}
                  </div>
                  <h2 className="mt-3.5 text-sm font-bold">{s.name}</h2>
                  <p className="tl-line-clamp-2 mt-1 text-xs leading-5 text-muted-foreground">
                    {s.desc}
                  </p>
                  <div className="mt-4 flex items-center justify-between border-t border-dashed border-border pt-3">
                    <div>
                      <p className="tl-label">{t("sv_base")}</p>
                      <p className="text-sm font-bold">₹{s.base}</p>
                      {s.hourly > 0 && (
                        <p className="text-[10px] text-muted-foreground">
                          + ₹{s.hourly} {t("sv_hourly")}
                        </p>
                      )}
                    </div>
                    <TlButton variant="outline" className="h-8 px-3 text-xs">
                      {t("sv_view")}
                      <ArrowRight className="size-3.5" />
                    </TlButton>
                  </div>
                </article>
              </Link>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <p className="py-16 text-center text-xs text-muted-foreground">
            {t("bks_empty")}
          </p>
        )}
      </main>
    </div>
  );
}
