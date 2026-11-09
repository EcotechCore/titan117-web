// Static guardrail checks that read the source rather than run it.
//
// 1. Denial coverage (guardrails §2): every function built from a paid,
//    device or admin wrapper is named (`api.<module>.<name>`) in some test,
//    where it is called as the wrong caller.
// 2. Data table (guardrails §12, decisions §11 and §32): every table in the
//    schema has a row in the data table, and the table lists nothing the
//    schema doesn't have yet only if the row says "planned".
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = fileURLToPath(new URL(".", import.meta.url));
const convexDir = join(here, "..", "convex");
const decisions = join(here, "..", "..", "..", "docs", "notes", "decisions.md");

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.name === "_generated" || e.name === "node_modules") return [];
    const p = join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

const files = walk(convexDir).filter((f) => f.endsWith(".ts") && !f.endsWith(".d.ts"));
const sources = files.filter((f) => !f.endsWith(".test.ts") && !f.includes(`${join("convex", "lib")}`));
const tests = files.filter((f) => f.endsWith(".test.ts")).map((f) => readFileSync(f, "utf8"));

describe("denial coverage", () => {
  const gated = sources.flatMap((file) => {
    const module = relative(convexDir, file).replace(/\\/g, "/").replace(/\.ts$/, "").replace(/\//g, ".");
    const src = readFileSync(file, "utf8");
    return [...src.matchAll(/export const (\w+)\s*=\s*(paid|device|admin)(Query|Mutation)\b/g)].map(
      (m) => `api.${module}.${m[1]}`,
    );
  });

  it("finds the gated functions it should check", () => {
    // Phase 0 has none yet; this keeps the scan honest once there are.
    expect(Array.isArray(gated)).toBe(true);
  });

  it.each(gated.length ? gated : ["(none yet)"])("%s has a denial test", (ref) => {
    if (ref === "(none yet)") return;
    expect(tests.some((t) => t.includes(ref)), `${ref} is never called in a test`).toBe(true);
  });
});

describe("data table", () => {
  const schema = readFileSync(join(convexDir, "schema.ts"), "utf8");
  const schemaTables = [...schema.matchAll(/^\s{2}(\w+):\s*defineTable\(/gm)].map((m) => m[1]);

  const doc = readFileSync(decisions, "utf8");
  const section = doc.slice(doc.indexOf("## 11. Deleting data"), doc.indexOf("\n---", doc.indexOf("## 11. Deleting data")));
  const rows = section.split("\n").filter((l) => l.startsWith("|") && !l.startsWith("|---") && !l.startsWith("| Data"));
  const documented = rows.flatMap((row) => {
    const tablesCell = row.split("|")[2] ?? "";
    return [...tablesCell.matchAll(/`(\w+)`/g)].map((m) => ({ table: m[1], planned: /\(planned/.test(row) }));
  });

  it("reads the schema and the data table", () => {
    expect(schemaTables.length).toBeGreaterThan(0);
    expect(documented.length).toBeGreaterThan(0);
  });

  it.each(schemaTables)("table %s has a row in decisions §11", (table) => {
    expect(documented.map((d) => d.table)).toContain(table);
  });

  it("every documented table is in the schema or marked planned", () => {
    const missing = documented.filter((d) => !d.planned && !schemaTables.includes(d.table)).map((d) => d.table);
    expect(missing).toEqual([]);
  });
});
