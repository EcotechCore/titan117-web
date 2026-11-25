/**
 * Web Push without content (decisions §64.10). A push only wakes the phone's
 * service worker, which shows "Titan117 needs you"; what happened is read
 * from the sealed messages after the user opens the page. So nothing is
 * encrypted for the push service (RFC 8291) and no subscription keys are kept.
 *
 * The request is authorised with VAPID (RFC 8292): a JWT signed with ES256,
 * `aud` the push service's origin, `exp` at most 24 hours ahead, `sub` our
 * contact, sent as `Authorization: vapid t=<jwt>, k=<public key>`; the TTL
 * header is required (RFC 8030 §5.2). The key pair lives only in the Convex
 * environment: VAPID_PRIVATE_KEY (PKCS#8, base64url) and VAPID_PUBLIC_KEY
 * (the uncompressed P-256 point, base64url), made with scripts/vapid-keys.mjs.
 */
import { base64url, fromBase64 } from "./tokens";

/** Push services the browsers use (Chrome and Edge, Firefox, Safari, Windows). Anything else is refused. */
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^web\.push\.apple\.com$/,
  /^[a-z0-9-]+\.notify\.windows\.com$/,
];

export function isPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && endpoint.length <= 1024 && PUSH_HOSTS.some((h) => h.test(url.hostname));
  } catch {
    return false;
  }
}

export function vapidPublicKey(): string | null {
  const key = process.env.VAPID_PUBLIC_KEY ?? "";
  return /^[A-Za-z0-9_-]{87}$/.test(key) ? key : null;
}

async function vapidJwt(audience: string, now: number): Promise<string | null> {
  const pkcs8 = process.env.VAPID_PRIVATE_KEY;
  if (!pkcs8 || !vapidPublicKey()) return null;
  const key = await crypto.subtle.importKey("pkcs8", fromBase64(pkcs8) as BufferSource, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const enc = new TextEncoder();
  const header = base64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = base64url(
    enc.encode(JSON.stringify({ aud: audience, exp: Math.floor(now / 1000) + 12 * 3600, sub: "mailto:security@titan117.com" })),
  );
  // Web Crypto's ECDSA signature is already the raw r‖s form JWS wants.
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(`${header}.${claims}`)));
  return `${header}.${claims}.${base64url(sig)}`;
}

/** Sends one empty push. "gone" means the subscription ended and should be dropped. */
export async function sendPush(endpoint: string, now = Date.now()): Promise<"sent" | "gone" | "failed" | "not-configured"> {
  if (!isPushEndpoint(endpoint)) return "gone";
  const jwt = await vapidJwt(new URL(endpoint).origin, now);
  if (!jwt) return "not-configured";
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { TTL: "86400", Urgency: "high", Authorization: `vapid t=${jwt}, k=${vapidPublicKey()}`, "Content-Length": "0" },
    });
    if (res.status === 404 || res.status === 410) return "gone";
    return res.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}
