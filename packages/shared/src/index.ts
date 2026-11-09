/**
 * @titan117/shared: what the web app, Convex, the desktop engine and the
 * product owner portal agree on (architecture §2). Types and schemas only;
 * no server code and nothing secret, because it ships inside the desktop app.
 *
 * The desktop and portal repos install it at a fixed version (guardrails §10).
 */

/**
 * Version of the command protocol between the web app, Convex and the engine.
 * Every protocol message carries it; an older desktop app shows "please
 * update" instead of failing (guardrails §9, §10). Raise it only for a change
 * older clients can't read.
 */
export const PROTOCOL_VERSION = 1;

/** The error codes a client may see from Convex (guardrails §2). */
export const ERROR_CODES = [
  "UNAUTHENTICATED",
  "PAYMENT_REQUIRED",
  "FORBIDDEN",
  "NOT_FOUND",
  "RATE_LIMITED",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === "string" && (ERROR_CODES as readonly string[]).includes(value);
}
