import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
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
import { Link, useNavigate } from "react-router";
import {
  ArrowRight,
  BadgeCheck,
  Cpu,
  Gauge,
  Languages,
  Mic,
  Radio,
  ShieldCheck,
  Terminal,
  UserPlus,
} from "lucide-react";

function fmt(n: number | undefined): string {
  return (n ?? 0).toLocaleString("en-IN");
}

export default function Landing() {
  const { t, lang } = useLang();
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const stats = useQuery(api.artisans.federationStats, {}) ?? {
    total: 0,
    online: 0,
    verified: 0,
    byTrade: {},
  };
  const feed = useQuery(api.artisans.listArtisans, {}) ?? [];
  const verifiedFeed = feed.filter((a) => a.credentialId).slice(0, 6);

  return (
    <div className="tl-shell flex flex-col">
      {/* ── Top band ─────────────────────────────────────────── */}
      <header className="tl-band sticky top-0 z-40">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex size-7 items-center justify-center rounded-sm border border-foreground bg-foreground text-background">
              <Terminal className="size-4" />
            </span>
            <span className="text-sm font-bold tracking-tight">
              sahakar-seva
              <span className="text-muted-foreground">/{t("nav_tag")}</span>
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
              <Link to="/auth?returnTo=%2Fonboarding">
                <TlButton variant="primary">
                  {t("cta_start")}
                  <ArrowRight className="size-4" />
                </TlButton>
              </Link>
              <Link to="/dashboard">
                <TlButton variant="outline">{t("cta_dashboard")}</TlButton>
              </Link>
            </div>
          </motion.div>

          {/* stat strip */}
          <div className="mx-auto mt-12 grid max-w-4xl grid-cols-2 gap-px overflow-hidden rounded-sm border border-border bg-border sm:grid-cols-4">
            <Stat label={t("stat_artisans")} value={fmt(stats.total)} icon="▣" />
            <Stat
              label={t("stat_online")}
              value={fmt(stats.online)}
              icon={<Radio className="size-3.5" />}
              tone="ok"
            />
            <Stat
              label={t("stat_verified")}
              value={fmt(stats.verified)}
              icon={<ShieldCheck className="size-3.5" />}
            />
            <Stat label={t("stat_commission")} value="0%" tone="saffron" icon={<Gauge className="size-3.5" />} />
          </div>
        </div>
        <div className="tl-keyline h-1.5 w-full" aria-hidden />
      </section>

      {/* ── Trades grid ──────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
        <SectionHeader
          index="[01]"
          title={t("trades_title")}
          sub={t("trades_sub")}
        />
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TRADES.map((trade, i) => {
            const Icon = trade.icon;
            const count = stats.byTrade?.[trade.id] ?? 0;
            return (
              <motion.div
                key={trade.id}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.35, delay: i * 0.05 }}
              >
                <Panel className="h-full transition-shadow hover:shadow-md">
                  <div className="flex items-start justify-between">
                    <span className="flex size-10 items-center justify-center rounded-sm border border-border bg-secondary">
                      <Icon className="size-5 text-forest" />
                    </span>
                    <MonoBadge tone={count > 0 ? "ok" : "neutral"}>
                      {fmt(count)} reg
                    </MonoBadge>
                  </div>
                  <p className="mt-4 text-sm font-bold">{trade.id}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    ₹{fmt(trade.baseRate)} {t("per_day")} · union base rate
                  </p>
                </Panel>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ── Onboarding protocol ─────────────────────────────── */}
      <section className="border-y border-border bg-card">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
          <SectionHeader index="[02]" title={t("how_title")} />
          <div className="mt-6 grid grid-cols-1 gap-px overflow-hidden rounded-sm border border-border bg-border md:grid-cols-4">
            {(
              [
                ["01", t("step_profile"), t("how1_desc"), "userplus"],
                ["02", t("step_identity"), t("how2_desc"), "shield"],
                ["03", t("step_skill"), t("how3_desc"), "mic"],
                ["04", t("step_credential"), t("how4_desc"), "badge"],
              ] as const
            ).map(([n, title, desc, icon], i) => (
              <motion.div
                key={n}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: i * 0.06 }}
                className="bg-card p-5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-saffron">
                    {n}
                  </span>
                  <StepIcon name={icon} />
                </div>
                <p className="mt-3 text-sm font-bold">{title}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Live verification feed ──────────────────────────── */}
      <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
        <SectionHeader
          index="[03]"
          title={t("ticker_title")}
          sub={t("ticker_empty")}
        />
        <Panel className="mt-6" bodyClassName="p-0">
          <div className="tl-grid-bg divide-y divide-border">
            {verifiedFeed.length === 0 && (
              <p className="px-5 py-10 text-center text-xs text-muted-foreground">
                {t("ticker_empty")}
              </p>
            )}
            {verifiedFeed.map((a, i) => {
              const Icon = getTrade(a.trade)?.icon;
              return (
                <motion.div
                  key={a._id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center justify-between gap-3 px-5 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <StatusDot tone="ok" blink={i === 0} />
                    <span className="truncate text-xs font-semibold">
                      {a.fullName}
                    </span>
                    <span className="hidden text-xs text-muted-foreground sm:inline">
                      {a.district}
                    </span>
                    {Icon && <Icon className="size-3.5 shrink-0 text-forest" />}
                  </div>
                  <code className="shrink-0 text-[10px] text-ok">
                    {a.credentialId}
                  </code>
                </motion.div>
              );
            })}
          </div>
        </Panel>
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className="mt-auto border-t border-border bg-card">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Cpu className="size-3.5" />
            <span>{t("footer_note")}</span>
          </div>
          <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest text-muted-foreground">
            <Languages className="size-3.5" />
            <span>en · hi · te · ta · bn</span>
            <span className="text-border">|</span>
            <BadgeCheck className="size-3.5" />
            <span>{t("lang_label")}: {lang}</span>
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

function StepIcon({ name }: { name: string }) {
  const cls = "size-4 text-muted-foreground";
  if (name === "userplus") return <UserPlus className={cls} />;
  if (name === "shield") return <ShieldCheck className={cls} />;
  if (name === "mic") return <Mic className={cls} />;
  if (name === "badge") return <BadgeCheck className={cls} />;
  return <span className={`font-mono text-xs ${cls}`}>{name}</span>;
}
