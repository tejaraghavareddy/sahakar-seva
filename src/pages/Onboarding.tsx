import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { Link, useNavigate } from "react-router";
import { useLang } from "@/lib/i18n";
import {
  SOCIETIES,
  TRADES,
  QUIZ,
  QUIZ_PASS_MARK,
  getTrade,
  type TradeId,
} from "@/lib/trades";
import {
  speak,
  stopSpeaking,
  sttSupported,
  createRecognition,
} from "@/lib/speech";
import {
  LanguagePicker,
  MonoBadge,
  Panel,
  SectionHeader,
  StatusDot,
  TlButton,
} from "@/components/terminal";
import { IdCardDialog } from "@/components/IdCardDialog";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Check,
  Loader2,
  Mic,
  ShieldCheck,
  Volume2,
} from "lucide-react";

type Step = 1 | 2 | 3 | 4;
type ArtisanDoc = Doc<"artisans">;

interface ProfileForm {
  fullName: string;
  phone: string;
  trade: TradeId | "";
  district: string;
  state: string;
  societyId: string;
  experienceYears: string;
  dailyRate: string;
  upiVpa: string;
  idType: "aadhaar" | "voter";
  idNumber: string;
}

const EMPTY_FORM: ProfileForm = {
  fullName: "",
  phone: "",
  trade: "",
  district: "",
  state: "",
  societyId: "",
  experienceYears: "",
  dailyRate: "",
  upiVpa: "",
  idType: "aadhaar",
  idNumber: "",
};

type TT = (k: string, vars?: Record<string, string | number>) => string;

export default function Onboarding() {
  const { t, speechLang } = useLang();
  const artisan = useQuery(api.artisans.getMyArtisan, {});
  const saveProfile = useMutation(api.artisans.saveProfile);
  const submitQuiz = useMutation(api.artisans.submitQuiz);
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /* Hydrate form from stored profile and gate the step. */
  useEffect(() => {
    if (!artisan) return;
    setForm((f) => ({
      ...f,
      fullName: f.fullName || artisan.fullName,
      phone: f.phone || artisan.phone,
      trade: (f.trade || artisan.trade) as ProfileForm["trade"],
      district: f.district || artisan.district,
      state: f.state || artisan.state,
      societyId: f.societyId || artisan.societyId,
      experienceYears: f.experienceYears || String(artisan.experienceYears),
      dailyRate: f.dailyRate || String(artisan.dailyRate),
      upiVpa: f.upiVpa || artisan.upiVpa || "",
    }));
    setStep(() => {
      if (artisan.quizPassed) return 4;
      if (artisan.kycStatus === "verified") return 3;
      return 2;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artisan?._id]);

  const update = <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function handleProfileSave() {
    setError(null);
    if (
      !form.fullName.trim() ||
      !form.phone.trim() ||
      !form.trade ||
      !form.district.trim() ||
      !form.state.trim() ||
      !form.societyId ||
      !form.experienceYears ||
      !form.dailyRate ||
      !form.idNumber.trim()
    ) {
      setError(t("req_missing"));
      return;
    }
    if (!/^\d{10}$/.test(form.phone.replace(/\D/g, ""))) {
      setError(t("req_phone"));
      return;
    }
    if (form.idNumber.replace(/\D/g, "").length < 4) {
      setError(t("req_id"));
      return;
    }
    setSaving(true);
    try {
      await saveProfile({
        fullName: form.fullName,
        phone: form.phone,
        trade: form.trade,
        district: form.district,
        state: form.state,
        societyId: form.societyId,
        experienceYears: Number(form.experienceYears) || 0,
        dailyRate: Number(form.dailyRate) || 0,
        upiVpa: form.upiVpa || undefined,
        idType: form.idType,
        idNumber: form.idNumber,
      });
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="tl-shell">
      <header className="tl-band sticky top-0 z-40">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-sm border border-foreground bg-foreground text-xs font-bold text-background">
              &gt;_
            </span>
            <span className="text-sm font-bold">sahakar-seva</span>
          </Link>
          <LanguagePicker />
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <SectionHeader title={t("ob_title")} sub={t("ob_sub")} />

        {/* Step rail */}
        <div className="mt-5 grid grid-cols-4 gap-px overflow-hidden rounded-sm border border-border bg-border">
          {(
            [
              [1, t("step_profile")],
              [2, t("step_identity")],
              [3, t("step_skill")],
              [4, t("step_credential")],
            ] as const
          ).map(([n, label]) => {
            const active = step === n;
            const done = step > n;
            return (
              <div
                key={n}
                className={`bg-card px-2 py-2.5 text-center ${
                  active ? "outline outline-2 -outline-offset-2 outline-ok" : ""
                }`}
              >
                <div className="flex items-center justify-center gap-1.5">
                  {done ? (
                    <Check className="size-3 text-ok" />
                  ) : (
                    <span
                      className={`text-[10px] font-bold ${
                        active ? "text-ok" : "text-muted-foreground"
                      }`}
                    >
                      {n}
                    </span>
                  )}
                  <span
                    className={`text-[10px] uppercase tracking-wider ${
                      active || done ? "font-bold" : "text-muted-foreground"
                    }`}
                  >
                    {label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="s1"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.22 }}
              >
                <StepProfile
                  form={form}
                  update={update}
                  error={error}
                  saving={saving}
                  onSubmit={handleProfileSave}
                  t={t}
                />
              </motion.div>
            )}
            {step === 2 && artisan && (
              <motion.div
                key="s2"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.22 }}
              >
                <StepKyc artisan={artisan} onNext={() => setStep(3)} t={t} />
              </motion.div>
            )}
            {step === 3 && artisan && (
              <motion.div
                key="s3"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.22 }}
              >
                <StepQuiz
                  artisan={artisan}
                  speechLang={speechLang}
                  onPassed={() => setStep(4)}
                  t={t}
                />
              </motion.div>
            )}
            {step === 4 && artisan && (
              <motion.div
                key="s4"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.25 }}
              >
                <StepCredential
                  artisan={artisan}
                  onHub={() => navigate("/dashboard")}
                  t={t}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

/* ══════════ STEP 1 — Trade profile ══════════ */

function StepProfile({
  form,
  update,
  error,
  saving,
  onSubmit,
  t,
}: {
  form: ProfileForm;
  update: <K extends keyof ProfileForm>(k: K, v: ProfileForm[K]) => void;
  error: string | null;
  saving: boolean;
  onSubmit: () => void;
  t: TT;
}) {
  return (
    <Panel title="$ profile --init" tag="step 1/4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="space-y-4"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("f_fullname")}>
            <input
              className="tl-input"
              value={form.fullName}
              onChange={(e) => update("fullName", e.target.value)}
              placeholder="Ramesh Kumar"
              required
            />
          </Field>
          <Field label={t("f_phone")}>
            <input
              className="tl-input"
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
              placeholder="9876543210"
              inputMode="numeric"
              required
            />
          </Field>
        </div>

        <Field label={t("f_trade")}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {TRADES.map((trade) => {
              const Icon = trade.icon;
              const active = form.trade === trade.id;
              return (
                <button
                  type="button"
                  key={trade.id}
                  onClick={() => {
                    update("trade", trade.id);
                    update("dailyRate", String(trade.baseRate));
                  }}
                  className={`flex items-center gap-2 rounded-sm border px-3 py-2.5 text-left text-xs font-semibold transition-colors ${
                    active
                      ? "border-ok bg-ok-soft text-forest"
                      : "border-input bg-card hover:bg-secondary"
                  }`}
                >
                  <Icon
                    className={`size-4 ${
                      active ? "text-ok" : "text-muted-foreground"
                    }`}
                  />
                  {trade.id}
                </button>
              );
            })}
          </div>
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t("f_district")}>
            <input
              className="tl-input"
              value={form.district}
              onChange={(e) => update("district", e.target.value)}
              placeholder="Hyderabad"
              required
            />
          </Field>
          <Field label={t("f_state")}>
            <input
              className="tl-input"
              value={form.state}
              onChange={(e) => update("state", e.target.value)}
              placeholder="Telangana"
              required
            />
          </Field>
          <Field label={t("f_exp")}>
            <input
              className="tl-input"
              value={form.experienceYears}
              onChange={(e) => update("experienceYears", e.target.value)}
              inputMode="numeric"
              placeholder="8"
              required
            />
          </Field>
        </div>

        <Field label={t("f_society")}>
          <select
            className="tl-input"
            value={form.societyId}
            onChange={(e) => {
              const s = SOCIETIES.find((x) => x.id === e.target.value);
              update("societyId", e.target.value);
              if (s) {
                update("district", s.district);
                update("state", s.state);
              }
            }}
            required
          >
            <option value="">—</option>
            {SOCIETIES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("f_rate")}>
            <input
              className="tl-input"
              value={form.dailyRate}
              onChange={(e) => update("dailyRate", e.target.value)}
              inputMode="numeric"
              placeholder="850"
              required
            />
          </Field>
          <Field label={t("f_idtype")}>
            <select
              className="tl-input"
              value={form.idType}
              onChange={(e) =>
                update("idType", e.target.value as "aadhaar" | "voter")
              }
            >
              <option value="aadhaar">{t("id_aadhaar")}</option>
              <option value="voter">{t("id_voter")}</option>
            </select>
          </Field>
        </div>

        <Field label={t("f_upi")} hint={t("upi_missing")}>
          <input
            className="tl-input"
            value={form.upiVpa}
            onChange={(e) => update("upiVpa", e.target.value)}
            placeholder={t("f_upi_ph")}
          />
        </Field>

        <Field label={t("f_idnumber")} hint={t("id_hint")}>
          <input
            className="tl-input"
            value={form.idNumber}
            onChange={(e) => update("idNumber", e.target.value)}
            inputMode="numeric"
            placeholder="•••• •••• 4821"
            required
          />
        </Field>

        {error && (
          <p className="rounded-sm border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {error}
          </p>
        )}

        <div className="flex justify-end">
          <TlButton type="submit" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {t("saving")}
              </>
            ) : (
              <>
                {t("btn_continue")}
                <ArrowRight className="size-4" />
              </>
            )}
          </TlButton>
        </div>
      </form>
    </Panel>
  );
}

/* ══════════ STEP 2 — KYC verification ══════════ */

function StepKyc({
  artisan,
  onNext,
  t,
}: {
  artisan: ArtisanDoc;
  onNext: () => void;
  t: TT;
}) {
  return (
    <Panel title="$ verify --identity" tag="step 2/4">
      <div className="flex flex-col items-center py-6 text-center">
        <span className="flex size-14 items-center justify-center rounded-full border border-ok/30 bg-ok-soft">
          <ShieldCheck className="size-7 text-ok" />
        </span>
        <h3 className="mt-4 text-lg font-bold">{t("kyc_title")}</h3>
        <p className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">
          {t("kyc_desc")}
        </p>
        <div className="mt-5 w-full max-w-sm space-y-1.5 rounded-sm border border-border bg-secondary/40 p-4 text-xs">
          <Row label={t("kyc_masked")} value={`XXXX XXXX ${artisan.idLast4}`} />
          <Row label={t("kyc_ref")} value={artisan.kycRef ?? "—"} />
          <Row
            label={t("kyc_time")}
            value={new Date(artisan.kycVerifiedAt ?? Date.now()).toLocaleString()}
          />
          <div className="flex items-center justify-between pt-1">
            <span className="text-muted-foreground">{t("kyc_row")}</span>
            <MonoBadge tone="ok">
              <StatusDot tone="ok" blink /> {t("kyc_badge")}
            </MonoBadge>
          </div>
        </div>
        <TlButton className="mt-6" onClick={onNext}>
          {t("kyc_next")}
          <ArrowRight className="size-4" />
        </TlButton>
      </div>
    </Panel>
  );
}

/* ══════════ STEP 3 — Voice skill quiz ══════════ */

function StepQuiz({
  artisan,
  speechLang,
  onPassed,
  t,
}: {
  artisan: ArtisanDoc;
  speechLang: string;
  onPassed: () => void;
  t: TT;
}) {
  const submitQuiz = useMutation(api.artisans.submitQuiz);
  const questions = useMemo(
    () => QUIZ[artisan.trade as TradeId] ?? [],
    [artisan.trade],
  );
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [heard, setHeard] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [spokenIdx, setSpokenIdx] = useState<number | null>(null);

  const q = questions[idx];
  const total = questions.length;
  const stt = sttSupported();

  /* Auto read-aloud each question when it appears (options only — never the answer). */
  useEffect(() => {
    if (!q) return;
    speak(spokenQuestion(idx, q.options), speechLang);
    setSpokenIdx(idx);
    return () => stopSpeaking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, artisan.trade]);

  function handleSelect(optionIdx: number) {
    setAnswers((a) => {
      const next = [...a];
      next[idx] = optionIdx;
      return next;
    });
  }

  function startListening() {
    if (listening) return;
    setListening(true);
    setHeard(null);
    setMicError(null);
    createRecognition(
      speechLang,
      (transcript) => {
        setHeard(transcript);
        matchVoice(transcript, q.options, setAnswers, idx);
      },
      () => setListening(false),
      () => {
        setListening(false);
        setMicError(t("quiz_mic_unsupported"));
      },
    );
  }

  async function handleSubmit() {
    setSubmitting(true);
    setQuizError(null);
    try {
      const correct = questions.reduce(
        (acc, qq, i) => acc + (answers[i] === qq.answer ? 1 : 0),
        0,
      );
      const score = Math.round((correct / total) * 100);
      await submitQuiz({ score });
      stopSpeaking();
      onPassed();
    } catch (e) {
      setQuizError(e instanceof Error ? e.message : t("quiz_error"));
    } finally {
      setSubmitting(false);
    }
  }

  if (!q) return null;

  return (
    <Panel title="$ skill-test --voice" tag="step 3/4">
      <p className="text-xs text-muted-foreground">
        {t("quiz_sub", { pass: QUIZ_PASS_MARK })}
      </p>

      {/* Progress dots */}
      <div className="mt-4 flex gap-1.5">
        {questions.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full ${
              answers[i] !== undefined
                ? "bg-ok"
                : i === idx
                  ? "bg-foreground"
                  : "bg-border"
            }`}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.18 }}
          className="mt-5"
        >
          <div className="flex items-center justify-between">
            <span className="tl-label">
              {t("quiz_q", { n: idx + 1, total })}
            </span>
            <button
              type="button"
              onClick={() => {
                if (spokenIdx === idx) {
                  stopSpeaking();
                  setSpokenIdx(null);
                } else {
                  speak(spokenQuestion(idx, q.options), speechLang);
                  setSpokenIdx(idx);
                }
              }}
              className="tl-icon-btn"
              title={t("quiz_speak")}
            >
              <Volume2 className="size-4" />
            </button>
          </div>

          {/* Pictorial question */}
          <div className="mt-3 flex flex-col items-center rounded-sm border border-border bg-secondary/40 py-6">
            <q.icon className="size-12 text-forest" strokeWidth={1.5} />
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {q.options.map((opt, i) => {
              const selected = answers[idx] === i;
              return (
                <button
                  type="button"
                  key={i}
                  onClick={() => handleSelect(i)}
                  className={`flex items-center gap-2.5 rounded-sm border px-3.5 py-3 text-left text-xs font-semibold transition-colors ${
                    selected
                      ? "border-ok bg-ok-soft text-forest"
                      : "border-input bg-card hover:bg-secondary"
                  }`}
                >
                  <span
                    className={`flex size-5 shrink-0 items-center justify-center rounded-sm border text-[10px] font-bold ${
                      selected
                        ? "border-ok bg-ok text-white"
                        : "border-input text-muted-foreground"
                    }`}
                  >
                    {String.fromCharCode(65 + i)}
                  </span>
                  {opt}
                </button>
              );
            })}
          </div>

          {/* Voice answer */}
          <div className="mt-4 flex flex-col items-center gap-2">
            <button
              type="button"
              disabled={!stt}
              onClick={startListening}
              className={`flex size-12 items-center justify-center rounded-full border transition-colors ${
                listening
                  ? "border-warn bg-warn-soft text-warn tl-blink"
                  : "border-foreground bg-foreground text-background hover:bg-foreground/90"
              } ${!stt ? "opacity-40" : ""}`}
            >
              <Mic className="size-5" />
            </button>
            <p className="text-[10px] text-muted-foreground">
              {listening ? t("quiz_listening") : t("quiz_mic")}
            </p>
            {heard && (
              <p className="text-[10px] text-ok">
                {t("quiz_heard", { text: heard })}
              </p>
            )}
            {micError && <p className="text-[10px] text-warn">{micError}</p>}
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
        <TlButton
          variant="ghost"
          disabled={idx === 0}
          onClick={() => setIdx((i) => i - 1)}
        >
          <ArrowLeft className="size-4" />
          {t("btn_back")}
        </TlButton>
        {idx < total - 1 ? (
          <TlButton
            disabled={answers[idx] === undefined}
            onClick={() => setIdx((i) => i + 1)}
          >
            {t("quiz_next")}
            <ArrowRight className="size-4" />
          </TlButton>
        ) : (
          <TlButton
            variant="ok"
            disabled={answers.filter((_, i) => i < total).some((a) => a === undefined)}
            onClick={handleSubmit}
          >
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {t("quiz_scoring")}
              </>
            ) : (
              <>
                <Check className="size-4" />
                {t("quiz_submit")}
              </>
            )}
          </TlButton>
        )}
      </div>

      {quizError && (
        <div className="mt-3 rounded-sm border border-warn/40 bg-warn-soft px-3 py-2 text-xs text-warn">
          {quizError}
        </div>
      )}
    </Panel>
  );
}

/* ══════════ STEP 4 — Credential ══════════ */

function StepCredential({
  artisan,
  onHub,
  t,
}: {
  artisan: ArtisanDoc;
  onHub: () => void;
  t: TT;
}) {
  return (
    <Panel title="$ credential --issue" tag="step 4/4">
      <div className="flex flex-col items-center py-4 text-center">
        <motion.span
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
          className="flex size-16 items-center justify-center rounded-full border border-ok/30 bg-ok-soft"
        >
          <BadgeCheck className="size-8 text-ok" />
        </motion.span>
        <h3 className="mt-4 text-lg font-bold">{t("cred_title")}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{t("cred_sub")}</p>
        <div className="mt-5 w-full max-w-sm space-y-1.5 rounded-sm border border-border bg-secondary/40 p-4 text-xs">
          <Row label={t("cred_id")} value={artisan.credentialId ?? "—"} />
          <Row label={t("cred_score")} value={`${artisan.quizScore ?? 0}%`} />
          <Row
            label={t("cred_issued")}
            value={new Date(
              artisan.credentialIssuedAt ?? Date.now(),
            ).toLocaleDateString()}
          />
          <Row label={t("kyc_masked")} value={`XXXX XXXX ${artisan.idLast4}`} />
        </div>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <IdCardDialog artisan={artisan} />
          <TlButton variant="outline" onClick={onHub}>
            {t("btn_hub")}
            <ArrowRight className="size-4" />
          </TlButton>
        </div>
        <p className="mt-4 text-[10px] text-muted-foreground">
          {t("readonly_note")}
        </p>
      </div>
    </Panel>
  );
}

/* ── helpers ── */

/** Builds the spoken form of a question: "Question 2. A. … B. … C. … D. …" */
function spokenQuestion(idx: number, options: string[]): string {
  const list = options
    .map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt}`)
    .join(". ");
  return `Question ${idx + 1}. ${list}`;
}

function matchVoice(
  transcript: string,
  options: string[],
  setAnswers: (fn: (a: number[]) => number[]) => void,
  idx: number,
) {
  const norm = (s: string) =>
    s.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, "").trim();
  const heardNorm = norm(transcript);
  let best = -1;
  let bestLen = 0;
  options.forEach((opt, i) => {
    const optNorm = norm(opt);
    if (heardNorm.includes(optNorm) && optNorm.length > bestLen) {
      best = i;
      bestLen = optNorm.length;
    }
  });
  if (best >= 0) {
    setAnswers((a) => {
      const next = [...a];
      next[idx] = best;
      return next;
    });
  }
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="tl-label mb-1.5 block">{label}</span>
      {children}
      {hint && (
        <span className="mt-1 block text-[10px] text-muted-foreground">
          {hint}
        </span>
      )}
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
