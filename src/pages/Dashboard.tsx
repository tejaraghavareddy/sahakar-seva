import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Link } from "react-router";
import { useAuth } from "@/hooks/use-auth";
import { useLang } from "@/lib/i18n";
import { getTrade } from "@/lib/trades";
import { stopSpeaking } from "@/lib/speech";
import {
  LanguagePicker,
  MonoBadge,
  Panel,
  SectionHeader,
  StatusDot,
  TlButton,
} from "@/components/terminal";
import { IdCardDialog } from "@/components/IdCardDialog";
import {
  Loader2,
  LogOut,
  Radio,
  Radar,
  Briefcase,
  HandHeart,
} from "lucide-react";

const STATUS_TONE: Record<string, "neutral" | "ok" | "warn" | "saffron"> = {
  pending: "warn",
  accepted: "saffron",
  enroute: "saffron",
  inprogress: "saffron",
  payment: "warn",
  completed: "ok",
  settled: "ok",
  cancelled: "neutral",
};

export default function Dashboard() {
  const { t } = useLang();
  const { isLoading: authLoading, signOut } = useAuth();
  const artisan = useQuery(api.artisans.getMyArtisan, {});
  const jobs = useQuery(api.bookings.listForWorker, {});
  const setPresence = useMutation(api.artisans.setPresence);
  const acceptJob = useMutation(api.bookings.accept);
  const advance = useMutation(api.bookings.advance);

  const [geoError, setGeoError] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [busyAdvance, setBusyAdvance] = useState<string | null>(null);

  useEffect(() => () => stopSpeaking(), []);

  /* GPS telemetry ping while online */
  useEffect(() => {
    if (!artisan?.isOnline) return;
    let cancelled = false;
    const ping = () => {
      if (!("geolocation" in navigator)) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled) return;
          void setPresence({
            isOnline: true,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
          setGeoError(null);
        },
        () => {
          if (!cancelled) setGeoError(t("telemetry_err"));
        },
        { enableHighAccuracy: true, maximumAge: 15000 },
      );
    };
    ping();
    const timer = setInterval(ping, 20000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artisan?.isOnline]);

  async function toggleOnline(next: boolean) {
    setToggling(true);
    setGeoError(null);
    try {
      if (next && "geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            await setPresence({
              isOnline: true,
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            });
            setToggling(false);
          },
          async () => {
            await setPresence({ isOnline: true });
            setGeoError(t("telemetry_err"));
            setToggling(false);
          },
          { enableHighAccuracy: true, timeout: 8000 },
        );
      } else {
        await setPresence({ isOnline: next });
        setToggling(false);
      }
    } catch {
      setToggling(false);
    }
  }

  async function handleAccept(id: Id<"bookings">) {
    setAccepting(id);
    try {
      await acceptJob({ id });
    } finally {
      setAccepting(null);
    }
  }

  async function handleAdvance(id: Id<"bookings">) {
    setBusyAdvance(id);
    try {
      await advance({ id });
    } finally {
      setBusyAdvance(null);
    }
  }

  async function handleSignOut() {
    stopSpeaking();
    if (artisan?.isOnline) {
      try {
        await setPresence({ isOnline: false });
      } catch {
        /* ignore */
      }
    }
    await signOut();
    window.location.href = "/";
  }

  if (authLoading || artisan === undefined) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-slate-400" />
      </main>
    );
  }

  const online = artisan?.isOnline ?? false;
  const trade = artisan ? getTrade(artisan.trade) : undefined;
  const TradeIcon = trade?.icon;
  const mine = jobs?.mine ?? [];
  const radar = jobs?.radar ?? [];
  const earned = mine
    .filter((b) => b.status === "settled" || b.status === "completed")
    .reduce((sum, b) => sum + b.base, 0);

  const stageKeys: Record<string, string> = {
    accepted: "st_enroute",
    enroute: "st_inprogress",
    inprogress: "st_payment",
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-800 text-white">
              <HandHeart className="size-4" />
            </span>
            <span className="text-sm font-bold text-slate-900">
              Sahakar Seva
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <LanguagePicker />
            <TlButton variant="ghost" onClick={handleSignOut}>
              <LogOut className="size-4" />
            </TlButton>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        {/* Greeting + presence */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHeader
            title={t("hub_title")}
            sub={
              artisan
                ? t("hub_welcome", { name: artisan.fullName })
                : t("hub_not_onboarded")
            }
          />
          {artisan && (
            <div className="flex items-center gap-2">
              <MonoBadge tone={online ? "ok" : "neutral"}>
                <StatusDot tone={online ? "ok" : "idle"} blink={online} />
                {online ? t("status_online") : t("status_offline")}
              </MonoBadge>
              <TlButton
                variant={online ? "outline" : "primary"}
                disabled={toggling}
                onClick={() => toggleOnline(!online)}
              >
                {toggling ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Radio className="size-4" />
                )}
                {online ? t("toggle_go_offline") : t("toggle_go_online")}
              </TlButton>
            </div>
          )}
        </div>

        {!artisan && (
          <Panel className="mt-8">
            <div className="flex flex-col items-center gap-4 py-10 text-center">
              <span className="flex size-12 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50">
                <HandHeart className="size-5 text-emerald-700" />
              </span>
              <p className="max-w-sm text-sm text-slate-600">
                {t("hub_not_onboarded")}
              </p>
              <Link to="/onboarding">
                <TlButton>{t("hub_cta_onboard")}</TlButton>
              </Link>
            </div>
          </Panel>
        )}

        {artisan && (
          <div className="mt-6 grid gap-5 lg:grid-cols-3">
            {/* Left column */}
            <div className="flex flex-col gap-5">
              {/* Telemetry */}
              <Panel title={t("telemetry")} tag={online ? "live" : "off"}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex size-11 items-center justify-center rounded-xl border ${
                        online
                          ? "border-emerald-200 bg-emerald-50"
                          : "border-slate-200 bg-slate-50"
                      }`}
                    >
                      {TradeIcon && (
                        <TradeIcon
                          className={`size-5 ${
                            online ? "text-emerald-700" : "text-slate-400"
                          }`}
                        />
                      )}
                    </span>
                    <div>
                      <p className="text-xs font-bold text-slate-900">
                        {online ? t("telemetry_on") : t("telemetry_off")}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {online ? "20s ping" : "—"}
                      </p>
                    </div>
                  </div>
                  <StatusDot tone={online ? "ok" : "idle"} blink={online} />
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <TeleCell
                    label={t("tele_lat")}
                    value={artisan.lat?.toFixed(4) ?? "—"}
                  />
                  <TeleCell
                    label={t("tele_lng")}
                    value={artisan.lng?.toFixed(4) ?? "—"}
                  />
                  <TeleCell
                    label={t("tele_ping")}
                    value={
                      artisan.telemetryAt
                        ? new Date(artisan.telemetryAt).toLocaleTimeString()
                        : "—"
                    }
                  />
                </div>
                {geoError && (
                  <p className="mt-3 text-[11px] font-semibold text-amber-700">
                    {geoError}
                  </p>
                )}
              </Panel>

              {/* Earnings */}
              <Panel title={t("earnings_title")} bodyClassName="p-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                    <p className="tl-label">{t("earn_collected")}</p>
                    <p className="mt-1 text-lg font-black text-emerald-800">
                      ₹{earned.toLocaleString("en-IN")}
                    </p>
                  </div>
                  <div className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-3">
                    <p className="tl-label">{t("welfare")}</p>
                    <p className="mt-1 text-lg font-black text-orange-800">
                      ₹{artisan.welfareBalance.toLocaleString("en-IN")}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-[11px] leading-4 text-slate-500">
                  {t("ledger_note")}
                </p>
              </Panel>

              {/* Credential */}
              <Panel title={t("card_id")}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-slate-900">
                      {artisan.credentialId ?? t("quiz_none")}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {t("cred_score")}: {artisan.quizScore ?? 0}%
                    </p>
                  </div>
                  {artisan.credentialId && <IdCardDialog artisan={artisan} />}
                </div>
              </Panel>
            </div>

            {/* Right: radar + jobs */}
            <div className="flex flex-col gap-5 lg:col-span-2">
              {/* Radar */}
              <Panel
                title={t("radar_title")}
                tag={`${radar.length}`}
                bodyClassName="p-0"
              >
                <div className="divide-y divide-slate-100">
                  {radar.length === 0 && (
                    <p className="px-5 py-10 text-center text-xs text-slate-500">
                      {t("radar_empty")}
                    </p>
                  )}
                  {radar.map((b) => (
                    <div
                      key={b._id}
                      className="flex items-center gap-3 px-4 py-3"
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50">
                        <Radar className="size-4 text-emerald-700" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-slate-900">
                          {b.serviceName}
                        </p>
                        <p className="truncate text-[11px] text-slate-500">
                          {b.address.slice(0, 44)} · ₹{b.total}
                        </p>
                      </div>
                      <TlButton
                        className="h-8 px-3 text-xs"
                        onClick={() => handleAccept(b._id)}
                        disabled={accepting === b._id}
                      >
                        {accepting === b._id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          t("radar_accept")
                        )}
                      </TlButton>
                    </div>
                  ))}
                </div>
              </Panel>

              {/* Active + history jobs */}
              <Panel title={t("myjobs_title")} bodyClassName="p-0">
                <div className="divide-y divide-slate-100">
                  {mine.length === 0 && (
                    <p className="px-5 py-10 text-center text-xs text-slate-500">
                      {t("myjobs_empty")}
                    </p>
                  )}
                  {mine.map((b) => (
                    <div
                      key={b._id}
                      className="flex items-center gap-3 px-4 py-3"
                    >
                      <Briefcase className="size-4 shrink-0 text-slate-400" />
                      <div className="min-w-0 flex-1">
                        <Link
                          to={`/bookings/${b._id}`}
                          className="block truncate text-xs font-bold text-slate-900 hover:text-emerald-700"
                        >
                          {b.serviceName}
                        </Link>
                        <p className="truncate text-[11px] text-slate-500">
                          {new Date(b.scheduledFor).toLocaleDateString("en-IN")}{" "}
                          · ₹{b.total}
                        </p>
                      </div>
                      <MonoBadge tone={STATUS_TONE[b.status] ?? "neutral"}>
                        {t(`st_${b.status}`)}
                      </MonoBadge>
                      {stageKeys[b.status] && (
                        <TlButton
                          variant="outline"
                          className="h-8 px-2.5 text-[11px]"
                          onClick={() => handleAdvance(b._id)}
                          disabled={busyAdvance === b._id}
                        >
                          {busyAdvance === b._id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            t(stageKeys[b.status])
                          )}
                        </TlButton>
                      )}
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function TeleCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-teal-200 bg-teal-50 px-2 py-2.5 text-center">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-teal-700">
        {label}
      </p>
      <p className="mt-0.5 truncate text-xs font-bold text-teal-900">
        {value}
      </p>
    </div>
  );
}
