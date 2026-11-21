/**
 * Kill switches (decisions §20, §55): adapters for the user's own coding
 * tools that Titan117 must stop running at once, for example after a
 * vendor changes its terms. The desktop app checks this on start and every
 * hour and falls back to its own engine. Set in the server's environment:
 *
 *   TITAN117_KILL_SWITCHES=codex,grok
 *
 * Public on purpose: it says only which adapters are off, nothing about anyone.
 */
const KNOWN = new Set(["claude-code", "codex", "cursor", "grok"]);

export function GET() {
  const disabled = (process.env.TITAN117_KILL_SWITCHES ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => KNOWN.has(s));
  return Response.json(
    { disabled: [...new Set(disabled)] },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
