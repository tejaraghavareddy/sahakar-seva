import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";
import { useLang } from "@/lib/i18n";

export function BackToHome({ className = "" }: { className?: string }) {
  const { t } = useLang();
  return (
    <Link
      to="/"
      className={`inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-emerald-700 ${className}`}
    >
      <ArrowLeft className="size-3.5" />
      {t("btn_home")}
    </Link>
  );
}
