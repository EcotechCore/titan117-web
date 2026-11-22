// OpenRouter's signed video webhooks (decisions §59.13): only a fresh delivery
// signed with our secret counts, and only a job's ending is read.
import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { readVideoEvent, verifySignature } from "./webhook";

// A made-up secret for the test, built here (not a real key).
const SECRET = ["whsec", "test", "0".repeat(24)].join("_");
const NOW = 1_795_000_000;

function sign(body: string, t = NOW, secret = SECRET): string {
  return `t=${t},v1=${createHmac("sha256", secret).update(`${t},${body}`).digest("hex")}`;
}

const DONE = JSON.stringify({
  type: "video.generation.completed",
  created_at: "2026-11-22T12:00:00Z",
  data: { id: "job_1", status: "completed", usage: { cost: 0.5, is_byok: false } },
});

describe("verifySignature", () => {
  it("accepts a fresh delivery signed with our secret", () => {
    expect(verifySignature(DONE, sign(DONE), SECRET, NOW)).toBe(true);
    expect(verifySignature(DONE, sign(DONE, NOW - 299), SECRET, NOW)).toBe(true);
  });

  it("refuses unsigned, forged, changed, stale and secret-less deliveries", () => {
    expect(verifySignature(DONE, null, SECRET, NOW)).toBe(false);
    expect(verifySignature(DONE, sign(DONE, NOW, "another-secret"), SECRET, NOW)).toBe(false);
    expect(verifySignature(DONE.replace("0.5", "0.0"), sign(DONE), SECRET, NOW)).toBe(false);
    expect(verifySignature(DONE, sign(DONE, NOW - 301), SECRET, NOW)).toBe(false);
    expect(verifySignature(DONE, sign(DONE, NOW + 301), SECRET, NOW)).toBe(false);
    expect(verifySignature(DONE, sign(DONE), undefined, NOW)).toBe(false);
    expect(verifySignature(DONE, `t=${NOW},v1=zz`, SECRET, NOW)).toBe(false);
    expect(verifySignature(DONE, "garbage", SECRET, NOW)).toBe(false);
  });
});

describe("readVideoEvent", () => {
  it("reads how a job ended and what it cost", () => {
    expect(readVideoEvent(DONE)).toEqual({ jobId: "job_1", status: "completed", costUsd: 0.5 });
    const failed = JSON.stringify({ type: "video.generation.failed", data: { id: "job_2", status: "failed" } });
    expect(readVideoEvent(failed)).toEqual({ jobId: "job_2", status: "failed", costUsd: null });
  });

  it("ignores anything else", () => {
    expect(readVideoEvent("not json")).toBeNull();
    expect(readVideoEvent(JSON.stringify({ type: "batch.completed", data: { id: "b", status: "completed" } }))).toBeNull();
    expect(
      readVideoEvent(JSON.stringify({ type: "video.generation.x", data: { id: "../x", status: "completed" } })),
    ).toBeNull();
    expect(
      readVideoEvent(JSON.stringify({ type: "video.generation.x", data: { id: "job", status: "in_progress" } })),
    ).toBeNull();
  });
});
