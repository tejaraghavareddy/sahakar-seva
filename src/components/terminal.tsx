import { useLang, LANGS, type LangCode } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Check, ChevronDown } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";

/* ---------- Status dot ---------- */

export function StatusDot({
  tone = "ok",
  blink = false,
}: {
  tone?: "ok" | "warn" | "idle";
  blink?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-2 rounded-full",
        tone === "ok" && "bg-emerald-600",
        tone === "warn" && "bg-amber-500",
        tone === "idle" && "bg-slate-300",
        blink && "tl-blink",
      )}
    />
  );
}

/* ---------- Badge ---------- */

export function MonoBadge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "ok" | "warn" | "saffron" | "forest";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        tone === "neutral" &&
          "border-slate-200 bg-slate-50 text-slate-600",
        tone === "ok" && "border-emerald-200 bg-emerald-50 text-emerald-800",
        tone === "warn" && "border-amber-200 bg-amber-50 text-amber-800",
        tone === "saffron" && "border-orange-200 bg-orange-50 text-orange-800",
        tone === "forest" && "border-emerald-200 bg-emerald-50 text-emerald-900",
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ---------- Panel (white civic card) ---------- */

export function Panel({
  title,
  tag,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  tag?: string;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-slate-200 bg-white shadow-xs",
        className,
      )}
    >
      {(title || tag) && (
        <header className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
          <span className="tl-label">{title}</span>
          {tag && (
            <span className="text-[10px] font-semibold text-slate-400">
              {tag}
            </span>
          )}
        </header>
      )}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

/* ---------- Section header ---------- */

export function SectionHeader({
  index,
  title,
  sub,
}: {
  index?: string;
  title: string;
  sub?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        {index && (
          <span className="text-xs font-bold text-emerald-700">{index}</span>
        )}
        <h2 className="text-base sm:text-lg font-bold tracking-tight text-slate-900">
          {title}
        </h2>
      </div>
      {sub && <p className="text-sm text-slate-500">{sub}</p>}
    </div>
  );
}

/* ---------- Button ---------- */

interface TlButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "outline" | "ghost" | "ok" | "saffron";
}

export function TlButton({
  variant = "primary",
  className,
  children,
  ...props
}: TlButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition active:scale-95 disabled:pointer-events-none disabled:opacity-50",
        variant === "primary" &&
          "bg-emerald-600 text-white hover:bg-emerald-700",
        variant === "ok" && "bg-emerald-600 text-white hover:bg-emerald-700",
        variant === "saffron" && "tl-btn-saffron",
        variant === "outline" &&
          "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
        variant === "ghost" &&
          "bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-900",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/* ---------- Language picker ---------- */

export function LanguagePicker({ compact = false }: { compact?: boolean }) {
  const { lang, setLang } = useLang();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const current = LANGS.find((l) => l.code === lang) ?? LANGS[0];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {compact ? "" : "Lang"}
        </span>
        <span>{current.label}</span>
        <ChevronDown className="size-3 text-slate-400" />
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute right-0 z-50 mt-1.5 w-44 overflow-hidden rounded-2xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          {LANGS.map((l) => (
            <button
              key={l.code}
              type="button"
              role="option"
              aria-selected={l.code === lang}
              onClick={() => {
                setLang(l.code as LangCode);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center justify-between px-3.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-emerald-50",
                l.code === lang && "font-bold text-emerald-800",
              )}
            >
              <span>{l.label}</span>
              {l.code === lang && <Check className="size-3" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
