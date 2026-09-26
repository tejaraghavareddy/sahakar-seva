import { Star } from "lucide-react";
import { useLang } from "@/lib/i18n";

/**
 * Star rating, read-only or interactive.
 *
 * Ratings only ever describe work that was completed and paid for, so this
 * component deliberately has no concept of a "provisional" score — there is no
 * five-star grey shell waiting for a booking to finish. A half star is shown for
 * the decimal mean; whole stars everywhere else.
 */
export default function RatingStars({
  value,
  count,
  onChange,
  size = "sm",
  className = "",
}: {
  /** 0–5. A fractional value renders a half star. */
  value: number;
  /** Number of ratings behind the average, shown as "4.6 (12)". */
  count?: number;
  /** Provide to make the stars clickable. */
  onChange?: (next: number) => void;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const { t } = useLang();
  const px = size === "lg" ? "size-6" : size === "md" ? "size-4" : "size-3.5";
  const clamped = Math.max(0, Math.min(5, value));

  return (
    <span
      className={`inline-flex items-center gap-1.5 ${className}`}
      role={onChange ? "radiogroup" : "img"}
      aria-label={onChange ? t("rv_stars") : t("rv_avg", { n: clamped.toFixed(1) })}
    >
      <span className="inline-flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => {
          const filled = clamped >= i;
          const half = !filled && clamped >= i - 0.5;
          const Icon = (
            <Star
              className={`${px} ${
                filled
                  ? "fill-amber-400 text-amber-400"
                  : half
                    ? "fill-amber-200 text-amber-400"
                    : "fill-transparent text-slate-300"
              }`}
              aria-hidden="true"
            />
          );
          if (!onChange) {
            return <span key={i}>{Icon}</span>;
          }
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={clamped === i}
              aria-label={`${i}`}
              onClick={() => onChange(i)}
              className="rounded p-0.5 transition hover:scale-110 active:scale-95"
            >
              {Icon}
            </button>
          );
        })}
      </span>
      {count !== undefined && count > 0 && (
        <span className="text-[11px] font-semibold text-slate-500">
          {clamped.toFixed(1)} ({count} {t("rv_count")})
        </span>
      )}
    </span>
  );
}
