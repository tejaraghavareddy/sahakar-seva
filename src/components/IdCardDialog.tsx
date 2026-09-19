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
import { getTrade } from "@/lib/trades";
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
      <DialogContent className="max-w-sm gap-0 overflow-hidden p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>{t("card_id")}</DialogTitle>
          <DialogDescription>{t("cred_verify_note")}</DialogDescription>
        </DialogHeader>
        <div className="tl-card-id px-5 py-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/90">
              sahakar seva
            </span>
            <ShieldCheck className="size-4 text-white/90" />
          </div>
        </div>
        <div className="flex flex-col items-center gap-4 p-6">
          <div className="flex w-full items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-sm border border-border bg-secondary">
              {TradeIcon && <TradeIcon className="size-5 text-forest" />}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{artisan.fullName}</p>
              <p className="truncate text-xs text-muted-foreground">
                {artisan.district}, {artisan.state}
              </p>
            </div>
          </div>
          <div className="w-full border-y border-dashed border-border py-4 text-center">
            <div className="inline-flex rounded-sm border border-border bg-card p-2">
              <QRCodeSVG value={verifyUrl} size={112} />
            </div>
            <p className="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">
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
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
