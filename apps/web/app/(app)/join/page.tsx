"use client";

/**
 * Joining a team from an invite link (decisions §68.5). The code is after
 * `#`, so it never reaches a server or its logs; this page reads it, shows
 * the team and role, and joins under the name the person chooses.
 */
import { api } from "@titan117/backend/api";
import { INVITE_CODE_PATTERN, TEAM_ROLE_LABELS } from "@titan117/shared";
import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";

const muted = "text-[#6b6b6b]";

function onHashChange(changed: () => void) {
  window.addEventListener("hashchange", changed);
  return () => window.removeEventListener("hashchange", changed);
}

export default function JoinPage() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const ensureUser = useMutation(api.users.ensureUser);
  const [ready, setReady] = useState(false);
  // null on the server, where there is no hash; "" for a missing or malformed code.
  const hash = useSyncExternalStore(onHashChange, () => window.location.hash.slice(1), () => null);
  const code = hash === null ? null : INVITE_CODE_PATTERN.test(hash) ? hash : "";
  useEffect(() => {
    if (isAuthenticated) ensureUser().then(() => setReady(true));
  }, [isAuthenticated, ensureUser]);
  const info = useQuery(api.teams.inviteInfo, ready && code ? { code } : "skip");
  const join = useAction(api.teams.join);
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  let body;
  if (isLoading || code === null || (code && info === undefined)) body = <p className={muted}>Loading…</p>;
  else if (!code || !info)
    body = (
      <>
        <h1 className="text-3xl font-medium">This invite doesn&apos;t work</h1>
        <p className={`mt-3 ${muted}`}>It was used already, cancelled, or more than a week old. Ask for a new one.</p>
      </>
    );
  else if (info.already)
    body = (
      <>
        <h1 className="text-3xl font-medium">You&apos;re already in {info.team}</h1>
        <Link href="/team" className="mt-4 inline-block underline decoration-[#ff6347] underline-offset-4">
          Open your teams
        </Link>
      </>
    );
  else
    body = (
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          try {
            await join({ code, name });
            router.push("/team");
          } catch (err) {
            const c = err instanceof ConvexError ? String(err.data) : "";
            setError(c === "PAYMENT_REQUIRED" ? "The team's plan isn't active right now." : "That didn't work. Ask for a new invite.");
          }
        }}
      >
        <h1 className="text-3xl font-medium">Join {info.team}</h1>
        <p className={`mt-3 ${muted}`}>
          As {TEAM_ROLE_LABELS[info.role].name.toLowerCase()}: {TEAM_ROLE_LABELS[info.role].what.toLowerCase()}. The team&apos;s plan
          covers your seat.
        </p>
        <label className="mt-6 flex flex-col gap-1 text-sm">
          Your name in this team
          <input
            className="h-10 rounded-md border border-[#e6e6e6] px-3 dark:border-[#262626] dark:bg-[#0b0b0b]"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            required
          />
        </label>
        <button className="mt-4 h-11 rounded-[10px] bg-[#ff6347] px-5 font-medium text-white hover:bg-[#c2361f]">Join the team</button>
        {error && (
          <p role="alert" className="mt-3 text-sm text-[#c2361f]">
            {error}
          </p>
        )}
      </form>
    );

  return <main className="mx-auto w-full max-w-[560px] px-4 py-16">{isAuthenticated || isLoading ? body : <p className={muted}>Sign in to join.</p>}</main>;
}
