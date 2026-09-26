import { getAuthUserId } from "@convex-dev/auth/server";
import { QueryCtx, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";

/**
 * Who counts as a federation admin.
 *
 * This used to be copy-pasted into ten function modules, which is the worst
 * possible home for an authorisation check: change the owner email in one file
 * and nine others quietly disagree, and nothing in the type system or the test
 * suite notices. It lives here, once, so the rule is readable in one place and
 * every caller provably shares it.
 *
 * Three ways in, in priority order:
 *  1. the federation owner email (below),
 *  2. a demo address, which can be deleted from this one list to revoke it,
 *  3. an `admin` role on the user record, which is how a real officer is
 *     granted access in the first place.
 */

/** Federation owner — granted admin role on first verification. */
export const OWNER_EMAIL = "teja200822@gmail.com";

/**
 * DEMO ADMIN — exists only for demo/testing and can be removed at any time by
 * deleting the entry below. No other module needs to know it exists.
 */
export const DEMO_ADMIN_EMAILS = ["demo.admin@sahakar.demo"];

/** Throw unless there is a signed-in caller. Returns their user id. */
export async function requireUser(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("Not authenticated");
  return userId;
}

/** True when this user id belongs to a federation officer. */
export async function isAdminUser(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<boolean> {
  const user = await ctx.db.get(userId);
  if (!user) return false;
  if (user.email === OWNER_EMAIL) return true;
  if (DEMO_ADMIN_EMAILS.includes(user.email ?? "")) return true;
  return user.role === "admin";
}

/** Throw unless the caller is a federation officer. */
export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const userId = await requireUser(ctx);
  if (!(await isAdminUser(ctx, userId))) throw new Error("Forbidden");
  return userId;
}

/**
 * Promote the owner email to admin role. Called opportunistically after
 * sign-in gated mutations; harmless no-op for everyone else.
 */
export async function ensureOwnerRole(
  ctx: MutationCtx,
  userId: Id<"users">,
) {
  const user = await ctx.db.get(userId);
  if (!user || user.email !== OWNER_EMAIL) return;
  if (user.role === "admin") return;
  await ctx.db.patch(userId, { role: "admin" });
}
