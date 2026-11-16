"use client";
/** Comments on a shared page (feature 17.14): read them, and add one. */
import { useRouter } from "next/navigation";
import { useState } from "react";

export interface PageComment {
  name: string;
  text: string;
  fromOwner: boolean;
  at: number;
}

export function Comments({ id, comments }: { id: string; comments: PageComment[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "failed" | "busy">("idle");

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    setState("sending");
    try {
      const res = await fetch(`/api/v1/shares/${encodeURIComponent(id)}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, text }),
      });
      if (res.status === 429) return setState("busy");
      if (!res.ok) return setState("failed");
      setText("");
      setState("idle");
      router.refresh();
    } catch {
      setState("failed");
    }
  }

  return (
    <>
      <button className="btn" type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
        Comments{comments.length ? ` (${comments.length})` : ""}
      </button>
      {open && (
        <aside className="comments" aria-label="Comments">
          {comments.length === 0 && <p className="muted">No comments yet.</p>}
          <ol>
            {comments.map((c, i) => (
              <li key={i} className={c.fromOwner ? "own" : ""}>
                <strong>{c.name}</strong>{" "}
                <time className="muted" dateTime={new Date(c.at).toISOString()}>
                  {new Date(c.at).toLocaleString()}
                </time>
                <p>{c.text}</p>
              </li>
            ))}
          </ol>
          <form onSubmit={send}>
            <label htmlFor="c-name">Your name (optional)</label>
            <input id="c-name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
            <label htmlFor="c-text">Comment</label>
            <textarea id="c-text" maxLength={2000} required value={text} onChange={(e) => setText(e.target.value)} />
            {state === "failed" && <p className="muted">That didn&apos;t go through. Try again.</p>}
            {state === "busy" && <p className="muted">This page has had many comments today. Try again tomorrow.</p>}
            <p className="muted">Everyone with the link can read comments. The author can hide them.</p>
            <button className="btn primary" type="submit" disabled={state === "sending"}>
              {state === "sending" ? "Sending…" : "Comment"}
            </button>
          </form>
        </aside>
      )}
    </>
  );
}
