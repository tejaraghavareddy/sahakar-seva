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

/* ---------- Status dot (green/amber only) ---------- */

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
        tone === "ok" && "bg-ok",
        tone === "warn" && "bg-warn",
        tone === "idle" && "bg-border",
        blink && "tl-blink",
      )}
    />
  );
}

/* ---------- Mono badge ---------- */

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
        "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        tone === "neutral" && "border-border bg-secondary text-muted-foreground",
        tone === "ok" && "border-ok/30 bg-ok-soft text-ok",
        tone === "warn" && "border-warn/30 bg-warn-soft text-warn",
        tone === "saffron" && "border-saffron/30 bg-saffron-soft text-saffron",
        tone === "forest" && "border-forest/25 bg-forest-soft text-forest",
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ---------- Terminal panel ---------- */

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
    <section className={cn("tl-panel overflow-hidden", className)}>
      {(title || tag) && (
        <header className="flex items-center justify-between border-b border-border bg-secondary/50 px-4 py-2.5">
          <span className="tl-label">{title}</span>
          {tag && (
            <span className="text-[10px] text-muted-foreground">{tag}</span>
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
          <span className="text-[11px] font-bold text-saffron">{index}</span>
        )}
        <h2 className="text-base font-bold tracking-tight text-foreground">
          {title}
        </h2>
      </div>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

/* ---------- Terminal button ---------- */

interface TlButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "outline" | "ghost" | "ok";
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
        "inline-flex h-10 items-center justify-center gap-2 rounded-sm border px-4 text-[13px] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50",
        variant === "primary" &&
          "border-foreground bg-foreground text-background hover:bg-foreground/90",
        variant === "ok" &&
          "border-ok bg-ok text-white hover:bg-ok/90",
        variant === "outline" &&
          "border-input bg-card text-foreground hover:bg-secondary",
        variant === "ghost" &&
          "border-transparent bg-transparent text-muted-foreground hover:bg-secondary hover:text-foreground",
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
        className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-input bg-card px-2.5 text-xs font-semibold text-foreground hover:bg-secondary"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="text-[10px] font-bold text-muted-foreground">
          {compact ? "" : "lang"}
        </span>
        <span>{current.label}</span>
        <ChevronDown className="size-3 text-muted-foreground" />
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute right-0 z-50 mt-1 w-40 overflow-hidden rounded-sm border border-border bg-popover py-1 shadow-lg"
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
                "flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-secondary",
                l.code === lang && "text-ok",
              )}
            >
              <span className={cn(l.code === lang && "font-bold")}>
                {l.label}
              </span>
              {l.code === lang && <Check className="size-3" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
