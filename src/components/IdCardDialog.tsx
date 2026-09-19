import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MonoBadge } from "@/components/terminal";
import { useLang } from "@/lib/i18n";
import { getTrade, COLOR_SOFT } from "@/lib/trades";
import type { Doc } from "@/convex/_generated/dataModel";
import { IdCard, ShieldCheck } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import type { ReactNode } from "react";

export type ArtisanDoc = Doc<"artisans">;

export function IdCardDialog({
  artisan,
  children,
}: {
  artisan: ArtisanDoc;
  children?: ReactNode;
}) {
  const { t } = useLang();
  const trade = getTrade(artisan.trade);
  const TradeIcon = trade?.icon;
  const verifyUrl = `https://sahakar-seva.app/verify/${artisan.credentialId ?? ""}`;

  return (
    <Dialog>
      <DialogTrigger asChild>
        {children ?? (
          <Button variant="outline" size="sm">
            <IdCard className="size-4" />
            {t("card_show")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-sm gap-0 overflow-hidden rounded-3xl p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>{t("card_id")}</DialogTitle>
          <DialogDescription>{t("cred_verify_note")}</DialogDescription>
        </DialogHeader>
        <div className="tl-card-id px-5 py-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/90">
              Sahakar Seva
            </span>
            <ShieldCheck className="size-4 text-white/90" />
          </div>
        </div>
        <div className="flex flex-col items-center gap-4 p-6">
          <div className="flex w-full items-center gap-3">
            <div
              className={`flex size-11 shrink-0 items-center justify-center rounded-xl border ${
                COLOR_SOFT[trade?.color ?? "ok"]
              }`}
            >
              {TradeIcon && <TradeIcon className="size-5" />}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900">
                {artisan.fullName}
              </p>
              <p className="truncate text-xs text-slate-500">
                {artisan.district}, {artisan.state}
              </p>
            </div>
          </div>
          <div className="w-full border-y border-dashed border-slate-200 py-4 text-center">
            <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-2 shadow-xs">
              <QRCodeSVG value={verifyUrl} size={112} />
            </div>
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              {t("qr_label")}
            </p>
          </div>
          <div className="w-full space-y-1.5 text-xs">
            <Row label={t("cred_id")} value={artisan.credentialId ?? "—"} />
            <Row label={t("f_trade")} value={artisan.trade} />
            <Row label={t("cred_score")} value={`${artisan.quizScore ?? 0}%`} />
            <Row label={t("kyc_masked")} value={`XXXX XXXX ${artisan.idLast4}`} />
            <Row label={t("society_row")} value={artisan.societyId} />
          </div>
          <MonoBadge tone="ok">{t("readonly_note")}</MonoBadge>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}
