import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useLang } from "@/lib/i18n";
import { getService, COLOR_SOFT } from "@/lib/trades";
import { AppHeader } from "@/components/AppHeader";
import { MonoBadge, Panel, SectionHeader, TlButton } from "@/components/terminal";
import { ArrowLeft, ArrowRight, CalendarDays, Loader2, MapPin, Zap } from "lucide-react";

const SLOTS = [
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
];

export default function Book() {
  const { id } = useParams();
  const { t } = useLang();
  const navigate = useNavigate();
  const svc = getService(id ?? "");
  const createBooking = useMutation(api.bookings.create);

  const today = useMemo(() => new Date(), []);
  const dates = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(today);
        d.setDate(d.getDate() + i);
        return d;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [address, setAddress] = useState("");
  const [dateIdx, setDateIdx] = useState(0);
  const [slot, setSlot] = useState("10:00");
  const [asap, setAsap] = useState(false);
  const [notes, setNotes] = useState("");
  const [welfare, setWelfare] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!svc) {
    return (
      <div className="tl-shell">
        <AppHeader />
        <main className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
          <p className="text-sm text-muted-foreground">Service not found.</p>
          <Link to="/services" className="mt-4 inline-block">
            <TlButton variant="outline">{t("bks_browse")}</TlButton>
          </Link>
        </main>
      </div>
    );
  }

  const welfareAmt = welfare ? Math.round(svc.base * 0.03) : 0;
  const total = svc.base + welfareAmt;
  const soft = COLOR_SOFT[svc.color] ?? COLOR_SOFT.ok;
  const Icon = svc.icon;

  async function submit() {
    setError(null);
    if (!svc) return;
    if (!address.trim()) {
      setError(t("bk_need_addr"));
      return;
    }
    setBusy(true);
    try {
      const scheduled = new Date(dates[dateIdx]);
      const [hh, mm] = slot.split(":");
      scheduled.setHours(Number(hh), Number(mm), 0, 0);
      const bookingId = await createBooking({
        serviceId: svc.id,
        address: address,
        scheduledFor: scheduled.getTime(),
        urgent: asap && svc.urgent,
        notes: notes || undefined,
        welfareOptIn: welfare,
      });
      navigate(`/bookings/${bookingId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to book");
      setBusy(false);
    }
  }

  return (
    <div className="tl-shell">
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <Link
          to={`/services/${svc.id}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          {svc.name}
        </Link>

        <h1 className="mt-4 text-2xl font-bold tracking-tight">
          {t("bk_title")}
        </h1>

        <div className="mt-5 grid gap-5">
          {/* Service summary */}
          <Panel>
            <div className="flex items-center gap-4">
              <span
                className={`flex size-11 shrink-0 items-center justify-center rounded-sm ${soft}`}
              >
                <Icon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{svc.name}</p>
                <p className="text-xs text-muted-foreground">
                  ₹{svc.base} {t("sv_base")}
                  {svc.hourly > 0 ? ` + ₹${svc.hourly} ${t("sv_hourly")}` : ""}
                </p>
              </div>
              {svc.urgent && (
                <MonoBadge tone="warn">
                  <Zap className="size-3" /> {t("sv_urgent")}
                </MonoBadge>
              )}
            </div>
          </Panel>

          {/* Address */}
          <Panel title={t("bk_address")}>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 size-4 text-muted-foreground" />
              <textarea
                className="min-h-[70px] w-full rounded-sm border border-input bg-card py-2.5 pl-9 pr-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-ok/40"
                placeholder={t("bk_address_ph")}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
          </Panel>

          {/* Schedule */}
          <Panel title={t("bk_date")}>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {dates.map((d, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setDateIdx(i)}
                  className={`flex min-w-[64px] flex-col items-center rounded-sm border px-3 py-2.5 text-center transition-colors ${
                    dateIdx === i
                      ? "border-foreground bg-foreground text-background"
                      : "border-input bg-card hover:bg-secondary"
                  }`}
                >
                  <span className="text-[9px] uppercase tracking-wider opacity-70">
                    {d.toLocaleDateString("en-IN", { weekday: "short" })}
                  </span>
                  <span className="text-lg font-bold">{d.getDate()}</span>
                  <span className="text-[9px] opacity-70">
                    {d.toLocaleDateString("en-IN", { month: "short" })}
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap gap-1.5">
              {SLOTS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setSlot(s);
                    setAsap(false);
                  }}
                  className={`rounded-sm border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    slot === s && !asap
                      ? "border-foreground bg-foreground text-background"
                      : "border-input bg-card hover:bg-secondary"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            {svc.urgent && (
              <button
                type="button"
                onClick={() => setAsap((v) => !v)}
                className={`mt-4 flex w-full items-center justify-between rounded-sm border px-4 py-3 text-left text-xs font-semibold transition-colors ${
                  asap
                    ? "border-warn bg-warn-soft text-warn"
                    : "border-input bg-card hover:bg-secondary"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Zap className="size-4" />
                  {t("bk_asap")}
                </span>
                <span
                  className={`h-5 w-9 rounded-full border transition-colors ${
                    asap ? "border-warn bg-warn" : "border-input bg-secondary"
                  } relative`}
                >
                  <span
                    className={`absolute top-0.5 size-4 rounded-full bg-white transition-all ${
                      asap ? "left-[18px]" : "left-0.5"
                    }`}
                  />
                </span>
              </button>
            )}
          </Panel>

          {/* Notes */}
          <Panel title={t("bk_notes")}>
            <textarea
              className="min-h-[60px] w-full rounded-sm border border-input bg-card px-3 py-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-ok/40"
              placeholder={t("bk_notes_ph")}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Panel>

          {/* Welfare */}
          <button type="button" onClick={() => setWelfare((v) => !v)} className="text-left">
            <Panel
              className={welfare ? "border-ok/50 bg-ok-soft/40" : ""}
              bodyClassName="p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-forest">
                    {t("bk_welfare", { amt: Math.round(svc.base * 0.03) })}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {t("bk_welfare_desc")}
                  </p>
                </div>
                <span
                  className={`relative h-5 w-9 shrink-0 rounded-full border transition-colors ${
                    welfare ? "border-ok bg-ok" : "border-input bg-secondary"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 size-4 rounded-full bg-white transition-all ${
                      welfare ? "left-[18px]" : "left-0.5"
                    }`}
                  />
                </span>
              </div>
            </Panel>
          </button>

          {/* Price summary */}
          <Panel title={t("bk_summary")}>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("bk_visit")}</span>
                <span className="font-semibold">₹{svc.base}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t("bk_welfare_row")}
                </span>
                <span className="font-semibold">
                  {welfareAmt > 0 ? `₹${welfareAmt}` : "—"}
                </span>
              </div>
              <div className="flex justify-between border-t border-dashed border-border pt-2 text-sm">
                <span className="font-bold">{t("bk_total")}</span>
                <span className="font-bold">₹{total}</span>
              </div>
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">
              {t("bd_upi_note")}
            </p>

            {error && (
              <p className="mt-3 rounded-sm border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {error}
              </p>
            )}

            <TlButton
              variant="saffron"
              className="tl-btn-saffron mt-4 w-full"
              onClick={submit}
              disabled={busy}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  {t("bk_confirm")}
                  <ArrowRight className="size-4" />
                </>
              )}
            </TlButton>
          </Panel>
        </div>
      </main>
    </div>
  );
}
