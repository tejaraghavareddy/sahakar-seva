/**
 * Web Speech helpers for the voice-first accessibility layer.
 * - speak(): Text-to-Speech readout for semi-literate artisans.
 * - createRecognition(): Speech-to-Text for voice answers in regional languages.
 * Both degrade silently when the browser lacks support.
 */

export function ttsSupported(): boolean {
  try {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  } catch {
    return false;
  }
}

export function speak(text: string, lang = "en-IN"): void {
  if (!ttsSupported() || !text) return;
  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang;
    utter.rate = 0.92;
    utter.pitch = 1;
    const base = lang.split("-")[0];
    const voice = synth
      .getVoices()
      .find((v) => v.lang === lang || v.lang.replace("_", "-") === lang)
      ?? synth.getVoices().find((v) => v.lang.toLowerCase().startsWith(base));
    if (voice) utter.voice = voice;
    synth.speak(utter);
  } catch {
    // speech is best-effort accessibility; never block the UI
  }
}

export function stopSpeaking(): void {
  try {
    if (ttsSupported()) window.speechSynthesis.cancel();
  } catch {
    // ignore
  }
}

/* ---------- Speech recognition ---------- */

interface RecognitionHandle {
  stop: () => void;
}

type ResultCb = (transcript: string) => void;

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  0: SpeechRecognitionAlternativeLike;
  isFinal?: boolean;
  length: number;
}

interface SpeechRecognitionEventLike {
  results: { 0: SpeechRecognitionResultLike; length: number };
}

interface SpeechRecognitionErrorEventLike {
  error?: string;
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  try {
    const w = window as unknown as {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
  } catch {
    return null;
  }
}

export function sttSupported(): boolean {
  return getRecognitionCtor() !== null;
}

/** Starts one-shot recognition; returns a handle to abort early. */
export function createRecognition(
  lang: string,
  onResult: ResultCb,
  onEnd?: () => void,
  onError?: (err: string) => void,
): RecognitionHandle | null {
  const Ctor = getRecognitionCtor();
  if (!Ctor) {
    onError?.("unsupported");
    return null;
  }
  try {
    const rec = new Ctor();
    rec.lang = lang;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript ?? "";
      if (transcript) onResult(transcript);
    };
    rec.onerror = (event) => {
      onError?.(event?.error ?? "error");
    };
    rec.onend = () => {
      onEnd?.();
    };
    rec.start();
    return {
      stop: () => {
        try {
          rec.stop();
        } catch {
          // ignore
        }
      },
    };
  } catch {
    onError?.("error");
    return null;
  }
}
