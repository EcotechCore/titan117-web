/**
 * A fresh second factor, checked where it can be (decisions §64.4).
 *
 * Convex leaves Clerk's `fva` claim out of `getUserIdentity()` (it changes
 * every minute and would bust the query cache; docs.convex.dev/auth/
 * functions-auth, read 25 Nov 2026), so a query or mutation can't see a
 * second factor. Instead the page sends the user's Clerk session token to an
 * action, which verifies it with Clerk's own library and reads `fva`:
 * minutes since the first and the second factor were verified, -1 for a
 * second factor never verified (clerk.com/docs/guides/sessions/session-tokens).
 *
 * Until the owner moves to Clerk Pro (decisions §37) no account can have a
 * second factor, so for local development only REMOTE_TWO_FACTOR (remote
 * control) or PORTAL_TWO_FACTOR (staff, decisions §65.8) set to exactly
 * `off-until-clerk-pro` skips the check. Anything else keeps it on.
 */
import { SECOND_FACTOR_MAX_MINUTES } from "@titan117/shared";
import { verifyToken } from "@clerk/backend";

/** Minutes since the second factor, from a verified token's claims; null when there is none. */
export function secondFactorAge(claims: Record<string, unknown>): number | null {
  const fva = claims.fva;
  if (!Array.isArray(fva) || typeof fva[1] !== "number" || fva[1] < 0) return null;
  return fva[1];
}

export type TwoFactorSwitch = "REMOTE_TWO_FACTOR" | "PORTAL_TWO_FACTOR";

export function twoFactorSwitchedOff(name: TwoFactorSwitch = "REMOTE_TWO_FACTOR") {
  return process.env[name] === "off-until-clerk-pro";
}

/**
 * True when `sessionToken` is a valid Clerk session token of `clerkId` whose
 * second factor was verified at most ten minutes ago. Never throws.
 */
export async function hasFreshSecondFactor(
  sessionToken: string,
  clerkId: string,
  switchName: TwoFactorSwitch = "REMOTE_TWO_FACTOR",
): Promise<boolean> {
  if (twoFactorSwitchedOff(switchName)) return true;
  if (typeof sessionToken !== "string" || sessionToken.length > 8192 || sessionToken.split(".").length !== 3) return false;
  // Cheap checks before any network call: a session token names its key and belongs to this user.
  try {
    const [head, body] = sessionToken
      .split(".")
      .slice(0, 2)
      .map((p) => JSON.parse(atob(p.replace(/-/g, "+").replace(/_/g, "/"))) as Record<string, unknown>);
    if (typeof head?.kid !== "string" || body?.sub !== clerkId) return false;
  } catch {
    return false;
  }
  const secretKey = process.env.CLERK_SECRET_KEY;
  const jwtKey = process.env.CLERK_JWT_KEY;
  if (!secretKey && !jwtKey) return false;
  try {
    const claims = (await verifyToken(sessionToken, {
      ...(jwtKey ? { jwtKey } : {}),
      ...(secretKey ? { secretKey } : {}),
    })) as Record<string, unknown>;
    if (claims.sub !== clerkId) return false;
    const age = secondFactorAge(claims);
    return age !== null && age <= SECOND_FACTOR_MAX_MINUTES;
  } catch {
    return false;
  }
}
