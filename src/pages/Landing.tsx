import {
  useQuery,
} from "convex/react";
import { api } from "@/convex/_generated/api";
import { Link, useNavigate } from "react-router";
import { useAuth } from "@/hooks/use-auth";
import { useLang } from "@/lib/i18n";
import { TRADES } from "@/lib/trades";
import {
  LanguagePicker,
  Panel,
  SectionHeader,
  TlButton,
} from "@/components/terminal";
import { COLOR_SOFT } from "@/lib/trades";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  HandHeart,
  ShieldCheck,
  Store,
  Users,
  Wrench,
} from "lucide-react";

function fmt(n: number | undefined): string {
  return (n ?? 0).toLocaleString("en-IN");
}

export default function Landing() {
  const { t } = useLang();
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  const stats = useQuery(api.artisans.federationStats, {}) ?? {
    total: 0,
    online: 0,
    verified: 0,
    byTrade: {},
  };

  const portals = [
    {
      key: "workers",
      to: "/onboarding",
      icon: Wrench,
      tone: "saffron" as const,
      title: t("portal_workers_t"),
      desc: t("portal_workers_d"),
      cta: isAuthenticated ? t("nav_hub") : t("cta_join"),
    },
    {
      key: "customers",
      to: "/services",
      icon: Store,
      tone: "teal" as const,
      title: t("portal_customers_t"),
      desc: t("portal_customers_d"),
      cta: isAuthenticated ? t("nav_services") : t("signin"),
    },
    {
      key: "admin",
      to: "/admin",
      icon: ShieldCheck,
      tone: "forest" as const,
      title: t("portal_admin_t"),
      desc: t("portal_admin_d"),
      cta: t("portal_open"),
    },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      {/* ── Top band ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-800 text-white">
              <HandHeart className="size-4" />
            </span>
            <span className="text-sm font-bold tracking-tight text-slate-900">
              Sahakar Seva
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <LanguagePicker />
            {!isLoading && isAuthenticated ? (
              <TlButton onClick={() => navigate("/dashboard")}>
                {t("cta_dashboard")}
              </TlButton>
            ) : (
              <Link to="/auth?returnTo=%2Fonboarding">
                <TlButton variant="outline">{t("signin")}</TlButton>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero banner ──────────────────────────────────────── */}
      <section className="bg-gradient-to-b from-emerald-800 via-teal-800 to-slate-900">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="mx-auto max-w-3xl text-center"
          >
            <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-emerald-100">
              <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
              {t("hero_kicker")}
            </div>
            <h1 className="text-balance text-2xl font-black leading-tight tracking-tight text-white sm:text-4xl">
              {t("hero_title")}
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-pretty text-sm leading-6 text-emerald-100 sm:text-base sm:leading-7">
              {t("hero_sub")}
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link to="/services">
                <TlButton className="bg-white text-emerald-900 shadow-sm hover:bg-emerald-50">
                  {t("nav_services")}
                  <ArrowRight className="size-4" />
                </TlButton>
              </Link>
              <Link to="/auth?returnTo=%2Fonboarding">
                <TlButton
                  variant="outline"
                  className="border-white/20 bg-white/10 text-white hover:bg-white/20"
                >
                  {t("cta_start")}
                  <ArrowRight className="size-4" />
                </TlButton>
              </Link>
            </div>
          </motion.div>

          {/* stat strip */}
          <div className="mx-auto mt-14 grid max-w-4xl grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label={t("stat_artisans")} value={fmt(stats.total)} />
            <Stat
              label={t("stat_online")}
              value={fmt(stats.online)}
              dot
            />
            <Stat
              label={t("stat_verified")}
              value={fmt(stats.verified)}
              icon={<BadgeCheck className="size-3.5" />}
            />
            <Stat
              label={t("stat_commission")}
              value="0%"
              tone="amber"
              icon={<span className="text-xs font-bold">₹</span>}
            />
          </div>
        </div>
        <div className="tl-keyline h-1.5 w-full" aria-hidden />
      </section>

      {/* ── Three portals ────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
        <SectionHeader index="[01]" title={t("portals_title")} sub={t("portals_sub")} />
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {portals.map((p, i) => {
            const Icon = p.icon;
            const chip =
              p.tone === "saffron"
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : p.tone === "teal"
                  ? "bg-teal-50 text-teal-700 border-teal-200"
                  : "bg-emerald-50 text-emerald-800 border-emerald-200";
            return (
              <motion.div
                key={p.key}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.35, delay: i * 0.06 }}
              >
                <Panel className="flex h-full flex-col justify-between hover:border-emerald-300">
                  <div>
                    <span
                      className={`flex size-10 items-center justify-center rounded-xl border ${chip}`}
                    >
                      <Icon className="size-5" />
                    </span>
                    <p className="mt-4 text-base font-bold text-slate-900">
                      {p.title}
                    </p>
                    <p className="mt-1.5 min-h-[3.5rem] text-sm leading-6 text-slate-600">
                      {p.desc}
                    </p>
                  </div>
                  <Link to={p.to}>
                    <TlButton variant="outline" className="mt-4 w-full">
                      {p.cta}
                      <ArrowRight className="size-4" />
                    </TlButton>
                  </Link>
                </Panel>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ── Trades strip ─────────────────────────────────────── */}
      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
          <SectionHeader index="[02]" title={t("trades_title")} sub={t("trades_sub")} />
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {TRADES.map((trade, i) => {
              const Icon = trade.icon;
              const count = stats.byTrade?.[trade.id] ?? 0;
              return (
                <motion.div
                  key={trade.id}
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: i * 0.04 }}
                >
                  <Panel className="h-full text-center hover:border-emerald-300">
                    <span
                      className={`mx-auto flex size-10 items-center justify-center rounded-xl border ${COLOR_SOFT[trade.color]}`}
                    >
                      <Icon className="size-5" />
                    </span>
                    <p className="mt-3 text-xs font-bold capitalize text-slate-900">
                      {trade.id}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      ₹{fmt(trade.baseRate)} {t("per_day")}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold text-emerald-700">
                      {fmt(count)} reg
                    </p>
                  </Panel>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── How onboarding works ─────────────────────────────── */}
      <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
        <SectionHeader index="[03]" title={t("how_title")} />
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          {(
            [
              ["01", t("step_profile"), t("how1_desc")],
              ["02", t("step_identity"), t("how2_desc")],
              ["03", t("step_skill"), t("how3_desc")],
              ["04", t("step_credential"), t("how4_desc")],
            ] as const
          ).map(([n, title, desc], i) => (
            <motion.div
              key={n}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
            >
              <Panel className="h-full hover:border-emerald-300">
                <span className="flex size-8 items-center justify-center rounded-xl bg-emerald-800 text-xs font-bold text-white">
                  {n}
                </span>
                <p className="mt-3 text-sm font-bold text-slate-900">{title}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">{desc}</p>
              </Panel>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className="mt-auto border-t border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Users className="size-4 text-slate-400" />
            <span>{t("footer_note")}</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
            workers · customers · admin
          </div>
        </div>
      </footer>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  dot,
  tone = "neutral",
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  dot?: boolean;
  tone?: "neutral" | "amber";
}) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
      <div className="flex items-center gap-1.5">
        {dot ? (
          <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
        ) : (
          <span
            className={
              tone === "amber" ? "text-amber-300" : "text-emerald-300"
            }
          >
            {icon ?? "▸"}
          </span>
        )}
        <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-100/80">
          {label}
        </span>
      </div>
      <p
        className={`mt-1.5 text-2xl font-black tracking-tight text-white sm:text-3xl ${
          tone === "amber" ? "" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}
