/**
 * What the desktop app asks before installing an add-on (decisions §66.11):
 * whether we took the repository down, and which commit staff verified.
 * Public on purpose: a takedown is public, and the question names only a
 * public repository.
 */
import { api } from "@titan117/backend/api";
import { fetchQuery } from "convex/nextjs";

const FULL_NAME = /^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/;

export async function GET(request: Request) {
  const repo = new URL(request.url).searchParams.get("repo") ?? "";
  if (!FULL_NAME.test(repo)) return Response.json({ error: "Give the repository as owner/repo." }, { status: 400 });
  try {
    const status = await fetchQuery(api.market.status, { fullName: repo });
    return Response.json(status, { headers: { "Cache-Control": "public, max-age=60" } });
  } catch {
    return Response.json({ error: "The marketplace isn't reachable." }, { status: 503 });
  }
}
