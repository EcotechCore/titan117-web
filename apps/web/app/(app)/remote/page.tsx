"use client";

/**
 * Remote control from the web and the phone (decisions §64.7, §64.9, §64.10):
 * start a task on a paired laptop, watch it, answer its approvals, cancel it,
 * read the result and send a file. Everything is sealed in this browser to
 * the laptop's key and opened here with this browser's own key; Convex only
 * passes along what it can't read. Laptop-only approvals are shown but can't
 * be answered here (guardrails §9).
 */
import { api } from "@titan117/backend/api";
import type { Id } from "@titan117/backend/dataModel";
import {
  REMOTE_MAX_FILE_BYTES,
  REMOTE_MESSAGE_TTL_MS,
  REMOTE_PROTOCOL_VERSION,
  fromBase64Url,
  open,
  randomId,
  seal,
  type RemoteApproval,
  type RemoteCommand,
  type RemoteEvent,
  type RemoteStep,
  type RemoteTask,
  type SealHeader,
} from "@titan117/shared";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  deviceKey,
  forgetAll,
  replaceLaptopKey,
  trustedLaptops,
  type DeviceKey,
  type TrustedLaptop,
} from "@/lib/remote-keys";

interface LaptopState {
  tasks: RemoteTask[];
  approvals: RemoteApproval[];
  details: Record<string, { task: RemoteTask; steps: RemoteStep[]; result: string | null }>;
  alerts: string[];
  problems: string[];
  /** Ready posts whose time has come, for the share sheet (decisions §64.13). */
  shares: Extract<RemoteEvent, { type: "share" }>[];
}

const empty = (): LaptopState => ({ tasks: [], approvals: [], details: {}, alerts: [], problems: [], shares: [] });

/** Opens the phone's share sheet with the post's text and pictures; copies the text where sharing isn't offered. */
async function sharePost(post: Extract<RemoteEvent, { type: "share" }>): Promise<string> {
  const files = post.files.map((f) => new File([Uint8Array.from(atob(f.data), (c) => c.charCodeAt(0))], f.name, { type: f.type }));
  try {
    if (files.length && navigator.canShare?.({ files })) await navigator.share({ text: post.text, files });
    else if (navigator.share) await navigator.share({ text: post.text });
    else {
      await navigator.clipboard.writeText(post.text);
      return "Text copied. Paste it in the app.";
    }
    return "Shared. Mark it posted on the laptop.";
  } catch {
    await navigator.clipboard.writeText(post.text).catch(() => undefined);
    return "Not shared. The text is copied.";
  }
}
const STATUS: Record<string, string> = {
  running: "Working",
  waiting: "Needs you",
  done: "Done",
  stopped: "Stopped",
  error: "Failed",
};

/** A command sealed from this browser's key to the laptop's (decisions §64.3), with a fresh id and a 24-hour expiry. */
async function sealCommand(me: DeviceKey, to: string, command: RemoteCommand) {
  const header: SealHeader = { v: REMOTE_PROTOCOL_VERSION, from: me.publicKey, to, kind: "command", id: randomId() };
  const now = Date.now();
  const sealed = await seal(
    header,
    { v: REMOTE_PROTOCOL_VERSION, id: randomId(), sentAt: now, expiresAt: now + REMOTE_MESSAGE_TTL_MS, command },
    me.privateKey,
  );
  return { from: me.publicKey, to, msgId: header.id, sealed };
}

function errorText(error: unknown) {
  const code = error instanceof ConvexError ? String(error.data) : "";
  if (code === "PAYMENT_REQUIRED") return "Remote control needs an active plan.";
  if (code === "RATE_LIMITED") return "Too many requests in a minute. Wait a moment.";
  if (code === "FORBIDDEN") return "The laptop's remote control is switched off.";
  return "That didn't go through. Try again.";
}

export default function Remote() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const [me, setMe] = useState<DeviceKey | null | undefined>(undefined);
  const [trusted, setTrusted] = useState<TrustedLaptop[]>([]);
  const laptops = useQuery(api.remote.laptops, isAuthenticated ? {} : "skip");
  const inbox = useQuery(api.remote.inbox, isAuthenticated && me ? { key: me.publicKey } : "skip");
  const send = useMutation(api.remote.send);
  const ack = useMutation(api.remote.ack);
  const revokeAll = useMutation(api.remote.revokeAll);
  const pushKey = useQuery(api.remote.pushKey, isAuthenticated ? {} : "skip");
  const subscribePush = useMutation(api.remote.subscribePush);
  const [pushState, setPushState] = useState<string | null>(null);
  const [states, setStates] = useState<Record<string, LaptopState>>({});
  const [chosen, setChosen] = useState<string | null>(null);
  const [openTask, setOpenTask] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const seen = useRef(new Set<string>());

  const reload = useCallback(async () => {
    const [key, laptops] = await Promise.all([deviceKey(), trustedLaptops()]);
    setMe(key);
    setTrusted(laptops);
  }, []);
  useEffect(() => {
    let live = true;
    void Promise.all([deviceKey(), trustedLaptops()]).then(([key, laptops]) => {
      if (!live) return;
      setMe(key);
      setTrusted(laptops);
    });
    return () => {
      live = false;
    };
  }, []);

  const apply = useCallback((laptop: string, event: RemoteEvent) => {
    setStates((all) => {
      const s = { ...(all[laptop] ?? empty()) };
      if (event.type === "state") {
        s.tasks = event.tasks;
        s.approvals = event.approvals;
      } else if (event.type === "task") {
        s.details = { ...s.details, [event.task.id]: { task: event.task, steps: event.steps, result: event.result } };
        s.approvals = [...s.approvals.filter((a) => a.taskId !== event.task.id), ...event.approvals];
      } else if (event.type === "share") {
        s.shares = [event, ...s.shares.filter((p) => p.postId !== event.postId)].slice(0, 10);
      } else if (event.type === "alert") {
        s.alerts = [event.text, ...s.alerts].slice(0, 5);
      } else if (event.type === "done" && !event.ok) {
        s.problems = [event.error, ...s.problems].slice(0, 3);
      } else if (event.type === "done" && event.ok && event.taskId) {
        setOpenTask(event.taskId);
      }
      return { ...all, [laptop]: s };
    });
  }, []);

  // Open what arrived for this browser, then let Convex drop it.
  useEffect(() => {
    if (!me || !inbox?.messages.length) return;
    const fresh = inbox.messages.filter((m) => !seen.current.has(m.id));
    if (!fresh.length) return;
    void (async () => {
      const done: Id<"remoteMessages">[] = [];
      for (const m of fresh) {
        seen.current.add(m.id);
        done.push(m.id);
        const laptop = (await trustedLaptops()).find((l) => l.publicKey === m.from);
        if (!laptop) continue; // Not a laptop this browser paired with: ignored.
        const header: SealHeader = { v: REMOTE_PROTOCOL_VERSION, from: m.from, to: me.publicKey, kind: m.kind, id: m.msgId };
        const payload = (await open(header, m.sealed, me.privateKey)) as
          | { event?: RemoteEvent; newKey?: string }
          | null;
        if (!payload) continue;
        if (m.kind === "key" && typeof payload.newKey === "string") {
          await replaceLaptopKey(m.from, payload.newKey);
          setStates((s) => ({ ...s, [payload.newKey!]: s[m.from] ?? empty() }));
          setChosen((c) => (c === m.from ? payload.newKey! : c));
          setTrusted(await trustedLaptops());
          continue;
        }
        if (m.kind === "event" && payload.event) apply(m.from, payload.event);
      }
      await ack({ key: me.publicKey, ids: done }).catch(() => undefined);
    })();
  }, [inbox, me, ack, apply]);



  // Only laptops this browser paired with and whose current key it trusts.
  const usable = (laptops ?? [])
    .filter((l) => l.remoteOn && l.publicKey)
    .map((l) => ({ ...l, trusted: trusted.find((t) => t.publicKey === l.publicKey) }));
  const current = usable.find((l) => l.publicKey === chosen) ?? usable.find((l) => l.trusted) ?? null;
  const state = current?.publicKey ? (states[current.publicKey] ?? empty()) : empty();

  const target = current?.trusted && current.publicKey ? current.publicKey : null;
  async function command(cmd: RemoteCommand) {
    if (!me || !target) return;
    setBusy(true);
    setProblem(null);
    try {
      await send(await sealCommand(me, target, cmd));
    } catch (error) {
      setProblem(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  // The effect below always calls the latest one.
  const latestCommand = useRef(command);
  useEffect(() => {
    latestCommand.current = command;
  });

  // Ask for the list when a laptop is first shown.
  const asked = useRef(new Set<string>());
  useEffect(() => {
    if (target && !asked.current.has(target)) {
      asked.current.add(target);
      void latestCommand.current({ type: "task.list" });
    }
  }, [target]);

  async function addFile(file: File) {
    if (file.size > REMOTE_MAX_FILE_BYTES) return setProblem("Files up to 512 KB from here; larger ones through Telegram.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    await command({ type: "file.add", name: file.name, data: btoa(bin) });
  }

  /** Notifications on this device (decisions §64.10): a push says only "Titan117 needs you". */
  async function enablePush() {
    if (!me || !pushKey) return;
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        const iPhone = /iPhone|iPad/.test(navigator.userAgent);
        return setPushState(
          iPhone ? "On iPhone, add this page to your Home Screen (Share, then Add to Home Screen) and turn notifications on from there." : "This browser can't show notifications.",
        );
      }
      const reg = await navigator.serviceWorker.register("/remote-sw.js", { scope: "/remote" });
      if ((await Notification.requestPermission()) !== "granted") return setPushState("Notifications are blocked for this site.");
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: fromBase64Url(pushKey) as BufferSource });
      await subscribePush({ key: me.publicKey, endpoint: sub.endpoint });
      setPushState("Notifications are on for this device.");
    } catch (error) {
      setPushState(error instanceof ConvexError ? errorText(error) : "Couldn't turn notifications on here.");
    }
  }

  if (isLoading || me === undefined) return <main className="min-h-screen" />;

  const detail = openTask ? state.details[openTask] : null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <header className="flex items-center justify-between">
        <p className="font-semibold tracking-[.04em]">TITAN117</p>
        <Link href="/account" className="text-sm text-[#6b6b6b] hover:text-[#c2361f]">
          Account
        </Link>
      </header>
      <h1 className="text-3xl font-medium tracking-[-.02em]">Remote control</h1>

      {!me || !usable.some((l) => l.trusted) ? (
        <section className="flex flex-col gap-3 rounded-xl border border-[#e6e6e6] p-5">
          <h2 className="text-lg font-medium">Pair with your laptop first</h2>
          <p className="text-[#6b6b6b]">
            On the laptop, open Remote control in the Titan117 app, switch it on and choose Pair a phone or browser.
            Then scan the code with this phone, or open the link in this browser.
          </p>
        </section>
      ) : (
        <>
          {usable.filter((l) => l.trusted).length > 1 && (
            <div className="flex flex-wrap gap-2">
              {usable
                .filter((l) => l.trusted)
                .map((l) => (
                  <button
                    key={l.id}
                    onClick={() => setChosen(l.publicKey)}
                    className={`h-9 rounded-[8px] border px-3 text-sm ${l.publicKey === current?.publicKey ? "border-[#ff6347] bg-[#ffece8]" : "border-[#e6e6e6]"}`}
                  >
                    {l.name}
                  </button>
                ))}
            </div>
          )}
          {current && (
            <p className="text-sm text-[#6b6b6b]">
              <span className={`mr-2 inline-block h-2 w-2 rounded-full ${current.online ? "bg-[#2a9a30]" : "bg-[#c4c4c4]"}`} />
              {current.name}: {current.online ? "online" : "offline; requests wait up to 24 hours"}
            </p>
          )}

          {state.alerts.map((a, i) => (
            <p key={i} className="rounded-lg bg-[#f5f5f5] px-4 py-2 text-sm">
              {a}
            </p>
          ))}

          <section className="flex flex-col gap-2">
            <label htmlFor="task" className="text-sm font-medium">
              New task
            </label>
            <textarea
              id="task"
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Summarise this week's invoices and draft a reminder for the late ones"
              className="rounded-[10px] border border-[#e6e6e6] p-3 focus:border-[#ff6347] focus:outline-none"
            />
            <div className="flex flex-wrap items-center gap-3">
              <button
                className="h-11 rounded-[10px] bg-[#ff6347] px-5 font-medium text-white hover:bg-[#c2361f] disabled:opacity-60"
                disabled={busy || !text.trim()}
                onClick={() => {
                  void command({ type: "task.start", text: text.trim() });
                  setText("");
                }}
              >
                Start on {current?.name ?? "laptop"}
              </button>
              <label className="cursor-pointer text-sm text-[#6b6b6b] hover:text-[#c2361f]">
                Send a file
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void addFile(f);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            {(problem || state.problems[0]) && (
              <p className="text-sm text-[#c2361f]" role="alert">
                {problem ?? state.problems[0]}
              </p>
            )}
          </section>

          {state.shares.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-lg font-medium">Time to post</h2>
              {state.shares.map((p) => (
                <div key={p.postId} className="flex flex-col gap-2 rounded-xl border border-[#e6e6e6] p-4">
                  <p className="text-sm text-[#6b6b6b]">{p.platform}</p>
                  <p className="whitespace-pre-wrap">{p.text}</p>
                  {p.left.length > 0 && (
                    <p className="text-sm text-[#6b6b6b]">Too large to send here, still on the laptop: {p.left.join(", ")}</p>
                  )}
                  <button
                    className="h-9 self-start rounded-[8px] bg-[#ff6347] px-4 text-sm font-medium text-white hover:bg-[#c2361f]"
                    onClick={() => void sharePost(p).then(setProblem)}
                  >
                    Share{p.files.length ? ` with ${p.files.length} picture${p.files.length > 1 ? "s" : ""}` : ""}
                  </button>
                </div>
              ))}
            </section>
          )}

          {state.approvals.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-lg font-medium">Needs you</h2>
              {state.approvals.map((a) => (
                <div key={a.id} className="flex flex-col gap-3 rounded-xl border border-[#ff6347] p-4">
                  <p>{a.summary}</p>
                  {a.laptopOnly ? (
                    <p className="text-sm text-[#6b6b6b]">Approve this on your laptop.</p>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        className="h-9 rounded-[8px] bg-[#ff6347] px-4 text-sm font-medium text-white hover:bg-[#c2361f]"
                        disabled={busy}
                        onClick={() => void command({ type: "approval.answer", approvalId: a.id, answer: "approve" })}
                      >
                        Approve
                      </button>
                      <button
                        className="h-9 rounded-[8px] border border-[#e6e6e6] px-4 text-sm hover:border-[#ff6347]"
                        disabled={busy}
                        onClick={() => void command({ type: "approval.answer", approvalId: a.id, answer: "deny" })}
                      >
                        Deny
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </section>
          )}

          {detail && (
            <section className="flex flex-col gap-2 rounded-xl border border-[#e6e6e6] p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-medium">{detail.task.title}</h2>
                <button className="text-sm text-[#6b6b6b]" onClick={() => setOpenTask(null)}>
                  Close
                </button>
              </div>
              <p className="text-sm text-[#6b6b6b]">{STATUS[detail.task.status] ?? detail.task.status}</p>
              <ol className="flex flex-col gap-1 text-sm">
                {detail.steps.map((s, i) => (
                  <li key={i} className="text-[#6b6b6b]">
                    {s.text}
                  </li>
                ))}
              </ol>
              {detail.result && <p className="whitespace-pre-wrap rounded-lg bg-[#f5f5f5] p-3">{detail.result}</p>}
              {(detail.task.status === "running" || detail.task.status === "waiting") && (
                <button
                  className="h-9 self-start rounded-[8px] border border-[#e6e6e6] px-4 text-sm hover:border-[#ff6347]"
                  onClick={() => void command({ type: "task.cancel", taskId: detail.task.id })}
                >
                  Cancel task
                </button>
              )}
            </section>
          )}

          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-medium">Tasks</h2>
            {state.tasks.length === 0 && <p className="text-[#6b6b6b]">No tasks yet.</p>}
            {state.tasks.map((t) => (
              <button
                key={t.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-[#e6e6e6] px-4 py-3 text-left hover:border-[#ff6347]"
                onClick={() => {
                  setOpenTask(t.id);
                  void command({ type: "task.get", taskId: t.id });
                }}
              >
                <span>
                  <span className="block">{t.title}</span>
                  {t.startedFrom && <span className="block text-xs text-[#6b6b6b]">From {t.startedFrom}</span>}
                </span>
                <span className={`text-sm ${t.status === "waiting" ? "text-[#c2361f]" : "text-[#6b6b6b]"}`}>
                  {STATUS[t.status] ?? t.status}
                </span>
              </button>
            ))}
          </section>
        </>
      )}

      {me && pushKey && usable.some((l) => l.trusted) && (
        <section className="mt-6 flex flex-col gap-2 border-t border-[#e6e6e6] pt-6">
          <h2 className="text-lg font-medium">Notifications</h2>
          <p className="text-sm text-[#6b6b6b]">
            Get a notification on this device when the laptop needs you or a task finishes. It says only &quot;Titan117
            needs you&quot;; the details stay encrypted until you open this page.
          </p>
          <button
            className="h-9 self-start rounded-[8px] border border-[#e6e6e6] px-4 text-sm hover:border-[#ff6347]"
            onClick={() => void enablePush()}
          >
            Turn on notifications
          </button>
          {pushState && <p className="text-sm text-[#6b6b6b]">{pushState}</p>}
        </section>
      )}

      <section className="mt-6 flex flex-col gap-2 border-t border-[#e6e6e6] pt-6">
        <h2 className="text-lg font-medium">If a device is lost</h2>
        <p className="text-sm text-[#6b6b6b]">
          Revoke all devices unpairs every phone and browser and unlinks your chat bots. Your laptops keep working on their
          own.
        </p>
        <button
          className="h-9 self-start rounded-[8px] border border-[#e6e6e6] px-4 text-sm hover:border-[#ff6347]"
          onClick={() => {
            if (!window.confirm("Unpair every phone and browser, and unlink your chats?")) return;
            void revokeAll({})
              .then(forgetAll)
              .then(reload)
              .catch((e) => setProblem(errorText(e)));
          }}
        >
          Revoke all devices
        </button>
      </section>
    </main>
  );
}
