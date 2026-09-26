import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Loader2, MessageSquareQuote } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useLang } from "@/lib/i18n";
import { Panel, TlButton } from "@/components/terminal";
import RatingStars from "@/components/RatingStars";

/** The tags a reviewer can attach. Kept in step with REVIEW_TAGS server-side. */
const TAGS = ["on_time", "clean_work", "fair_price", "polite"] as const;

/**
 * Write a review for a completed booking.
 *
 * The form is deliberately placed on the booking rather than on a worker profile:
 * the review is a statement about one piece of work, and tying it to the booking
 * is what makes the score worth anything. It is also why the server refuses any
 * review whose booking is not `completed`.
 */
export default function ReviewForm({
  bookingId,
  onDone,
}: {
  bookingId: Id<"bookings">;
  onDone?: () => void;
}) {
  const { t } = useLang();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const submit = useMutation(api.reviews.submit);

  async function send() {
    if (rating < 1) return;
    setBusy(true);
    try {
      await submit({
        bookingId,
        rating,
        comment: comment || undefined,
        tags: tags.length ? tags : undefined,
      });
      onDone?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title={t("rv_write")} bodyClassName="p-4">
      <RatingStars value={rating} onChange={setRating} size="lg" />
      <p className="mt-1.5 text-[11px] text-slate-500">{t("rv_stars")}</p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {TAGS.map((tag) => {
          const on = tags.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() =>
                setTags((prev) =>
                  on ? prev.filter((x) => x !== tag) : [...prev, tag],
                )
              }
              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                on
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {t(`rv_tag_${tag}`)}
            </button>
          );
        })}
      </div>

      <textarea
        className="mt-3 min-h-[64px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        placeholder={t("rv_comment_ph")}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />

      <TlButton
        className="mt-3 w-full"
        onClick={send}
        disabled={busy || rating < 1}
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : null}
        {t("rv_submit")}
      </TlButton>
    </Panel>
  );
}

/** Public review feed for one worker. Reads well on a profile or catalog card. */
export function ReviewFeed({ artisanId }: { artisanId: Id<"artisans"> }) {
  const { t } = useLang();
  const reviews = useQuery(api.reviews.forArtisan, { artisanId });

  if (!reviews || reviews.length === 0) {
    return (
      <p className="py-4 text-center text-xs text-slate-500">{t("rv_none")}</p>
    );
  }

  return (
    <ul className="space-y-3">
      {reviews.map((r) => (
        <li key={r._id} className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex items-center justify-between gap-3">
            <RatingStars value={r.rating} size="sm" />
            <span className="text-[10px] font-semibold text-slate-400">
              {r.reviewerName} ·{" "}
              {new Date(r.createdAt).toLocaleDateString("en-IN", {
                dateStyle: "medium",
              })}
            </span>
          </div>
          {r.comment && (
            <p className="mt-1.5 flex gap-1.5 text-xs leading-relaxed text-slate-700">
              <MessageSquareQuote className="mt-0.5 size-3.5 shrink-0 text-slate-300" />
              {r.comment}
            </p>
          )}
          {r.tags && r.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {r.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700"
                >
                  {t(`rv_tag_${tag}`)}
                </span>
              ))}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
