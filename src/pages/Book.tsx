import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useLang } from "@/lib/i18n";
import { getService, COLOR_SOFT } from "@/lib/trades";
import { AppHeader } from "@/components/AppHeader";
import { MonoBadge, Panel, TlButton } from "@/components/terminal";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  MapPin,
  HeartHandshake,
  Zap,
} from "lucide-react";

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
      <div className="min-h-screen">
        <AppHeader />
        <main className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
          <p className="text-sm text-slate-500">Service not found.</p>
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
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <Link
          to={`/services/${svc.id}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-emerald-700"
        >
          <ArrowLeft className="size-3.5" />
          {svc.name}
        </Link>

        <h1 className="mt-4 text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">
          {t("bk_title")}
        </h1>

        <div className="mt-5 grid gap-5">
          {/* Service summary */}
          <Panel>
            <div className="flex items-center gap-4">
              <span
                className={`flex size-11 shrink-0 items-center justify-center rounded-xl border ${soft}`}
              >
                <Icon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-900">
                  {svc.name}
                </p>
                <p className="text-xs text-slate-500">
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
              <MapPin className="absolute left-3 top-3 size-4 text-slate-400" />
              <textarea
                className="min-h-[70px] w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-900 transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
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
                  className={`flex min-w-[64px] flex-col items-center rounded-xl border px-3 py-2.5 text-center transition ${
                    dateIdx === i
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span className="text-[9px] font-semibold uppercase tracking-wider opacity-70">
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
                  className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                    slot === s && !asap
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
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
                className={`mt-4 flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-xs font-bold transition ${
                  asap
                    ? "border-rose-600 bg-rose-600 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Zap className="size-4" />
                  {t("bk_asap")}
                </span>
                <span
                  className={`relative h-5 w-9 rounded-full border transition-colors ${
                    asap ? "border-white/50 bg-white/30" : "border-slate-200 bg-slate-100"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-all ${
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
              className="min-h-[60px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              placeholder={t("bk_notes_ph")}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Panel>

          {/* Welfare */}
          <button
            type="button"
            onClick={() => setWelfare((v) => !v)}
            className="text-left"
          >
            <Panel
              className={
                welfare ? "border-orange-300 bg-orange-50" : "hover:border-emerald-300"
              }
              bodyClassName="p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="flex items-center gap-1.5 text-xs font-bold text-orange-800">
                    <HeartHandshake className="size-4" />
                    {t("bk_welfare", { amt: Math.round(svc.base * 0.03) })}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-4 text-slate-600">
                    {t("bk_welfare_desc")}
                  </p>
                </div>
                <span
                  className={`relative h-5 w-9 shrink-0 rounded-full border transition-colors ${
                    welfare
                      ? "border-orange-600 bg-orange-600"
                      : "border-slate-200 bg-slate-100"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-all ${
                      welfare ? "left-[18px]" : "left-0.5"
                    }`}
                  />
                </span>
              </div>
            </Panel>
          </button>

          {/* Price summary */}
          <Panel title={t("bk_summary")}>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">{t("bk_visit")}</span>
                <span className="font-semibold text-slate-900">₹{svc.base}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t("bk_welfare_row")}</span>
                <span className="font-semibold text-slate-900">
                  {welfareAmt > 0 ? `₹${welfareAmt}` : "—"}
                </span>
              </div>
              <div className="flex justify-between border-t border-dashed border-slate-200 pt-2">
                <span className="font-bold text-slate-900">{t("bk_total")}</span>
                <span className="font-bold text-slate-900">₹{total}</span>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-slate-400">{t("bd_upi_note")}</p>

            {error && (
              <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                {error}
              </p>
            )}

            <TlButton className="mt-4 w-full" onClick={submit} disabled={busy}>
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
