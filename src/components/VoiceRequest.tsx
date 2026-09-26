import { useRef, useState } from "react";
import { Loader2, Mic, ShieldCheck } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { createRecognition, sttSupported } from "@/lib/speech";
import { matchTrade, type VoiceMatch } from "@/lib/voiceIntents";

/**
 * Speak your request instead of typing it.
 *
 * A household services app that needs a keyboard and a confident typist excludes
 * exactly the people it is meant to serve, so the description field has a voice
 * path. Recognition runs entirely in the browser through the Web Speech API: no
 * audio is uploaded, and only the derived text is ever stored on the booking.
 *
 * The transcript is matched to a trade (see lib/voiceIntents) and the caller can
 * pre-select it. On no match the raw text is kept as the description and the
 * human chooses the category — the platform never invents an intent out of a
 * half-heard sentence.
 */
export default function VoiceRequest({
  onTranscript,
  onMatch,
}: {
  /** Receives the final transcript, for the description field. */
  onTranscript: (text: string) => void;
  /** Receives the guess, so the caller can pre-select a trade. */
  onMatch?: (match: VoiceMatch) => void;
}) {
  const { t, speechLang } = useLang();
  const [listening, setListening] = useState(false);
  // createRecognition starts listening and hands back an abort handle; keep it
  // so pressing the button a second time actually stops the microphone rather
  // than only changing the label.
  const handleRef = useRef<{ stop: () => void } | null>(null);

  // No microphone support means no button at all. A dead control is worse than
  // an honest absence.
  if (!sttSupported()) return null;

  function toggle() {
    if (listening) {
      handleRef.current?.stop();
      setListening(false);
      return;
    }
    setListening(true);
    handleRef.current = createRecognition(
      speechLang,
      (text: string) => {
        const transcript = text.trim();
        setListening(false);
        if (!transcript) return;
        onTranscript(transcript);
        const guess = matchTrade(transcript);
        if (guess) onMatch?.(guess);
      },
      () => setListening(false),
      () => setListening(false),
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        className={`flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold transition active:scale-[0.98] ${
          listening
            ? "border-rose-300 bg-rose-50 text-rose-700"
            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
        }`}
      >
        {listening ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Mic className="size-4" />
        )}
        {listening ? t("vr_listening") : t("vr_tap")}
      </button>
      <p className="mt-1.5 flex items-start gap-1.5 text-[10px] leading-relaxed text-slate-400">
        <ShieldCheck className="mt-0.5 size-3 shrink-0" />
        {t("vr_privacy")}
      </p>
    </div>
  );
}
