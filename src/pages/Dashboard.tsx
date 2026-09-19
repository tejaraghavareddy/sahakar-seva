import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Link, useNavigate } from "react-router";
import { useAuth } from "@/hooks/use-auth";
import { useLang } from "@/lib/i18n";
import { getTrade, getSociety } from "@/lib/trades";
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
import { Loader2, LogOut, Radio, Terminal } from "lucide-react";

export default function Dashboard() {
  const { t } = useLang();
  const { user, isLoading: authLoading, signOut } = useAuth();
  const artisan = useQuery(api.artisans.getMyArtisan, {});
  const setPresence = useMutation(api.artisans.setPresence);
  const navigate = useNavigate();

  const [geoError, setGeoError] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);

  /* Stop any speech when leaving the page. */
  useEffect(() => () => stopSpeaking(), []);

  /* Telemetry ping loop while online. */
  useEffect(() => {
    if (!artisan?.isOnline) return;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

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
    timer = setInterval(ping, 20000);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
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

  async function handleSignOut() {
    stopSpeaking();
    if (artisan?.isOnline) {
      try {
        await setPresence({ isOnline: false });
      } catch {
        // ignore
      }
    }
    await signOut();
    navigate("/");
  }

  if (authLoading || artisan === undefined) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  const online = artisan?.isOnline ?? false;
  const trade = artisan ? getTrade(artisan.trade) : undefined;
  const TradeIcon = trade?.icon;
  const society = artisan ? getSociety(artisan.societyId) : undefined;

  return (
    <div className="tl-shell">
      {/* Top band */}
      <header className="tl-band sticky top-0 z-40">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-sm border border-foreground bg-foreground text-xs font-bold text-background">
              &gt;_
            </span>
            <span className="text-sm font-bold">sahakar-seva</span>
          </Link>
          <div className="flex items-center gap-2">
            <LanguagePicker />
            <TlButton variant="ghost" onClick={handleSignOut}>
              <LogOut className="size-4" />
              {t("signout")}
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
                variant={online ? "outline" : "ok"}
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
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <span className="flex size-12 items-center justify-center rounded-full border border-border bg-secondary">
                <Terminal className="size-5 text-muted-foreground" />
              </span>
              <p className="max-w-sm text-sm text-muted-foreground">
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
            {/* ── Column 1: status + telemetry ── */}
            <div className="flex flex-col gap-5">
              <Panel title={t("telemetry")} tag={online ? "live" : "off"}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex size-11 items-center justify-center rounded-sm border ${
                        online
                          ? "border-ok/30 bg-ok-soft"
                          : "border-border bg-secondary"
                      }`}
                    >
                      {TradeIcon && (
                        <TradeIcon
                          className={`size-5 ${online ? "text-ok" : "text-muted-foreground"}`}
                        />
                      )}
                    </span>
                    <div>
                      <p className="text-xs font-bold">
                        {online ? t("telemetry_on") : t("telemetry_off")}
                      </p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {online ? "20s ping interval" : "—"}
                      </p>
                    </div>
                  </div>
                  <StatusDot tone={online ? "ok" : "idle"} blink={online} />
                </div>
                <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-sm border border-border bg-border text-center">
                  <TeleCell label={t("tele_lat")} value={artisan.lat?.toFixed(4) ?? "—"} />
                  <TeleCell label={t("tele_lng")} value={artisan.lng?.toFixed(4) ?? "—"} />
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
                  <p className="mt-3 text-[10px] text-warn">{geoError}</p>
                )}
              </Panel>

              <Panel title={t("welfare")} tag="0% commission">
                <div className="grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-border bg-border">
                  <MoneyCell
                    label={t("welfare")}
                    value={`₹${artisan.welfareBalance.toLocaleString("en-IN")}`}
                  />
                  <MoneyCell
                    label={t("dividend")}
                    value={`₹${artisan.dividendBalance.toLocaleString("en-IN")}`}
                  />
                </div>
                <p className="mt-3 text-[10px] leading-4 text-muted-foreground">
                  {t("ledger_note")}
                </p>
              </Panel>
            </div>

            {/* ── Column 2-3: profile + credential ── */}
            <div className="flex flex-col gap-5 lg:col-span-2">
              <Panel
                title="artisan profile"
                tag={t("member_since") + " " + new Date(artisan.createdAt).toLocaleDateString()}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <InfoRow label={t("f_fullname")} value={artisan.fullName} />
                  <InfoRow label={t("f_phone")} value={artisan.phone} />
                  <InfoRow label={t("f_trade")} value={artisan.trade} />
                  <InfoRow
                    label={t("f_district")}
                    value={`${artisan.district}, ${artisan.state}`}
                  />
                  <InfoRow
                    label={t("society_row")}
                    value={society?.name ?? artisan.societyId}
                  />
                  <InfoRow
                    label={t("experience")}
                    value={`${artisan.experienceYears} ${t("yrs")}`}
                  />
                  <InfoRow
                    label={t("rate")}
                    value={`₹${artisan.dailyRate.toLocaleString("en-IN")} / day`}
                  />
                  <InfoRow
                    label={t("kyc_ref")}
                    value={artisan.kycRef ?? "—"}
                  />
                </div>
              </Panel>

              <Panel title={t("card_id")}>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="flex size-11 items-center justify-center rounded-sm border border-ok/30 bg-ok-soft">
                      <StatusDot tone="ok" blink />
                    </span>
                    <div>
                      <p className="text-xs font-bold">
                        {artisan.credentialId ?? t("quiz_none")}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {t("cred_score")}: {artisan.quizScore ?? 0}%
                      </p>
                    </div>
                  </div>
                  <IdCardDialog artisan={artisan} />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-border bg-border sm:grid-cols-4">
                  <TeleCell label={t("kyc_row")} value={t("kyc_badge")} />
                  <TeleCell
                    label={t("quiz_row")}
                    value={
                      artisan.quizPassed
                        ? `${artisan.quizScore ?? 0}%`
                        : t("quiz_none")
                    }
                  />
                  <TeleCell label="commission" value="0%" />
                  <TeleCell label="welfare" tone="ok" value="active" />
                </div>
              </Panel>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function TeleCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ok";
}) {
  return (
    <div className="bg-card px-3 py-2.5">
      <p className="text-[9px] uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-0.5 truncate text-xs font-bold ${
          tone === "ok" ? "text-ok" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function MoneyCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card px-4 py-3">
      <p className="tl-label">{label}</p>
      <p className="mt-1 text-lg font-bold tracking-tight text-forest">
        {value}
      </p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-dashed border-border pb-2 text-xs last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-semibold">{value}</span>
    </div>
  );
}
