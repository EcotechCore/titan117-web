/**
 * A team of three end to end (decisions §68): the desktop app's own team code
 * (`titan117-desktop/src/main/lib/team-sync.ts`) on three laptops, talking
 * to these Convex functions and routes in memory instead of a fake relay.
 * It runs where the desktop repo sits beside this one (the owner's laptop and
 * desktop PC) and is skipped elsewhere, such as in CI.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "./_generated/api";
import { addMonths } from "./lib/credits";
import { sha256Hex } from "./lib/tokens";
import { identity, setup } from "./test.setup";

type T = ReturnType<typeof setup>;
type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any
const T0 = Date.UTC(2026, 10, 27, 12);
const DESKTOP = join(__dirname, "..", "..", "..", "..", "titan117-desktop", "src", "main", "lib", "team-sync.ts");
const API = "https://convex.test";
const STORAGE = "https://some-deployment.convex.cloud/api/storage/";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
});
afterEach(() => vi.useRealTimers());

const AGENT = `---
name: Invoices
role: Reads supplier invoices and files them.
team: Operations
tools: files
---
File every invoice from Brasov Logistics under clients.`;

/** Our cloud as the laptop's fetch sees it: the HTTP routes, and file storage's addresses. */
function cloudFetch(t: T, seen: string[]): typeof fetch {
  return (async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.startsWith(STORAGE)) {
      // convex-test's file addresses end in the file's SHA-256 (the real ones don't).
      const sha = decodeURIComponent(u.slice(STORAGE.length));
      const text = await t.run(async (ctx) => {
        const file = (await ctx.db.system.query("_storage").collect()).find((f) => f.sha256 === sha);
        const blob = file ? await ctx.storage.get(file._id) : null;
        return blob ? await blob.text() : null;
      });
      return text === null ? new Response("", { status: 404 }) : new Response(text);
    }
    seen.push(String(init?.body ?? ""));
    return await t.fetch(u.slice(API.length), init);
  }) as typeof fetch;
}

/** A laptop's engine as the shell sees it: agents and one sidebar app's records. */
function fakeEngine(agentFiles: Record<string, string>) {
  const imported: { text: string; source: string }[] = [];
  const applied: unknown[][] = [];
  const log: { seq: number; entry: unknown }[] = [];
  let seq = 0;
  const engine = async (method: string, path: string, body?: Any): Promise<Any> => {
    const url = new URL(path, "http://engine");
    if (path === "/v1/agents") return { agents: Object.keys(agentFiles).map((name) => ({ name, updatedAt: 10 })) };
    if (method === "GET" && url.pathname.endsWith("/file")) return { text: agentFiles[decodeURIComponent(url.pathname.split("/")[3]!)] };
    if (path === "/v1/agents/team/import") return imported.push(body), { agent: {} };
    if (path === "/v1/sync/apps") return { apps: ["crm"] };
    if (path === "/v1/sync/read-only") return { apps: body.apps };
    if (method === "GET" && url.pathname === "/v1/sync/apps/crm") {
      const since = Number(url.searchParams.get("since"));
      const mine = log.filter((l) => l.seq > since);
      return { upTo: mine.length ? mine[mine.length - 1]!.seq : since, entries: mine.map((l) => l.entry) };
    }
    if (method === "POST" && url.pathname === "/v1/sync/apps/crm") return applied.push(body.entries), { applied: 1 };
    throw new Error(`Unexpected ${method} ${path}`);
  };
  return {
    engine,
    imported,
    applied,
    write: (name: string) => log.push({ seq: ++seq, entry: { collection: "clients", id: `c${seq}`, op: "put", at: seq, data: { name } } }),
  };
}

async function person(t: T, clerkId: string, plan: "team" | null) {
  const userId = await t.run((ctx) => ctx.db.insert("users", { clerkId }));
  if (plan)
    await t.mutation(internal.billing.applyEvent, {
      eventId: `evt_${clerkId}`,
      type: "customer.subscription.created",
      subscription: {
        subscriptionId: `sub_${clerkId}`,
        customerId: `cus_${clerkId}`,
        userId,
        status: "active",
        plan,
        interval: "month",
        periodStart: T0,
        periodEnd: addMonths(T0, 1),
        seats: 3,
        cancelAtPeriodEnd: false,
      },
      topup: null,
    });
  const token = `t117d_${clerkId.padEnd(43, "x")}`;
  await t.run(async (ctx) => ctx.db.insert("devices", { userId, name: `${clerkId}-laptop`, tokenHash: await sha256Hex(token), createdAt: T0 }));
  return { userId, token, as: t.withIdentity(identity(clerkId)) };
}

describe.skipIf(!existsSync(DESKTOP))("a team of three on the desktop's own code and these functions", () => {
  it("joins with codes, shares an agent and an app's records, and keeps the viewer from changing anything", async () => {
    const { TeamSync } = (await import(/* @vite-ignore */ DESKTOP)) as { TeamSync: Any };
    const t = setup();
    const seen: string[] = [];
    const ana = await person(t, "ana", "team");
    const bo = await person(t, "bo", null);
    const cy = await person(t, "cy", null);
    const teamId = await ana.as.mutation(api.teams.create, { name: "Acme", myName: "Ana" });
    for (const [p, name, role] of [[bo, "Bo", "member"], [cy, "Cy", "viewer"]] as const) {
      const { code } = await ana.as.action(api.teams.invite, { teamId, role });
      await p.as.action(api.teams.join, { code, name });
    }

    const { mkdtempSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const laptop = (p: { token: string }, agents: Record<string, string> = {}) => {
      const e = fakeEngine(agents);
      const team = new TeamSync({
        dataDir: mkdtempSync(join(tmpdir(), "t117-team-")),
        laptopName: "laptop",
        keychain: { encrypt: (s: string) => Buffer.from(`enc:${s}`), decrypt: (b: Buffer) => b.toString().slice(4) },
        apiUrl: () => API,
        deviceToken: () => p.token,
        engine: e.engine,
        notify: () => undefined,
        onChange: () => undefined,
        fetch: cloudFetch(t, seen),
        manual: true,
      });
      return { ...e, team, view: () => team.view().teams[0] };
    };
    const A = laptop(ana);
    const B = laptop(bo, { Invoices: AGENT });
    const C = laptop(cy);
    for (const l of [A, B, C]) await l.team.tick();
    expect([A, B, C].map((l) => l.view()?.role)).toEqual(["owner", "member", "viewer"]);

    await A.team.join(teamId);
    await A.team.tick();
    expect(A.view().status).toBe("in");
    for (const [L, name] of [[B, "Bo"], [C, "Cy"]] as const) {
      await L.team.join(teamId);
      await L.team.tick();
      expect(L.view().status).toBe("waiting");
      await A.team.tick();
      const w = A.view().waiting.find((x: Any) => x.person === name);
      expect(L.view().laptops.find((x: Any) => x.person === "Ana")?.code).toBe(w.code);
      await A.team.allow(teamId, w.id);
      await A.team.tick();
      await L.team.tick();
      expect(L.view().confirm?.code).toBe(w.code);
      L.team.confirmKey(teamId, true);
      await L.team.tick();
      expect(L.view().status).toBe("in");
    }

    // Bo shares an agent; Ana adds it with a click; Ana's laptop opens the audit note.
    await B.team.shareAgent(teamId, "Invoices", true);
    await B.team.tick();
    await B.team.tick();
    await A.team.tick();
    await C.team.tick();
    expect(C.view().inbox.map((e: Any) => [e.name, e.from])).toEqual([["Invoices", "Bo"]]);
    expect(await A.team.addFromInbox(teamId, A.view().inbox[0].id)).toBeNull();
    expect(A.imported).toEqual([{ text: AGENT, source: "team Acme · Bo" }]);
    expect(A.view().activity.map((a: Any) => [a.who, a.what])).toEqual([["Bo", "the agent Invoices"]]);

    // App records: Bo's travel; Cy's (a viewer) are refused by Convex if forced, and never sent.
    for (const L of [A, B, C]) L.team.shareApp(teamId, "crm", true);
    B.write("Brasov Logistics");
    C.write("Viewer edit");
    for (const L of [B, C, A, C]) await L.team.tick();
    expect(JSON.stringify(A.applied)).toContain("Brasov Logistics");
    expect(JSON.stringify(A.applied)).not.toContain("Viewer edit");
    const forced = await t.fetch("/desktop/team/package", {
      method: "POST",
      headers: { Authorization: `Bearer ${cy.token}`, "X-Titan117-Team": teamId, "X-Titan117-Kind": "data", "X-Titan117-Key-Gen": "2" },
      body: "sealed",
    });
    expect(forced.status).toBe(403);

    const log = await ana.as.query(api.teams.auditLog, { teamId });
    expect(log.map((r) => [r.actor, r.action]).filter(([, a]) => /laptop|item|upload/.test(a!))).toEqual([
      ["Cy", "upload.refused"],
      ["Bo", "item.shared"],
      ["Ana", "laptop.admitted"],
      ["Cy", "laptop.waiting"],
      ["Ana", "laptop.admitted"],
      ["Bo", "laptop.waiting"],
    ]);
    // Our cloud never saw a readable name, record or the agent's text.
    const stored = await t.run(async (ctx) => {
      const out: string[] = [];
      for (const c of await ctx.db.query("teamChanges").collect()) out.push(await (await ctx.storage.get(c.storageId))!.text());
      return out;
    });
    for (const text of [...seen, ...stored]) {
      expect(text).not.toContain("Brasov");
      expect(text).not.toContain("Invoices");
    }
  });
});
