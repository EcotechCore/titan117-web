import { describe, expect, it } from "vitest";

import {
  REMOTE_COMMAND_TYPES,
  generateDeviceKey,
  importPrivateKey,
  open,
  pairingCode,
  parseCommand,
  parseCommandEnvelope,
  publicKeyOf,
  safeFileName,
  seal,
  type SealHeader,
} from "./remote.js";

/**
 * Test vectors shared with the desktop repo (test/remote-protocol.test.ts has
 * the same numbers): fixed keys and a fixed random part must give the same
 * sealed bytes on both sides.
 */
const VECTOR = {
  laptopPublic: "pOCSkrZRwni5dyxWn1-puxPZBrRqtoyd-dwrRAn4ogk",
  phonePublic: "zo060cy2M-x7cMF4FKXHbs0CloUFDTRHRboFhw5YfVk",
  code: "8YN-2Y5",
  sealedSha256: "ed76ed31a0962b5fae44833fd54b80a133abb9f62c686e9cb533168e61c95132",
};
const fill = (n: number) => new Uint8Array(32).fill(n);

async function sha256Hex(text: string) {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  return [...d].map((b) => b.toString(16).padStart(2, "0")).join("");
}

describe("sealing", () => {
  it("matches the shared test vector", async () => {
    const laptop = await importPrivateKey(fill(1));
    const phone = await importPrivateKey(fill(2));
    expect(await publicKeyOf(fill(1))).toBe(VECTOR.laptopPublic);
    expect(await publicKeyOf(fill(2))).toBe(VECTOR.phonePublic);
    expect(await pairingCode(VECTOR.laptopPublic, VECTOR.phonePublic)).toBe(VECTOR.code);

    const header: SealHeader = { v: 1, from: VECTOR.phonePublic, to: VECTOR.laptopPublic, kind: "command", id: "vector-1" };
    const payload = { v: 1, id: "c1", sentAt: 1, expiresAt: 2, command: { type: "task.list" } };
    const sealed = await seal(header, payload, phone, {
      ephemeral: await importPrivateKey(fill(3)),
      ephemeralPublic: await publicKeyOf(fill(3)),
      iv: new Uint8Array(12).fill(4),
    });
    expect(await sha256Hex(sealed)).toBe(VECTOR.sealedSha256);
    expect(await open(header, sealed, laptop)).toEqual(payload);
  });

  it("opens only for the recipient, from the named sender, with the same header", async () => {
    const a = await generateDeviceKey(false);
    const b = await generateDeviceKey(false);
    const c = await generateDeviceKey(false);
    const header: SealHeader = { v: 1, from: a.publicKey, to: b.publicKey, kind: "event", id: "m1" };
    const sealed = await seal(header, { hello: "world" }, a.privateKey);

    expect(await open(header, sealed, b.privateKey)).toEqual({ hello: "world" });
    // Not the recipient.
    expect(await open(header, sealed, c.privateKey)).toBeNull();
    // Claims another sender (a server swapping in its own key).
    expect(await open({ ...header, from: c.publicKey }, sealed, b.privateKey)).toBeNull();
    // Routing fields changed.
    expect(await open({ ...header, id: "m2" }, sealed, b.privateKey)).toBeNull();
    expect(await open({ ...header, kind: "command" }, sealed, b.privateKey)).toBeNull();
    // A flipped bit.
    const flipped = sealed.slice(0, 100) + (sealed[100] === "A" ? "B" : "A") + sealed.slice(101);
    expect(await open(header, flipped, b.privateKey)).toBeNull();
  });

  it("hides the content's length to the nearest kilobyte and never shows it in clear", async () => {
    const a = await generateDeviceKey(false);
    const b = await generateDeviceKey(false);
    const header: SealHeader = { v: 1, from: a.publicKey, to: b.publicKey, kind: "command", id: "m1" };
    const short = await seal(header, { text: "hi" }, a.privateKey);
    const longer = await seal(header, { text: "write the quarterly invoice summary" }, a.privateKey);
    expect(short.length).toBe(longer.length);
    expect(atob(longer.replace(/-/g, "+").replace(/_/g, "/"))).not.toContain("invoice");
  });

  it("makes browser keys that can't be exported", async () => {
    const { privateKey } = await generateDeviceKey(false);
    expect(privateKey.extractable).toBe(false);
    await expect(crypto.subtle.exportKey("pkcs8", privateKey)).rejects.toThrow();
  });
});

describe("commands", () => {
  it("accepts every known type and refuses others", () => {
    const samples: Record<(typeof REMOTE_COMMAND_TYPES)[number], unknown> = {
      "task.start": { type: "task.start", text: "Summarise my inbox" },
      "task.list": { type: "task.list" },
      "task.get": { type: "task.get", taskId: "t_1" },
      "approval.answer": { type: "approval.answer", approvalId: "a_1", answer: "approve" },
      "task.cancel": { type: "task.cancel", taskId: "t_1" },
      "file.add": { type: "file.add", name: "notes.txt", data: "aGk=" },
    };
    for (const type of REMOTE_COMMAND_TYPES) expect(parseCommand(samples[type])).not.toBeNull();
    expect(parseCommand({ type: "shell.run", command: "dir" })).toBeNull();
    expect(parseCommand({ type: "approval.answer", approvalId: "a_1", answer: "always" })).toBeNull();
    expect(parseCommand({ type: "task.get", taskId: "../x" })).toBeNull();
    expect(parseCommand({ type: "task.start", text: "" })).toBeNull();
  });

  it("refuses expired envelopes and other protocol versions", () => {
    const command = { type: "task.list" };
    expect(parseCommandEnvelope({ v: 1, id: "c1", sentAt: 1000, expiresAt: 5000, command }, 2000)).not.toBeNull();
    expect(parseCommandEnvelope({ v: 1, id: "c1", sentAt: 1000, expiresAt: 5000, command }, 6000)).toBeNull();
    expect(parseCommandEnvelope({ v: 2, id: "c1", sentAt: 1000, expiresAt: 5000, command }, 2000)).toBeNull();
    expect(parseCommandEnvelope({ v: 1, id: "c1", sentAt: 0, expiresAt: 9e12, command }, 2000)).toBeNull();
  });

  it("keeps a sent file inside its folder", () => {
    expect(safeFileName("../../Windows/system.ini")).toBe("....Windowssystem.ini".replace(/^\.+/, ""));
    expect(safeFileName("C:\\x\\y.txt")).toBe("Cxy.txt");
    expect(safeFileName("...")).toBeNull();
    expect(parseCommand({ type: "file.add", name: "a.txt", data: "not base64!" })).toBeNull();
  });
});
