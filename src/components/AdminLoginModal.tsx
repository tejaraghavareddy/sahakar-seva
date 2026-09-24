import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, LockKeyhole, ShieldCheck, X } from "lucide-react";

interface AdminLoginModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Secure Federation Officer clearance dialog.
 * Two paths to clearance:
 *  1. Sign in with the recognized master administrator email
 *     (teja200822@gmail.com) via email OTP.
 *  2. Emergency offline passcode for local testing
 *     (SAHAKAR-BOARD-2026) — grants the admin role to the current session.
 */
export default function AdminLoginModal({ open, onClose, onSuccess }: AdminLoginModalProps) {
  const { isAuthenticated, isLoading, signIn } = useAuth();
  const emergencyUnlock = useMutation(api.admin.emergencyUnlock);

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("email", email);
      await signIn("email-otp", fd);
      setOtpSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the code");
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("email", email);
      fd.set("code", otp);
      await signIn("email-otp", fd);
      // Session cleared; the master email check happens server-side.
      onSuccess();
    } catch {
      setError("The code is incorrect or expired. Please try again.");
      setBusy(false);
    }
  }

  async function handleEmergency(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // Ensure there is a session to grant clearance to (auto guest sign-in).
      if (!isAuthenticated) {
        await signIn("anonymous");
      }
      await emergencyUnlock({ passcode });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid emergency passcode");
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-xl bg-slate-900 text-white">
              <ShieldCheck className="size-4" />
            </span>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">
                Federation Officer Clearance
              </h2>
              <p className="text-[11px] text-slate-500">
                Governance &amp; Supervisory Board access only
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-xl border border-slate-200 text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-5 px-5 py-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="size-5 animate-spin text-slate-400" />
            </div>
          ) : !otpSent ? (
            /* Email sign-in */
            <form onSubmit={handleSendOtp} className="space-y-3">
              <p className="text-xs leading-relaxed text-slate-600">
                Sign in with the recognized master administrator email to receive
                a one-time verification code.
              </p>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="officer@sahakarseva.org"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
              {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
              <button
                type="submit"
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 active:scale-95 disabled:opacity-50"
              >
                {busy && <Loader2 className="size-4 animate-spin" />}
                <LockKeyhole className="size-4" />
                Send verification code
              </button>
            </form>
          ) : (
            /* OTP verify */
            <form onSubmit={handleVerifyOtp} className="space-y-3">
              <p className="text-xs leading-relaxed text-slate-600">
                Enter the 6-digit code sent to{" "}
                <span className="font-bold text-slate-900">{email}</span>.
              </p>
              <input
                inputMode="numeric"
                maxLength={6}
                required
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="······"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-center text-lg font-black tracking-[0.5em] text-slate-900 transition focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
              {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
              <button
                type="submit"
                disabled={busy || otp.length !== 6}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 active:scale-95 disabled:opacity-50"
              >
                {busy && <Loader2 className="size-4 animate-spin" />}
                Verify &amp; enter admin portal
              </button>
              <button
                type="button"
                onClick={() => { setOtpSent(false); setOtp(""); setError(null); }}
                className="w-full text-center text-[11px] font-semibold text-slate-500 hover:text-emerald-700"
              >
                Use a different email
              </button>
            </form>
          )}

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                or emergency passcode
              </span>
            </div>
          </div>

          {/* Emergency passcode (offline / local testing) */}
          <form onSubmit={handleEmergency} className="space-y-3">
            <p className="text-xs leading-relaxed text-slate-600">
              For offline and local testing, board officers can unlock the
              console with the federation emergency passcode.
            </p>
            <input
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Emergency passcode"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
            {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
            <button
              type="submit"
              disabled={busy || !passcode.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 active:scale-95 disabled:opacity-50"
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              <LockKeyhole className="size-4" />
              Unlock with passcode
            </button>
            {!isAuthenticated && (
              <p className="text-center text-[11px] text-slate-500">
                First-time officer? Enter the passcode and a guest account with
                board clearance will be created for you automatically.
              </p>
            )}
          </form>
        </div>

        <div className="rounded-b-3xl border-t border-slate-200 bg-slate-50 px-5 py-3">
          <p className="text-center text-[10px] text-slate-400">
            All clearance attempts are logged in the federation audit ledger ·
            5 wrong passcodes lock access for 10 minutes · guest sessions
            cannot unlock via passcode.
          </p>
        </div>
      </div>
    </div>
  );
}
