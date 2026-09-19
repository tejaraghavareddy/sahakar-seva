import { Link, useNavigate } from "react-router";
import { useAuth } from "@/hooks/use-auth";
import { useLang } from "@/lib/i18n";
import { LanguagePicker } from "@/components/terminal";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Building2,
  Check,
  Handshake,
  Search,
  Wrench,
} from "lucide-react";

export default function Landing() {
  const { t } = useLang();
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  const cards = [
    {
      key: "booker",
      to: "/services",
      icon: Search,
      badge: t("gw_booker_badge"),
      title: t("gw_booker_title"),
      desc: t("gw_booker_desc"),
      highlights: [t("gw_booker_h1"), t("gw_booker_h2"), t("gw_booker_h3")],
      cta: t("gw_booker_cta"),
    },
    {
      key: "worker",
      to: "/onboarding",
      icon: Wrench,
      badge: t("gw_worker_badge"),
      title: t("gw_worker_title"),
      desc: t("gw_worker_desc"),
      highlights: [t("gw_worker_h1"), t("gw_worker_h2"), t("gw_worker_h3")],
      cta: t("gw_worker_cta"),
    },
    {
      key: "admin",
      to: "/admin",
      icon: Building2,
      badge: t("gw_admin_badge"),
      title: t("gw_admin_title"),
      desc: t("gw_admin_desc"),
      highlights: [t("gw_admin_h1"), t("gw_admin_h2"), t("gw_admin_h3")],
      cta: t("gw_admin_cta"),
    },
  ];

  const metrics = [
    { title: t("gw_m1_t"), sub: t("gw_m1_s") },
    { title: t("gw_m2_t"), sub: t("gw_m2_s") },
    { title: t("gw_m3_t"), sub: t("gw_m3_s") },
    { title: t("gw_m4_t"), sub: t("gw_m4_s") },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-emerald-50/20 to-slate-100 font-sans antialiased text-slate-900">
      {/* ── Top brand & accessibility header ─────────────────── */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 px-4 py-3.5 backdrop-blur-md sm:px-8">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 p-2 text-white">
              <Handshake className="size-5" />
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-black tracking-tight sm:text-base">
                Sahakar Seva
              </p>
              <p className="truncate text-[10px] font-semibold text-slate-500 sm:text-xs">
                सहकार सेवा • Cooperative Federation
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <span className="hidden items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 md:inline-flex">
              <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
              {t("gw_op_badge")}
            </span>
            <LanguagePicker />
            {!isLoading && isAuthenticated && (
              <button
                type="button"
                onClick={() => navigate("/dashboard")}
                className="rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 active:scale-95"
              >
                {t("cta_dashboard")}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-4 pt-10 pb-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-100 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-emerald-900">
            {t("gw_eyebrow")}
          </span>
          <h1 className="mb-4 text-3xl font-black leading-tight tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
            {t("gw_title_a")}{" "}
            <span className="text-emerald-700">{t("gw_title_b")}</span>
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
            {t("gw_sub")}
          </p>
        </motion.div>
      </section>

      {/* ── Role gateway cards ───────────────────────────────── */}
      <section className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 pb-12 md:grid-cols-3">
        {/* Booker */}
        <GatewayCard to={cards[0].to} delay={0}>
          <span className="mb-4 w-fit rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
            {cards[0].badge}
          </span>
          <span className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-700 transition group-hover:scale-110">
            <Search className="size-7" />
          </span>
          <h2 className="mb-2 text-2xl font-black text-slate-900 transition group-hover:text-emerald-700">
            {cards[0].title}
          </h2>
          <p className="mb-4 text-sm leading-relaxed text-slate-600">
            {cards[0].desc}
          </p>
          <Highlights items={cards[0].highlights} tone="emerald" />
          <CardCta label={cards[0].cta} tone="emerald" />
        </GatewayCard>

        {/* Worker — featured */}
        <GatewayCard
          to={cards[1].to}
          delay={0.08}
          className="border-emerald-700/50 bg-gradient-to-b from-emerald-900 to-slate-900 text-white shadow-2xl md:-translate-y-2 hover:border-emerald-500 hover:shadow-2xl"
          highlightClass="text-emerald-100"
        >
          <span className="mb-4 w-fit rounded-full bg-emerald-500 px-3 py-1 text-xs font-black uppercase tracking-wider text-slate-950">
            {cards[1].badge}
          </span>
          <span className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-emerald-400 transition group-hover:scale-110">
            <Wrench className="size-7" />
          </span>
          <h2 className="mb-2 text-2xl font-black text-white">
            {cards[1].title}
          </h2>
          <p className="mb-4 text-sm leading-relaxed text-emerald-100/90">
            {cards[1].desc}
          </p>
          <Highlights items={cards[1].highlights} tone="ondark" />
          <CardCta label={cards[1].cta} tone="lime" />
        </GatewayCard>

        {/* Admin */}
        <GatewayCard to={cards[2].to} delay={0.16} hoverBorder="teal">
          <span className="mb-4 w-fit rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
            {cards[2].badge}
          </span>
          <span className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-500/10 text-teal-700 transition group-hover:scale-110">
            <Building2 className="size-7" />
          </span>
          <h2 className="mb-2 text-2xl font-black text-slate-900 transition group-hover:text-teal-700">
            {cards[2].title}
          </h2>
          <p className="mb-4 text-sm leading-relaxed text-slate-600">
            {cards[2].desc}
          </p>
          <Highlights items={cards[2].highlights} tone="teal" />
          <CardCta label={cards[2].cta} tone="slate" />
        </GatewayCard>
      </section>

      {/* ── Trust metrics footer bar ─────────────────────────── */}
      <section className="mx-auto mb-12 max-w-5xl px-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.35 }}
          className="grid grid-cols-2 gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-6 text-center shadow-xs sm:grid-cols-4"
        >
          {metrics.map((m) => (
            <div key={m.title}>
              <p className="text-sm font-black tracking-tight text-slate-900 sm:text-base">
                {m.title}
              </p>
              <p className="mt-1 text-xs text-slate-500">{m.sub}</p>
            </div>
          ))}
        </motion.div>
      </section>
    </div>
  );
}

/* ---------- Gateway card shell ---------- */

function GatewayCard({
  to,
  children,
  className,
  delay = 0,
  highlightClass,
  hoverBorder = "emerald",
}: {
  to: string;
  children: React.ReactNode;
  className?: string;
  delay?: number;
  highlightClass?: string;
  hoverBorder?: "emerald" | "teal";
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="h-full"
      data-highlight={highlightClass}
    >
      <Link
        to={to}
        className={`group relative flex h-full cursor-pointer flex-col justify-between overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:outline-none sm:p-8 ${
          hoverBorder === "teal" ? "hover:border-teal-400" : "hover:border-emerald-400"
        } ${className ?? ""}`}
      >
        {children}
      </Link>
    </motion.div>
  );
}

/* ---------- Key highlights list ---------- */

function Highlights({
  items,
  tone,
}: {
  items: string[];
  tone: "emerald" | "teal" | "ondark";
}) {
  const check =
    tone === "ondark"
      ? "text-emerald-400"
      : tone === "teal"
        ? "text-teal-600"
        : "text-emerald-600";
  return (
    <ul className="mb-2 space-y-2 text-xs sm:text-sm">
      {items.map((h) => (
        <li
          key={h}
          className={`flex items-start gap-2 ${
            tone === "ondark" ? "text-emerald-100" : "text-slate-600"
          }`}
        >
          <Check className={`mt-0.5 size-4 shrink-0 ${check}`} />
          <span className="leading-relaxed">{h}</span>
        </li>
      ))}
    </ul>
  );
}

/* ---------- Card action button ---------- */

function CardCta({
  label,
  tone,
}: {
  label: string;
  tone: "emerald" | "lime" | "slate";
}) {
  const styles =
    tone === "lime"
      ? "bg-emerald-400 text-slate-950 font-black shadow-lg hover:bg-emerald-300"
      : tone === "slate"
        ? "bg-slate-900 text-white shadow-md hover:bg-slate-800"
        : "bg-emerald-600 text-white shadow-md hover:bg-emerald-700";
  return (
    <span
      className={`mt-6 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-bold transition group-active:scale-[0.98] ${styles}`}
    >
      {label}
      <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
    </span>
  );
}
