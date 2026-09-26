import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import AdminLoginModal from "@/components/AdminLoginModal";

/**
 * Platform-tier gate. Mirrors RequireAdmin one level up: only super admins
 * pass. Everyone else gets the polite notice plus the sign-in options (the
 * demo super-admin button included).
 */
export default function RequireSuperAdmin({ children }: { children: ReactNode }) {
  const amSuper = useQuery(api.superAdmin.amSuperAdmin, {}) === true;
  const [showLogin, setShowLogin] = useState(false);

  if (amSuper) {
    return (
      <>
        {children}
        <AdminLoginModal
          open={showLogin}
          onClose={() => setShowLogin(false)}
          onSuccess={() => setShowLogin(false)}
        />
      </>
    );
  }

  return (
    <>
      <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-50 via-emerald-50/20 to-slate-100 font-sans text-slate-900 antialiased">
        <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-4 py-16 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50">
            <ShieldAlert className="size-7 text-amber-700" />
          </span>
          <h1 className="mt-5 text-2xl font-black tracking-tight text-slate-900">
            Platform Governance Area
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            This console manages every federation on the platform and the
            officers who run them. Access is restricted to super admins.
            Federation officers should use their own console instead.
          </p>
          <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              to="/admin"
              className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-md transition hover:bg-emerald-700 active:scale-95"
            >
              <ArrowLeft className="size-4" />
              Federation console
            </Link>
            <button
              type="button"
              onClick={() => setShowLogin(true)}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 active:scale-95"
            >
              Super admin sign-in
            </button>
          </div>
        </main>
      </div>
      <AdminLoginModal
        open={showLogin}
        onClose={() => setShowLogin(false)}
        onSuccess={() => {
          setShowLogin(false);
          window.location.reload();
        }}
      />
    </>
  );
}
