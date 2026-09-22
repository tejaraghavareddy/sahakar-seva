import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { useSession } from "@/App";
import { ShieldAlert } from "lucide-react";
import AdminLoginModal from "@/components/AdminLoginModal";
import { useAuth } from "@/hooks/use-auth";

/**
 * Federation-officer gate. Non-admins see a polite notice explaining that
 * only verified cooperative board officers have clearance, with a direct
 * button back to the customer view and an officer sign-in option.
 */
export default function RequireAdmin({ children }: { children: ReactNode }) {
  const { session, isResolving } = useSession();
  const { isAuthenticated, isLoading } = useAuth();
  const [showLogin, setShowLogin] = useState(false);

  if (isResolving || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="animate-pulse text-sm font-semibold text-slate-400">
          Verifying clearance…
        </div>
      </div>
    );
  }

  if (session?.role === "admin") {
    return (
      <>
        {children}
        <AdminLoginModal open={showLogin} onClose={() => setShowLogin(false)} onSuccess={() => setShowLogin(false)} />
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
            Restricted Governance Area
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            This section of Sahakar Seva is reserved for verified cooperative
            board officers and district labor officers. Your current account
            does not hold Federation Administrative clearance. If you believe
            you should have access, please contact your district federation
            board.
          </p>
          <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              to="/services"
              className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-md transition hover:bg-emerald-700 active:scale-95"
            >
              Back to customer view
            </Link>
            <button
              type="button"
              onClick={() => setShowLogin(true)}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 active:scale-95"
            >
              Officer sign-in
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
