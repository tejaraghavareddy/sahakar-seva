/**
 * "My work" — a worker publishing the work they actually do.
 *
 * The cooperative covers six standard trades, but a worker's real work often
 * does not stop at those (terrace waterproofing, solar installation, grill
 * fabrication...). From here a worker publishes that work either inside one of
 * the six trades or inside a category they name themselves, and the board
 * approves it before customers can book it.
 */
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useLang } from "@/lib/i18n";
import { TRADES, getTrade } from "@/lib/trades";
import { Panel, TlButton } from "@/components/terminal";
import {
  CheckCircle2,
  Clock,
  Hammer,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  XCircle,
} from "lucide-react";

const EMPTY = {
  name: "",
  description: "",
  category: "",
  ownCategory: "",
  base: "",
  hourly: "0",
  urgent: false,
};

export default function WorkListingsPanel() {
  const { t } = useLang();
  const listings = useQuery(api.customServices.myListings, {});
  const create = useMutation(api.customServices.create);
  const remove = useMutation(api.customServices.remove);

  const [open, setOpen] = useState(false);
  const [ownCategory, setOwnCategory] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const update = <K extends keyof typeof EMPTY>(k: K, v: (typeof EMPTY)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    setError(null);
    const category = ownCategory ? form.ownCategory : form.category;
    if (!form.name.trim() || !form.description.trim() || !category) {
      setError(t("wc_fill_all"));
      return;
    }
    setBusy(true);
    try {
      await create({
        name: form.name,
        description: form.description,
        category,
        isCustomCategory: ownCategory,
        base: Number(form.base) || 0,
        hourly: Number(form.hourly) || 0,
        urgent: form.urgent,
      });
      setForm(EMPTY);
      setOwnCategory(false);
      setOpen(false);
    } catch (e) {
      setError(cleanError(e));
    } finally {
      setBusy(false);
    }
  }

  async function withdraw(id: Parameters<typeof remove>[0]["serviceId"]) {
    setRemoving(id);
    setError(null);
    try {
      await remove({ serviceId: id });
    } catch (e) {
      setError(cleanError(e));
    } finally {
      setRemoving(null);
    }
  }

  const rows = listings ?? [];

  return (
    <Panel
      title={t("wc_title")}
      tag={String(rows.length)}
      bodyClassName="p-4"
    >
      <p className="text-[11px] leading-relaxed text-slate-500">
        {t("wc_sub")}
      </p>

      {error && (
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
          {error}
        </p>
      )}

      {open && (
        <div className="mt-4 space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4">
          <div>
            <span className="tl-label mb-1.5 block">{t("wc_name")}</span>
            <input
              className="tl-input"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder={t("wc_name_ph")}
            />
          </div>

          <div>
            <span className="tl-label mb-1.5 block">{t("wc_desc")}</span>
            <textarea
              className="tl-input min-h-[70px]"
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder={t("wc_desc_ph")}
            />
          </div>

          <div>
            <span className="tl-label mb-1.5 block">{t("wc_category")}</span>
            {ownCategory ? (
              <div className="space-y-2">
                <input
                  className="tl-input"
                  value={form.ownCategory}
                  onChange={(e) => update("ownCategory", e.target.value)}
                  placeholder={t("wc_own_category_ph")}
                />
                <button
                  type="button"
                  onClick={() => {
                    setOwnCategory(false);
                    update("ownCategory", "");
                  }}
                  className="text-[11px] font-bold text-emerald-700 underline underline-offset-2"
                >
                  {t("wc_pick_standard")}
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {TRADES.map((tr) => {
                    const Icon = tr.icon;
                    const active = form.category === tr.id;
                    return (
                      <button
                        key={tr.id}
                        type="button"
                        onClick={() => update("category", tr.id)}
                        className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-[11px] font-semibold capitalize transition ${
                          active
                            ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <Icon className="size-3.5 shrink-0" />
                        {tr.id}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setOwnCategory(true);
                    update("category", "");
                  }}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-dashed border-emerald-300 bg-white px-3 py-2 text-[11px] font-bold text-emerald-700 transition hover:bg-emerald-50"
                >
                  <Sparkles className="size-3.5" />
                  {t("wc_own_category")}
                </button>
              </>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <span className="tl-label mb-1.5 block">{t("wc_base")}</span>
              <input
                className="tl-input"
                inputMode="numeric"
                value={form.base}
                onChange={(e) => update("base", e.target.value)}
                placeholder="499"
              />
            </div>
            <div>
              <span className="tl-label mb-1.5 block">{t("wc_hourly")}</span>
              <input
                className="tl-input"
                inputMode="numeric"
                value={form.hourly}
                onChange={(e) => update("hourly", e.target.value)}
                placeholder="300"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={form.urgent}
              onChange={(e) => update("urgent", e.target.checked)}
              className="size-3.5 accent-emerald-600"
            />
            {t("wc_urgent")}
          </label>

          <div className="flex flex-wrap gap-2">
            <TlButton disabled={busy} onClick={() => void submit()}>
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Hammer className="size-4" />
              )}
              {t("wc_publish")}
            </TlButton>
            <TlButton
              variant="outline"
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
            >
              {t("wc_cancel")}
            </TlButton>
          </div>
        </div>
      )}

      {!open && (
        <TlButton
          className="mt-3"
          variant="outline"
          onClick={() => setOpen(true)}
        >
          <Plus className="size-4" />
          {t("wc_create")}
        </TlButton>
      )}

      <div className="mt-4 space-y-2">
        {listings === undefined && (
          <p className="text-[11px] text-slate-400">Loading…</p>
        )}
        {listings !== undefined && rows.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-[11px] text-slate-500">
            {t("wc_empty")}
          </p>
        )}
        {rows.map((row) => {
          const trade = getTrade(row.trade);
          const TradeIcon = trade?.icon ?? Hammer;
          return (
            <div
              key={row._id}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50">
                <TradeIcon className="size-4 text-emerald-700" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-slate-900">
                  {row.name}
                </p>
                <p className="truncate text-[11px] text-slate-500">
                  {row.isCustomCategory ? "✦ " : ""}
                  {row.category} · ₹{row.base}
                  {row.hourly > 0 ? ` + ₹${row.hourly}/hr` : ""}
                </p>
                {row.status === "rejected" && row.reviewNote && (
                  <p className="mt-0.5 text-[10px] font-semibold text-rose-700">
                    {row.reviewNote}
                  </p>
                )}
              </div>
              <StatusChip status={row.status} t={t} />
              <button
                type="button"
                onClick={() => void withdraw(row._id)}
                disabled={removing === row._id}
                title={t("wc_remove")}
                className="rounded-lg border border-slate-200 p-1.5 text-slate-400 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
              >
                {removing === row._id ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Trash2 className="size-3.5" />
                )}
              </button>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function StatusChip({
  status,
  t,
}: {
  status: string;
  t: (k: string) => string;
}) {
  if (status === "approved") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
        <CheckCircle2 className="size-3" />
        {t("wc_approved")}
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">
        <XCircle className="size-3" />
        {t("wc_rejected")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">
      <Clock className="size-3" />
      {t("wc_pending")}
    </span>
  );
}

/** Convex prefixes its error text; workers should never see the raw envelope. */
function cleanError(e: unknown): string {
  const raw = e instanceof Error ? e.message : "";
  const stripped = raw.replace(/^\[CONVEX[^\]]*\]\s*/, "");
  return stripped || "Please try again.";
}
