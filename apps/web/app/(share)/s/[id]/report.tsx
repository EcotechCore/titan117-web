"use client";
/** Report this page (the Digital Services Act's notice and action, decisions §44). */
import { useRef, useState } from "react";

const REASONS = [
  ["illegal", "It's illegal"],
  ["privacy", "It shares someone's personal data"],
  ["copyright", "It copies my work"],
  ["abuse", "Spam, scam or harassment"],
  ["other", "Something else"],
] as const;

export function ReportButton({ id }: { id: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");

  async function send(form: FormData) {
    setState("sending");
    try {
      const res = await fetch(`/api/v1/shares/${encodeURIComponent(id)}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: form.get("reason"), note: form.get("note") ?? "", email: form.get("email") ?? "" }),
      });
      setState(res.ok ? "sent" : "failed");
    } catch {
      setState("failed");
    }
  }

  return (
    <>
      <button className="btn" type="button" onClick={() => dialog.current?.showModal()}>
        Report
      </button>
      <dialog ref={dialog} aria-labelledby="report-title">
        {state === "sent" ? (
          <>
            <h2 id="report-title">Thank you</h2>
            <p className="ok">We received your report and will review this page.</p>
            <div className="row">
              <button className="btn" type="button" onClick={() => dialog.current?.close()}>
                Close
              </button>
            </div>
          </>
        ) : (
          <form action={send}>
            <h2 id="report-title">Report this page</h2>
            <p>Our team reviews every report. Your email is optional; we use it only to tell you what we decided.</p>
            <label htmlFor="reason">What&apos;s wrong</label>
            <select id="reason" name="reason" required defaultValue="illegal">
              {REASONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <label htmlFor="note">Details</label>
            <textarea id="note" name="note" maxLength={2000} placeholder="What should we look at, and why?" />
            <label htmlFor="email">Your email (optional)</label>
            <input id="email" name="email" type="email" maxLength={200} autoComplete="email" />
            {state === "failed" && <p>That didn&apos;t go through. Try again, or write to abuse@titan117.com.</p>}
            <div className="row">
              <button className="btn" type="button" onClick={() => dialog.current?.close()}>
                Cancel
              </button>
              <button className="btn primary" type="submit" disabled={state === "sending"}>
                {state === "sending" ? "Sending…" : "Send report"}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
