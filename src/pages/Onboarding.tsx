import { useEffect, useState } from "react";
import { HardHat } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { Link, useNavigate } from "react-router";
import { useLang } from "@/lib/i18n";
import {
  SOCIETIES,
  TRADES,
  type TradeId,
} from "@/lib/trades";
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
  ArrowRight,
  BadgeCheck,
  Check,
  HandHeart,
  Loader2,
  ShieldCheck,
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
  const { t } = useLang();
  const artisan = useQuery(api.artisans.getMyArtisan, {});
  const saveProfile = useMutation(api.artisans.saveProfile);
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>(1);
  const [mode, setMode] = useState<"register" | "signin">("register");
  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /* Hydrate form from stored profile and gate the step. */
  useEffect(() => {
    if (!artisan) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync once from the server-loaded profile
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
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-800 text-white">
              <HandHeart className="size-4" />
            </span>
            <span className="text-sm font-bold text-slate-900">Sahakar Seva</span>
          </Link>
          <LanguagePicker />
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        {/* ── Skilled Worker & Artisan Portal header card ────── */}
        <div className="mb-6 flex flex-col items-center rounded-3xl border border-slate-200 bg-white px-6 py-8 text-center shadow-xs">
          <span className="flex size-16 items-center justify-center rounded-2xl bg-teal-100 text-teal-700">
            <HardHat className="size-8" />
          </span>
          <h1 className="mt-4 text-2xl font-black tracking-tight text-slate-900">
            Skilled Worker &amp; Artisan Portal
          </h1>
          <p className="mt-1.5 text-xs text-slate-500 italic">
            Cooperative Roster Registration · Skill Competancy Checks &amp;
            Verified Trade Credentials
          </p>
          {/* Register / Sign-in toggle */}
          <div className="mt-5 grid w-full max-w-md grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => setMode("register")}
              className={`rounded-lg px-3 py-2 text-xs font-bold transition ${
                mode === "register"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Register New Skilled Worker
            </button>
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={`rounded-lg px-3 py-2 text-xs font-bold transition ${
                mode === "signin"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Worker Sign In
            </button>
          </div>
          {mode === "signin" && (
            <div className="mt-4 w-full max-w-md rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-left">
              <p className="text-xs font-semibold text-emerald-900">
                Already registered with a district society?
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-emerald-800/80 italic">
                Sign in with your email to reach your worker hub, live service
                requests and telemetry dashboard. New here? Switch back to
                Register and complete the three steps.
              </p>
              <Link
                to="/auth?returnTo=/dashboard"
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-teal-900 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-teal-800 active:scale-95"
              >
                Continue to Sign In →
              </Link>
            </div>
          )}
        </div>

        {mode === "signin" ? null : (
        <>
        <SectionHeader title={t("ob_title")} sub={t("ob_sub")} />

        {/* Step rail */}
        <div className="mt-5 grid grid-cols-3 gap-2">
          {(
            [
              [1, t("step_profile")],
              [2, t("step_identity")],
              [3, t("step_skill")],
            ] as [number, string][]
          ).map(([n, label]) => {
            const active = step === n;
            const done = step > n;
            return (
              <div
                key={n}
                className={`rounded-xl border px-2 py-2.5 text-center transition ${
                  active
                    ? "border-emerald-600 bg-emerald-50"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex items-center justify-center gap-1.5">
                  {done ? (
                    <Check className="size-3 text-emerald-600" />
                  ) : (
                    <span
                      className={`text-[10px] font-bold ${
                        active ? "text-emerald-700" : "text-slate-400"
                      }`}
                    >
                      {n}
                    </span>
                  )}
                  <span
                    className={`text-[10px] uppercase tracking-wider ${
                      active || done
                        ? "font-bold text-slate-900"
                        : "text-slate-400"
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
                <StepSkill
                  artisan={artisan}
                  onNext={() => setStep(4)}
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
        </>
        )}
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
    <Panel tag="step 1/4">
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
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-semibold capitalize transition ${
                    active
                      ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >                  <Icon
                    className={`size-4 ${
                      active ? "text-emerald-700" : "text-slate-400"
                    }`
                  }
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
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
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
    <Panel tag="step 2/4">
      <div className="flex flex-col items-center py-6 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50">
          <ShieldCheck className="size-7 text-emerald-700" />
        </span>
        <h3 className="mt-4 text-lg font-extrabold text-slate-900">{t("kyc_title")}</h3>
        <p className="mt-1 max-w-md text-sm leading-6 text-slate-600">
          {t("kyc_desc")}
        </p>
        <div className="mt-5 w-full max-w-sm space-y-1.5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs">
          <Row label={t("kyc_masked")} value={`XXXX XXXX ${artisan.idLast4}`} />
          <Row label={t("kyc_ref")} value={artisan.kycRef ?? "—"} />
          <Row
            label={t("kyc_time")}
            value={
              artisan.kycVerifiedAt
                ? new Date(artisan.kycVerifiedAt).toLocaleString()
                : "—"
            }
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

/* ══════════ STEP 3 — Skill confirmation ══════════ */

function StepSkill({
  artisan,
  onNext,
  t,
}: {
  artisan: ArtisanDoc;
  onNext: () => void;
  t: TT;
}) {
  const confirmSkill = useMutation(api.artisans.confirmSkill);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trade = artisan.trade;

  async function handleConfirm() {
    setConfirming(true);
    setError(null);
    try {
      await confirmSkill({});
      onNext();
    } catch (e) {
      const raw = e instanceof Error ? e.message : "";
      setError(raw.replace(/^\[CONVEX[^\]]*\]\s*/, "") || "Could not issue the credential. Please try again.");
      setConfirming(false);
    }
  }

  return (
    <Panel tag="step 3/4">
      <div className="flex flex-col items-center py-6 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50">
          <ShieldCheck className="size-7 text-emerald-700" />
        </span>
        <h3 className="mt-4 text-lg font-extrabold text-slate-900">
          {t("skill_title")}
        </h3>
        <p className="mt-1 max-w-md text-sm leading-6 text-slate-600">
          {t("skill_desc", { trade })}
        </p>

        <div className="mt-5 w-full max-w-sm space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left text-xs">
          <div className="flex items-start gap-2">
            <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
            <span className="text-slate-700">
              I work as a <b>{trade}</b> and my profile details are accurate.
            </span>
          </div>
          <div className="flex items-start gap-2">
            <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
            <span className="text-slate-700">
              I can attend service calls in my district and will keep my
              availability status up to date.
            </span>
          </div>
          <div className="flex items-start gap-2">
            <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
            <span className="text-slate-700">
              I will follow the federation code of conduct — fair rates,
              quality work and respectful conduct with customers.
            </span>
          </div>
        </div>

        {error && (
          <div className="mt-3 w-full max-w-sm rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
            {error}
          </div>
        )}
        <TlButton className="mt-6" disabled={confirming} onClick={() => void handleConfirm()}>
          {confirming ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Check className="size-4" />
          )}
          {t("skill_confirm")}
          <ArrowRight className="size-4" />
        </TlButton>
        <p className="mt-3 text-[10px] text-slate-400">
          {t("skill_note")}
        </p>
      </div>
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
    <Panel tag="step 4/4">
      <div className="flex flex-col items-center py-4 text-center">
        <motion.span
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
          className="flex size-16 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50"
        >
          <BadgeCheck className="size-8 text-emerald-700" />
        </motion.span>
        <h3 className="mt-4 text-lg font-extrabold text-slate-900">{t("cred_title")}</h3>
        <p className="mt-1 text-sm text-slate-600">{t("cred_sub")}</p>
        <div className="mt-5 w-full max-w-sm space-y-1.5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs">
          <Row label={t("cred_id")} value={artisan.credentialId ?? "—"} />
          <Row label={t("cred_score")} value={`${artisan.quizScore ?? 0}%`} />
          <Row
            label={t("cred_issued")}
            value={
              artisan.credentialIssuedAt
                ? new Date(artisan.credentialIssuedAt).toLocaleDateString()
                : "—"
            }
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
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}
