import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

/** Comma-separated allowlist of emails permitted into the admin section. */
function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Verified email addresses on the current Clerk user.
 *
 * `currentUser()` returns null when signed out — the middleware already forces
 * a sign-in before any `/admin` route renders, but server actions can be
 * invoked directly, so callers must handle the null/empty case.
 */
function verifiedEmails(user: NonNullable<Awaited<ReturnType<typeof currentUser>>>): string[] {
  return user.emailAddresses
    .filter((e) => e.verification?.status === "verified")
    .map((e) => e.emailAddress.toLowerCase());
}

/**
 * Single source of truth for "is this caller an authorized admin". Used by the
 * admin layout (server component) and every mutating server action.
 *
 * Returns the Clerk user when allowed. On failure it `redirect()`s to
 * `/sign-in` — which both serves the layout (a render redirect) and aborts a
 * server action (the thrown redirect propagates as an error to the client).
 */
export async function requireAdmin() {
  const user = await currentUser();
  const allowed = adminEmails();

  if (!user) redirect("/sign-in");

  // No allowlist configured → fail closed: a signed-in user alone is not enough
  // to reach admin, since email-OTP / Google sign-in is open to anyone.
  const emails = verifiedEmails(user);
  if (allowed.length === 0 || !emails.some((e) => allowed.includes(e))) {
    redirect("/sign-in");
  }

  return user;
}
