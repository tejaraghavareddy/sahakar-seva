import { useAuth } from "@/hooks/use-auth";
import { signInPathFor } from "@/lib/portal";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!isAuthenticated) {
    const returnTo = `${location.pathname}${location.search}`;
    // Send the visitor to the sign-in for the portal they were trying to
    // reach, not always the generic one: a worker who deep-linked to
    // /dashboard should not land on the customer booking screen.
    const signIn = signInPathFor(location.pathname);
    return (
      <Navigate
        to={`${signIn}?returnTo=${encodeURIComponent(returnTo)}`}
        replace
      />
    );
  }

  return children;
}
