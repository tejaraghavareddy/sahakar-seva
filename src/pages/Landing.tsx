import {
  useQuery,
} from "convex/react";
import { api } from "@/convex/_generated/api";
import { Link, useNavigate } from "react-router";
import { useAuth } from "@/hooks/use-auth";
import { useLang } from "@/lib/i18n";
import { TRADES, getTrade } from "@/lib/trades";
import {
  LanguagePicker,
  MonoBadge,
  Panel,
  SectionHeader,
  StatusDot,
  TlButton,
} from "@/components/terminal";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  LayoutDashboard,
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
      color: "saffron",
      title: t("portal_workers_t"),
      desc: t("portal_workers_d"),
      cta: isAuthenticated ? t("nav_hub") : t("cta_join"),
    },
    {
      key: "customers",
      to: "/services",
      icon: Store,
      color: "teal",
      title: t("portal_customers_t"),
      desc: t("portal_customers_d"),
      cta: isAuthenticated ? t("nav_services") : t("signin"),
    },
    {
      key: "admin",
      to: "/admin",
      icon: ShieldCheck,
      color: "plum",
      title: t("portal_admin_t"),
      desc: t("portal_admin_d"),
      cta: t("portal_open"),
    },
  ];

  return (
    <div className="tl-shell flex flex-col">
      {/* ── Top band ─────────────────────────────────────────── */}
      <header className="tl-band sticky top-0 z-40">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex size-7 items-center justify-center rounded-sm border border-foreground bg-foreground text-xs font-bold text-background">
              &gt;_
            </span>
            <span className="text-sm font-bold tracking-tight">
              sahakar-seva
              <span className="hidden text-muted-foreground sm:inline">
                {" "}
                / {t("nav_tag")}
              </span>
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

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="tl-glow border-b border-border">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="mx-auto max-w-3xl text-center"
          >
            <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-sm border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
              <span className="text-ok">{">_"}</span>
              <span>{t("hero_kicker")}</span>
              <span className="tl-caret" aria-hidden />
            </div>
            <h1 className="text-balance text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
              {t("hero_title")}
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-pretty text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
              {t("hero_sub")}
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link to="/services">
                <TlButton variant="saffron" className="tl-btn-saffron">
                  {t("nav_services")}
                  <ArrowRight className="size-4" />
                </TlButton>
              </Link>
              <Link to="/auth?returnTo=%2Fonboarding">
                <TlButton variant="primary">
                  {t("cta_start")}
                  <ArrowRight className="size-4" />
                </TlButton>
              </Link>
            </div>
          </motion.div>

          {/* stat strip */}
          <div className="mx-auto mt-12 grid max-w-4xl grid-cols-2 gap-px overflow-hidden rounded-sm border border-border bg-border sm:grid-cols-4">
            <Stat label={t("stat_artisans")} value={fmt(stats.total)} icon="▣" />
            <Stat
              label={t("stat_online")}
              value={fmt(stats.online)}
              tone="ok"
            />
            <Stat
              label={t("stat_verified")}
              value={fmt(stats.verified)}
              icon={<BadgeCheck className="size-3.5" />}
            />
            <Stat
              label={t("stat_commission")}
              value="0%"
              tone="saffron"
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
            const accent =
              p.color === "saffron"
                ? "border-saffron/40"
                : p.color === "teal"
                  ? "border-teal/40"
                  : "border-plum/40";
            const chip =
              p.color === "saffron"
                ? "bg-saffron-soft text-saffron"
                : p.color === "teal"
                  ? "bg-teal-soft text-teal"
                  : "bg-plum-soft text-plum";
            return (
              <motion.div
                key={p.key}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.35, delay: i * 0.06 }}
              >
                <Panel className={`h-full border-t-2 ${accent}`}>
                  <span
                    className={`flex size-10 items-center justify-center rounded-sm ${chip}`}
                  >
                    <Icon className="size-5" />
                  </span>
                  <p className="mt-4 text-sm font-bold">{p.title}</p>
                  <p className="mt-1.5 min-h-[3.5rem] text-xs leading-5 text-muted-foreground">
                    {p.desc}
                  </p>
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
      <section className="border-y border-border bg-card">
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
                  <Panel className="h-full text-center">
                    <span
                      className={`mx-auto flex size-10 items-center justify-center rounded-sm ${
                        trade.color === "saffron"
                          ? "bg-saffron-soft text-saffron"
                          : trade.color === "blue"
                            ? "bg-blue-soft text-blue"
                            : trade.color === "amber"
                              ? "bg-warn-soft text-warn"
                              : trade.color === "forest"
                                ? "bg-forest-soft text-forest"
                                : trade.color === "plum"
                                  ? "bg-plum-soft text-plum"
                                  : "bg-teal-soft text-teal"
                      }`}
                    >
                      <Icon className="size-5" />
                    </span>
                    <p className="mt-3 text-xs font-bold">{trade.id}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      ₹{fmt(trade.baseRate)} {t("per_day")}
                    </p>
                    <p className="mt-1 text-[10px] font-semibold text-ok">
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
        <div className="mt-6 grid grid-cols-1 gap-px overflow-hidden rounded-sm border border-border bg-border md:grid-cols-4">
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
              className="bg-card p-5"
            >
              <span className="text-xs font-bold text-saffron">{n}</span>
              <p className="mt-2 text-sm font-bold">{title}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {desc}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className="mt-auto border-t border-border bg-card">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Users className="size-3.5" />
            <span>{t("footer_note")}</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
            <LayoutDashboard className="size-3.5" />
            <span>workers · customers · admin</span>
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
  tone = "neutral",
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  tone?: "neutral" | "ok" | "saffron";
}) {
  return (
    <div className="bg-card px-4 py-4">
      <div className="flex items-center gap-1.5">
        {tone === "ok" ? (
          <StatusDot tone="ok" blink />
        ) : (
          <span
            className={
              tone === "saffron" ? "text-saffron" : "text-muted-foreground"
            }
          >
            {icon ?? "▸"}
          </span>
        )}
        <span className="tl-label">{label}</span>
      </div>
      <p
        className={`mt-1.5 text-2xl font-bold tracking-tight ${
          tone === "ok" ? "text-ok" : tone === "saffron" ? "text-saffron" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}
