import { useState } from "react";
import { useMutation } from "convex/react";
import { Loader2, ShieldCheck } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useLang } from "@/lib/i18n";
import { Panel } from "@/components/terminal";

/**
 * Safety Mode.
 *
 * Built for the customer who is booking a stranger into her home, or an elderly
 * household alone with a leaking pipe. It is a switch, not a separate app, and
 * it changes two real things rather than adding a badge:
 *
 *  - the catalog narrows to workers who are both KYC-verified *and* have had
 *    their work evidence signed off by the board;
 *  - the worker's job shows no address until they are actually en route.
 *
 * The address rule is enforced in the query, not in this component — a masked
 * string over a full address in the payload would be security theatre.
 */
export default function SafetyModeToggle({
  enabled,
  onChange,
}: {
  /** Current state, read from the user record. */
  enabled: boolean;
  /** Called after a successful write so the caller can refresh. */
  onChange?: (next: boolean) => void;
}) {
  const { t } = useLang();
  const [busy, setBusy] = useState(false);
  const setSafetyMode = useMutation(api.bookings.setSafetyMode);

  async function toggle() {
    const next = !enabled;
    setBusy(true);
    try {
      await setSafetyMode({ enabled: next });
      onChange?.(next);
    } catch {
      // surfaced via the Convex error toast
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel
      className={enabled ? "border-teal-300 bg-teal-50/50" : undefined}
      title={t("sf_title")}
      bodyClassName="p-4"
    >
      <p className="text-[11px] leading-relaxed text-slate-600">
        {t("sf_sub")}
      </p>
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={busy}
        className={`mt-3 flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition active:scale-[0.98] disabled:opacity-60 ${
          enabled
            ? "border-teal-600 bg-teal-600 text-white"
            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
        }`}
      >
        <span className="flex items-center gap-2 text-xs font-bold">
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ShieldCheck className="size-4" />
          )}
          {enabled ? t("sf_on") : t("sf_off")}
        </span>
        <span
          className={`relative h-5 w-9 shrink-0 rounded-full border transition-colors ${
            enabled ? "border-white/50 bg-white/30" : "border-slate-200 bg-slate-100"
          }`}
        >
          <span
            className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-all ${
              enabled ? "left-[18px]" : "left-0.5"
            }`}
          />
        </span>
      </button>
    </Panel>
  );
}
