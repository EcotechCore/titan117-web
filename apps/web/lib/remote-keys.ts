/**
 * This browser's remote-control key and the laptops it trusts (decisions
 * §64.2, security.md A2). The private key is a non-extractable Web Crypto
 * key kept in IndexedDB: page scripts can use it, nobody can read it out, and
 * it never leaves this browser. Clearing the site's data means pairing again.
 */
import { generateDeviceKey } from "@titan117/shared";

const DB = "titan117-remote";
const VERSION = 1;

export interface DeviceKey {
  privateKey: CryptoKey;
  publicKey: string;
}

export interface TrustedLaptop {
  /** The laptop's current public key, confirmed by pairing or by a key message sealed under the old one. */
  publicKey: string;
  name: string;
  pairedAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("device");
      req.result.createObjectStore("laptops", { keyPath: "publicKey" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(store: string, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = run(t.objectStore(store));
    t.oncomplete = () => resolve(req.result);
    t.onerror = () => reject(t.error);
  });
}

/** Whether this browser can hold a key that can't be read out (Web Crypto X25519). */
export async function browserCanPair(): Promise<boolean> {
  try {
    await crypto.subtle.generateKey({ name: "X25519" }, false, ["deriveBits"]);
    return typeof indexedDB !== "undefined";
  } catch {
    return false;
  }
}

export async function deviceKey(): Promise<DeviceKey | null> {
  return ((await tx("device", "readonly", (s) => s.get("key"))) as DeviceKey | undefined) ?? null;
}

/** Makes this browser's key on first use. */
export async function ensureDeviceKey(): Promise<DeviceKey> {
  const existing = await deviceKey();
  if (existing) return existing;
  const made = await generateDeviceKey(false);
  const key: DeviceKey = { privateKey: made.privateKey, publicKey: made.publicKey };
  await tx("device", "readwrite", (s) => s.put(key, "key"));
  return key;
}

export async function trustedLaptops(): Promise<TrustedLaptop[]> {
  return (await tx("laptops", "readonly", (s) => s.getAll())) as TrustedLaptop[];
}

export async function trustLaptop(laptop: TrustedLaptop): Promise<void> {
  await tx("laptops", "readwrite", (s) => s.put(laptop));
}

/** The laptop rotated its key and told us under the old one. */
export async function replaceLaptopKey(oldKey: string, newKey: string): Promise<void> {
  const all = await trustedLaptops();
  const old = all.find((l) => l.publicKey === oldKey);
  if (!old) return;
  await tx("laptops", "readwrite", (s) => s.delete(oldKey));
  await trustLaptop({ ...old, publicKey: newKey });
}

/** Forget everything: this browser pairs again from scratch. */
export async function forgetAll(): Promise<void> {
  await tx("laptops", "readwrite", (s) => s.clear());
  await tx("device", "readwrite", (s) => s.clear());
}

/** A short name for this browser, shown on the laptop's Allow card. */
export function browserName(): string {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /iPhone|iPad/.test(ua) ? "iPhone" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "Mac" : "this device";
  return `${browser} on ${os}`;
}

export function isPhone(): boolean {
  return /iPhone|iPad|Android/.test(navigator.userAgent);
}

/**
 * The shape Clerk's `useReverification` looks for (clerk.com/docs, reverification):
 * returning it from the wrapped call shows Clerk's own second-factor prompt,
 * then runs the call again.
 */
export function needsSecondFactor() {
  return {
    clerk_error: {
      type: "forbidden",
      reason: "reverification-error",
      metadata: { reverification: { level: "second_factor", afterMinutes: 10 } },
    },
  };
}
