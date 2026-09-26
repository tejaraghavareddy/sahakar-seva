/**
 * Which sign-in screen belongs to which part of the app.
 *
 * The product has two distinct portals with their own themed sign-in (a
 * customer books work, a worker does it), plus the admin and platform
 * consoles. Route guards and the sign-out control both need to know which one
 * a given path belongs to. Keeping the mapping in one place stops them from
 * drifting — the bug this replaced was the header sending a worker who had just
 * signed out to the customer services page.
 */

/** Paths owned by the worker portal: the job hub and the credential wizard. */
const WORKER_PATHS = ["/dashboard", "/onboarding", "/welfare"] as const;

/** Paths owned by the customer portal: browsing, booking and tracking. */
const CUSTOMER_PATHS = ["/services", "/book", "/bookings"] as const;

function matches(pathname: string, roots: readonly string[]): boolean {
  return roots.some(
    (root) => pathname === root || pathname.startsWith(`${root}/`),
  );
}

/**
 * The sign-in path for the portal that owns `pathname`.
 *
 * `/admin` and `/super` deliberately fall through to the generic `/auth`: their
 * consoles open their own clearance modal, and the generic screen is the one
 * that carries the demo-officer and demo-super-admin shortcuts.
 */
export function signInPathFor(pathname: string): string {
  if (matches(pathname, WORKER_PATHS)) return "/login/worker";
  if (matches(pathname, CUSTOMER_PATHS)) return "/login/customer";
  return "/auth";
}

/** True when the path belongs to the worker portal. */
export function isWorkerPath(pathname: string): boolean {
  return matches(pathname, WORKER_PATHS);
}
