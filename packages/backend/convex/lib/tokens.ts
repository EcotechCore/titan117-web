/**
 * Random tokens, hashes and the lease signature, with Web Crypto only (the
 * Convex runtime has no Node crypto). Random values are made in actions and
 * HTTP actions, never in queries or mutations, whose randomness is seeded.
 */
import type { LeasePayload } from "@titan117/shared";

const enc = new TextEncoder();

export function base64url(bytes: Uint8Array) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64(b64: string) {
  const bin = atob(b64.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function randomToken(prefix = "") {
  return prefix + base64url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function sha256(text: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(text)));
}

export async function sha256Hex(text: string) {
  return [...(await sha256(text))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** PKCE (RFC 7636, S256): the challenge the app sent is base64url(sha256(verifier)). */
export async function pkceChallenge(verifier: string) {
  return base64url(await sha256(verifier));
}

/** Device tokens start with this, so the proxy can tell them from web sign-in tokens. */
export const DEVICE_TOKEN_PREFIX = "t117d_";

/**
 * Signs a lease with ECDSA P-256 / SHA-256. The private key (PKCS #8,
 * base64) lives only in the Convex environment as LEASE_PRIVATE_KEY; its
 * public half is built into the desktop app. Format: payload.signature, both
 * base64url, the signature in IEEE P1363 form (r and s, 64 bytes).
 */
export async function signLease(payload: LeasePayload) {
  const pkcs8 = process.env.LEASE_PRIVATE_KEY;
  if (!pkcs8) throw new Error("LEASE_PRIVATE_KEY is not set in the Convex environment");
  const key = await crypto.subtle.importKey("pkcs8", fromBase64(pkcs8), { name: "ECDSA", namedCurve: "P-256" }, false, [
    "sign",
  ]);
  const body = base64url(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(body));
  return `${body}.${base64url(new Uint8Array(sig))}`;
}
