import { Link } from "react-router";
import { useAuth } from "@/hooks/use-auth";
import { useLang } from "@/lib/i18n";
import { LanguagePicker, TlButton } from "@/components/terminal";
import { LogOut, Terminal } from "lucide-react";

export function AppHeader() {
  const { t } = useLang();
  const { user, signOut } = useAuth();

  const links = [
    { to: "/services", label: t("nav_services") },
    { to: "/bookings", label: t("nav_bookings") },
    { to: "/dashboard", label: t("nav_hub") },
    { to: "/admin", label: t("nav_admin") },
  ];

  return (
    <header className="tl-band sticky top-0 z-40">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link to="/" className="flex shrink-0 items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-sm border border-foreground bg-foreground text-xs font-bold text-background">
            &gt;_
          </span>
          <span className="hidden text-sm font-bold tracking-tight sm:inline">
            sahakar-seva
          </span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="rounded-sm px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <LanguagePicker />
          <TlButton variant="ghost" onClick={() => void signOut()}>
            <LogOut className="size-4" />
          </TlButton>
        </div>
      </div>
      {/* mobile nav */}
      <nav className="flex items-center justify-center gap-1 border-t border-border px-2 py-1.5 md:hidden">
        {links.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="rounded-sm px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

export { Terminal as _TerminalIcon };
