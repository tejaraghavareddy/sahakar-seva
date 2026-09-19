import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useLang } from "@/lib/i18n";
import { getService, COLOR_SOFT } from "@/lib/trades";
import { AppHeader } from "@/components/AppHeader";
import { MonoBadge, Panel, StatusDot, TlButton } from "@/components/terminal";
import { ArrowLeft, BadgeCheck, Loader2, Send, ShieldCheck, XCircle } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

const FLOW = ["pending", "accepted", "enroute", "inprogress", "payment", "completed", "settled"];

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

export default function BookingDetail() {
  const { id } = useParams();
  const { t } = useLang();
  const { user } = useAuth();
  const booking = useQuery(api.bookings.getBooking, { id: id as any });
  const messages = useQuery(api.bookings.listMessages, { bookingId: id as any });
  const sendMessage = useMutation(api.bookings.sendMessage);
  const advance = useMutation(api.bookings.advance);
  const confirmUtr = useMutation(api.bookings.confirmUtr);
  const cancelBooking = useMutation(api.bookings.cancel);

  const [utr, setUtr] = useState("");
  const [chat, setChat] = useState("");
  const [busy, setBusy] = useState(false);
  const [paid, setPaid] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  if (booking === undefined) {
    return (
      <div className="tl-shell">
        <AppHeader />
        <main className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </main>
      </div>
    );
  }

  if (booking === null) {
    return (
      <div className="tl-shell">
        <AppHeader />
        <main className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
          <p className="text-sm text-muted-foreground">Booking not found.</p>
          <Link to="/bookings" className="mt-4 inline-block">
            <TlButton variant="outline">{t("bks_title")}</TlButton>
          </Link>
        </main>
      </div>
    );
  }

  const svc = getService(booking.serviceId);
  const Icon = svc?.icon;
  const soft = COLOR_SOFT[svc?.color ?? "ok"];
  const isWorker = !!user && booking.workerUserId === user._id;
  const isCustomer = !!user && booking.customerId === user._id;
  const statusIdx = FLOW.indexOf(booking.status);
  const stageKeys: Record<string, string> = {
    accepted: "st_enroute",
    enroute: "st_inprogress",
    inprogress: "st_payment",
    payment: "st_completed",
    completed: "st_settled",
  };

  const payeeVpa = booking.workerVpa ?? "sahakar@upi";
  const upiString = `upi://pay?pa=${encodeURIComponent(payeeVpa)}&pn=${encodeURIComponent(
    "Sahakar Seva Artisan",
  )}&am=${booking.total}&tn=${encodeURIComponent(`Booking_${booking._id.slice(-8)}`)}&cu=INR`;

  async function handleSend() {
    const body = chat.trim();
    if (!body) return;
    setChat("");
    await sendMessage({ bookingId: booking!._id, body });
  }

  async function handleAdvance() {
    setBusy(true);
    try {
      await advance({ id: booking!._id });
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmPaid() {
    setBusy(true);
    try {
      await confirmUtr({ id: booking!._id, utr });
      setPaid(true);
    } catch {
      // surfaced via Convex error toast
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    setBusy(true);
    try {
      await cancelBooking({
        id: booking!._id,
        by: isCustomer ? "customer" : "worker",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="tl-shell">
      <AppHeader />
      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        <Link
          to="/bookings"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          {t("bks_title")}
        </Link>

        {/* Header */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className={`flex size-11 items-center justify-center rounded-sm ${soft}`}>
              {Icon && <Icon className="size-5" />}
            </span>
            <div>
              <h1 className="text-lg font-bold tracking-tight">
                {booking.serviceName}
              </h1>
              <p className="text-xs text-muted-foreground">
                {t("bd_ref")} {booking._id.slice(-8).toUpperCase()} ·{" "}
                {t("bd_schedule")}{" "}
                {new Date(booking.scheduledFor).toLocaleString("en-IN", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            </div>
          </div>
          <MonoBadge tone={STATUS_TONE[booking.status] ?? "neutral"}>
            {t(`st_${booking.status}`)}
          </MonoBadge>
        </div>

        {/* Stepper */}
        {booking.status !== "cancelled" && (
          <Panel className="mt-5" bodyClassName="p-4">
            <div className="flex items-center">
              {FLOW.map((s, i) => (
                <div key={s} className="flex flex-1 items-center last:flex-none">
                  <div className="flex flex-col items-center">
                    <span
                      className={`flex size-6 items-center justify-center rounded-full border text-[10px] font-bold ${
                        i < statusIdx
                          ? "border-ok bg-ok text-white"
                          : i === statusIdx
                            ? "border-foreground bg-foreground text-background"
                            : "border-border bg-card text-muted-foreground"
                      }`}
                    >
                      {i < statusIdx ? "✓" : i + 1}
                    </span>
                    <span className="mt-1 hidden text-[9px] font-semibold sm:block">
                      {t(`st_${s}`)}
                    </span>
                  </div>
                  {i < FLOW.length - 1 && (
                    <div
                      className={`mx-1 mb-0 h-0.5 flex-1 sm:mb-4 ${
                        i < statusIdx ? "bg-ok" : "bg-border"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </Panel>
        )}

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          {/* Left: assignment + address + chat */}
          <div className="space-y-5">
            <Panel title={t("bd_worker")}>
              {booking.workerUserId ? (
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-full border border-ok/30 bg-ok-soft">
                    <ShieldCheck className="size-5 text-ok" />
                  </span>
                  <div>
                    <p className="text-sm font-bold">Verified artisan</p>
                    <p className="text-xs text-muted-foreground">
                      {t("kyc_badge")} · {booking.workerVpa ?? t("upi_missing")}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {t("bd_unassigned")}
                </p>
              )}
              <div className="mt-4 space-y-1 border-t border-dashed border-border pt-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("bk_address")}</span>
                  <span className="max-w-[60%] text-right font-semibold">
                    {booking.address}
                  </span>
                </div>
                {booking.notes && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("bk_notes")}</span>
                    <span className="max-w-[60%] text-right">
                      {booking.notes}
                    </span>
                  </div>
                )}
              </div>
            </Panel>

            {/* Chat */}
            <Panel title={t("bd_chat")} bodyClassName="p-0">
              <div className="max-h-64 space-y-2 overflow-y-auto p-4">
                {(messages ?? []).map((m) => {
                  const mine = m.senderId === user?._id;
                  return (
                    <div
                      key={m._id}
                      className={`flex ${mine ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-sm border px-3 py-2 text-xs ${
                          mine
                            ? "border-forest/20 bg-forest-soft text-forest"
                            : "border-border bg-secondary text-foreground"
                        }`}
                      >
                        <p className="mb-0.5 text-[9px] font-bold uppercase tracking-wider opacity-60">
                          {m.senderName} · {m.senderRole}
                        </p>
                        {m.body}
                      </div>
                    </div>
                  );
                })}
                {messages?.length === 0 && (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    {t("bd_chat_ph")}
                  </p>
                )}
                <div ref={chatEndRef} />
              </div>
              <div className="flex items-center gap-2 border-t border-border p-3">
                <input
                  className="tl-input h-9 flex-1"
                  placeholder={t("bd_chat_ph")}
                  value={chat}
                  onChange={(e) => setChat(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleSend();
                  }}
                />
                <TlButton
                  className="h-9 px-3"
                  onClick={() => void handleSend()}
                  disabled={!chat.trim()}
                >
                  <Send className="size-4" />
                </TlButton>
              </div>
            </Panel>
          </div>

          {/* Right: payment + actions */}
          <div className="space-y-5">
            {/* UPI payment */}
            <Panel title={t("bd_upi_title")} bodyClassName="p-6">
              <div className="flex flex-col items-center text-center">
                <div className="rounded-sm border border-border bg-card p-3">
                  <QRCodeSVG value={upiString} size={140} />
                </div>
                <p className="mt-3 text-xs font-bold text-forest">
                  ₹{booking.total} · {t("bk_total")}
                </p>
                <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
                  {t("bd_upi_note")}
                </p>
              </div>

              {booking.status === "payment" && !paid && booking.utr === undefined && (
                <div className="mt-4 space-y-2 border-t border-dashed border-border pt-4">
                  <span className="tl-label">{t("bd_utr")}</span>
                  <input
                    className="tl-input"
                    placeholder={t("bd_utr_ph")}
                    value={utr}
                    onChange={(e) => setUtr(e.target.value)}
                  />
                  <TlButton
                    variant="ok"
                    className="w-full"
                    onClick={handleConfirmPaid}
                    disabled={busy || utr.trim().length < 6}
                  >
                    {busy ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <BadgeCheck className="size-4" />
                    )}
                    {t("bd_confirm_paid")}
                  </TlButton>
                </div>
              )}
              {(paid || booking.utr) && (
                <p className="mt-3 rounded-sm border border-ok/30 bg-ok-soft px-3 py-2 text-center text-xs font-semibold text-ok">
                  {t("bd_paid_ok")} {booking.utr ? `(${booking.utr})` : ""}
                </p>
              )}
            </Panel>

            {/* Worker actions */}
            {isWorker && stageKeys[booking.status] && (
              <Panel bodyClassName="p-4">
                <TlButton
                  className="w-full"
                  onClick={handleAdvance}
                  disabled={busy}
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <StatusDot tone="ok" />
                  )}
                  {t("bd_advance", { stage: t(stageKeys[booking.status]) })}
                </TlButton>
              </Panel>
            )}

            {/* Bill summary */}
            <Panel title={t("bk_summary")} bodyClassName="p-4">
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("bk_visit")}</span>
                  <span className="font-semibold">₹{booking.base}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("bk_welfare_row")}
                  </span>
                  <span className="font-semibold">
                    {booking.welfareAmt > 0 ? `₹${booking.welfareAmt}` : "—"}
                  </span>
                </div>
                <div className="flex justify-between border-t border-dashed border-border pt-2 text-sm">
                  <span className="font-bold">{t("bk_total")}</span>
                  <span className="font-bold">₹{booking.total}</span>
                </div>
              </div>
            </Panel>

            {/* Cancel */}
            {!["completed", "settled", "cancelled"].includes(booking.status) && (
              <button
                type="button"
                onClick={handleCancel}
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-sm border border-destructive/40 px-4 py-2.5 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/5"
              >
                <XCircle className="size-4" />
                {t("bd_cancel")}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
