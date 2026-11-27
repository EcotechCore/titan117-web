"use client";

/**
 * Teams (11.6, 11.7; decisions §68): people, roles, invite links, the
 * team's laptops, the audit log and an agency's brand. The page shows only
 * what the caller's role may do; Convex checks everything again.
 *
 * What the team shares (agents, apps and their data) is never here: it
 * travels between the members' laptops, sealed under the team key.
 */
import { UserButton } from "@clerk/nextjs";
import { api } from "@titan117/backend/api";
import type { Id } from "@titan117/backend/dataModel";
import {
  BRAND_LOGO_MAX_BYTES,
  BRAND_LOGO_TYPES,
  PLANS,
  TEAM_AUDIT_LABELS,
  TEAM_ROLE_LABELS,
  brandProblem,
  canChangeMember,
  canInviteAs,
  teamCan,
  type TeamAuditAction,
  type TeamRole,
} from "@titan117/shared";
import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import Link from "next/link";
import { useEffect, useState } from "react";

const line = "border-[#e6e6e6] dark:border-[#262626]";
const muted = "text-[#6b6b6b]";
const button = "h-10 rounded-[10px] bg-[#ff6347] px-4 font-medium text-white hover:bg-[#c2361f] disabled:opacity-60";
const quiet = "underline decoration-[#ff6347] underline-offset-4 disabled:opacity-60";
const field = `h-10 rounded-md border ${line} bg-white px-3 dark:bg-[#0b0b0b]`;

const when = (ms: number) => new Date(ms).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function errorText(error: unknown) {
  const code = error instanceof ConvexError ? String(error.data) : "";
  if (code === "PAYMENT_REQUIRED") return "This needs the team owner's Team or Agency plan to be active.";
  if (code === "FORBIDDEN") return "Your role doesn't allow that, or every seat is taken.";
  if (code === "RATE_LIMITED") return "Too many open invites. Cancel some first.";
  if (code === "NOT_FOUND") return "That team or person isn't there any more.";
  return "Something went wrong. Please try again.";
}

type RoleChoice = Exclude<TeamRole, "owner">;

export default function TeamPage() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const ensureUser = useMutation(api.users.ensureUser);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (isAuthenticated) ensureUser().then(() => setReady(true));
  }, [isAuthenticated, ensureUser]);
  const mine = useQuery(api.teams.mine, ready ? {} : "skip");
  const [picked, setPicked] = useState<Id<"teams"> | null>(null);
  const teamId = picked ?? mine?.teams[0]?.id ?? null;

  if (isLoading || (isAuthenticated && mine === undefined)) return <p className={`p-10 text-center ${muted}`}>Loading…</p>;
  if (!isAuthenticated || !mine) return <p className={`p-10 text-center ${muted}`}>Sign in to see your teams.</p>;

  return (
    <main className={`mx-auto w-full max-w-[1200px] border-x ${line}`}>
      <header className={`flex items-center justify-between border-b ${line} px-4 py-5 sm:px-10`}>
        <span className="font-semibold tracking-[.04em]">TITAN117</span>
        <nav className="flex items-center gap-5 text-sm">
          <Link href="/account" className={quiet}>
            Account
          </Link>
          <UserButton />
        </nav>
      </header>

      <section className={`border-b ${line} px-4 py-12 sm:px-10`}>
        <h1 className="text-4xl font-medium tracking-tight">Teams</h1>
        <p className={`mt-3 max-w-2xl ${muted}`}>
          A team shares agents and sidebar apps between its members&apos; laptops, sealed end to end: we see who is in a team and their
          roles, never what it shares.
        </p>
        {mine.teams.length > 1 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {mine.teams.map((t) => (
              <button
                key={t.id}
                onClick={() => setPicked(t.id)}
                className={`rounded-md border px-3 py-1.5 text-sm ${t.id === teamId ? "border-[#ff6347] font-medium" : line}`}
              >
                {t.name}
              </button>
            ))}
          </div>
        )}
      </section>

      {mine.canCreate && <CreateTeam onMade={(id) => setPicked(id)} first={mine.teams.length === 0} />}
      {mine.teams.length === 0 && !mine.canCreate && (
        <section className={`border-b ${line} px-4 py-12 sm:px-10`}>
          <h2 className="text-2xl font-medium">No team yet</h2>
          <p className={`mt-2 ${muted}`}>
            Someone on a team sends you an invite link to join. To start a team of your own, choose the {PLANS.team.name} or{" "}
            {PLANS.agency.name} plan on your <Link href="/account" className={quiet}>account page</Link>.
          </p>
        </section>
      )}
      {teamId && <Team key={teamId} teamId={teamId} onGone={() => setPicked(null)} />}
    </main>
  );
}

function CreateTeam({ onMade, first }: { onMade: (id: Id<"teams">) => void; first: boolean }) {
  const create = useMutation(api.teams.create);
  const [name, setName] = useState("");
  const [me, setMe] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <section className={`border-b ${line} px-4 py-12 sm:px-10`}>
      <h2 className="text-2xl font-medium">{first ? "Start your team" : "Add a client team"}</h2>
      <form
        className="mt-4 flex flex-wrap items-end gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          try {
            onMade(await create({ name, myName: me }));
            setName("");
          } catch (err) {
            setError(errorText(err));
          }
        }}
      >
        <label className="flex flex-col gap-1 text-sm">
          Team name
          <input className={field} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Your name in it
          <input className={field} value={me} onChange={(e) => setMe(e.target.value)} maxLength={60} required />
        </label>
        <button className={button}>Make the team</button>
      </form>
      {error && <p role="alert" className="mt-3 text-sm text-[#c2361f]">{error}</p>}
    </section>
  );
}

function Team({ teamId, onGone }: { teamId: Id<"teams">; onGone: () => void }) {
  const team = useQuery(api.teams.get, { teamId });
  const setRole = useMutation(api.teams.setRole);
  const removeMember = useMutation(api.teams.removeMember);
  const leave = useMutation(api.teams.leave);
  const remove = useMutation(api.teams.remove);
  const [error, setError] = useState<string | null>(null);

  async function run(job: () => Promise<unknown>) {
    setError(null);
    try {
      await job();
    } catch (e) {
      setError(errorText(e));
    }
  }

  if (team === undefined) return <p className={`p-10 ${muted}`}>Loading…</p>;
  const my = team.myRole;

  return (
    <>
      <section className={`border-b ${line} px-4 py-12 sm:px-10`}>
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h2 className="text-2xl font-medium">{team.name}</h2>
          <p className={`text-sm ${muted}`}>
            You are {TEAM_ROLE_LABELS[my].name.toLowerCase()} ·{" "}
            {team.planActive ? `${team.seatsUsed} of ${team.seats} seats used` : "the owner's plan isn't active, so the team is paused"}
          </p>
        </div>
        {error && (
          <p role="alert" className="mt-4 rounded-lg border border-[#ff6347] px-4 py-3">
            {error}
          </p>
        )}
        <ul className={`mt-6 divide-y ${line.replace("border", "divide")}`}>
          {team.members.map((m) => {
            const choices = (["admin", "member", "viewer"] as RoleChoice[]).filter((r) => r === m.role || canChangeMember(my, m.role, r));
            const mayRemove = !m.me && canChangeMember(my, m.role, null);
            return (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <span>
                  <span className="font-medium">{m.name}</span>
                  {m.me && <span className={muted}> (you)</span>}
                  {!m.covered && <span className="ml-2 text-[#c2361f]">no seat: the app locks for them until one is free</span>}
                </span>
                <span className="flex items-center gap-4">
                  {m.role === "owner" || m.me || choices.length < 2 ? (
                    <span title={TEAM_ROLE_LABELS[m.role].what}>{TEAM_ROLE_LABELS[m.role].name}</span>
                  ) : (
                    <select
                      aria-label={`Role of ${m.name}`}
                      className={field}
                      value={m.role}
                      onChange={(e) => run(() => setRole({ memberId: m.id, role: e.target.value as RoleChoice }))}
                    >
                      {choices.map((r) => (
                        <option key={r} value={r}>
                          {TEAM_ROLE_LABELS[r].name}
                        </option>
                      ))}
                    </select>
                  )}
                  {mayRemove && (
                    <button
                      className={quiet}
                      onClick={() => {
                        if (window.confirm(`Remove ${m.name}? Their laptops leave the team and stop getting what it shares.`))
                          void run(() => removeMember({ memberId: m.id }));
                      }}
                    >
                      Remove
                    </button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
        <dl className={`mt-6 grid gap-2 text-sm ${muted} sm:grid-cols-2`}>
          {(["owner", "admin", "member", "viewer"] as TeamRole[]).map((r) => (
            <div key={r}>
              <dt className="inline font-medium text-inherit">{TEAM_ROLE_LABELS[r].name}: </dt>
              <dd className="inline">{TEAM_ROLE_LABELS[r].what}.</dd>
            </div>
          ))}
        </dl>
      </section>

      {teamCan(my, "invite") && <Invites teamId={teamId} my={my} invites={team.invites} run={run} />}

      {teamCan(my, "admitLaptop") && (
        <section className={`border-b ${line} px-4 py-12 sm:px-10`}>
          <h3 className="text-xl font-medium">Laptops</h3>
          <p className={`mt-2 text-sm ${muted}`}>
            A member&apos;s laptop joins on the Team screen of the Titan117 app. An owner or admin lets it in from their own laptop after
            you both compare the code it shows; this page can&apos;t, since it never holds the team key.
          </p>
          {team.laptops.length === 0 ? (
            <p className={`mt-4 text-sm ${muted}`}>No laptops yet.</p>
          ) : (
            <ul className="mt-4 space-y-1 text-sm">
              {team.laptops.map((l) => (
                <li key={l.id}>
                  {l.name} <span className={muted}>· {l.owner} · {l.status === "in" ? "in" : "waiting to be let in"}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {team.whiteLabel && teamCan(my, "setBrand") && <Brand teamId={teamId} brand={team.brand} run={run} />}
      {teamCan(my, "seeAudit") && <Audit teamId={teamId} />}

      <section className={`border-b ${line} px-4 py-12 sm:px-10`}>
        {my === "owner" ? (
          <button
            className={quiet}
            onClick={() => {
              if (window.confirm(`Delete ${team.name}? Everyone leaves it, its laptops stop sharing, and its audit log is deleted. This can't be undone.`))
                void run(async () => {
                  await remove({ teamId });
                  onGone();
                });
            }}
          >
            Delete the team
          </button>
        ) : (
          <button
            className={quiet}
            onClick={() => {
              if (window.confirm(`Leave ${team.name}? Your laptops stop getting what it shares.`))
                void run(async () => {
                  await leave({ teamId });
                  onGone();
                });
            }}
          >
            Leave the team
          </button>
        )}
      </section>
    </>
  );
}

function Invites({
  teamId,
  my,
  invites,
  run,
}: {
  teamId: Id<"teams">;
  my: TeamRole;
  invites: { id: Id<"teamInvites">; role: TeamRole; expiresAt: number }[];
  run: (job: () => Promise<unknown>) => Promise<void>;
}) {
  const invite = useAction(api.teams.invite);
  const revoke = useMutation(api.teams.revokeInvite);
  const roles = (["member", "viewer", "admin"] as RoleChoice[]).filter((r) => canInviteAs(my, r));
  const [role, setRole] = useState<RoleChoice>("member");
  const [link, setLink] = useState<string | null>(null);
  return (
    <section className={`border-b ${line} px-4 py-12 sm:px-10`}>
      <h3 className="text-xl font-medium">Invite someone</h3>
      <p className={`mt-2 text-sm ${muted}`}>
        An invite link works once, for a week, and holds a seat until then. Send it yourself; we keep only a fingerprint of it.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <select aria-label="Role for the invite" className={field} value={role} onChange={(e) => setRole(e.target.value as RoleChoice)}>
          {roles.map((r) => (
            <option key={r} value={r}>
              {TEAM_ROLE_LABELS[r].name}
            </option>
          ))}
        </select>
        <button
          className={button}
          onClick={() =>
            run(async () => {
              const { code } = await invite({ teamId, role });
              // The code goes after #, so it never reaches a server or its logs when opened.
              setLink(`${window.location.origin}/join#${code}`);
            })
          }
        >
          Make an invite link
        </button>
      </div>
      {link && (
        <p className="mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-[#ffece8] px-4 py-3 text-sm dark:bg-[#2e1310]">
          <code className="break-all">{link}</code>
          <button className={quiet} onClick={() => void navigator.clipboard.writeText(link)}>
            Copy
          </button>
          <span className={muted}>Shown once.</span>
        </p>
      )}
      {invites.length > 0 && (
        <ul className="mt-4 space-y-1 text-sm">
          {invites.map((i) => (
            <li key={i.id}>
              {TEAM_ROLE_LABELS[i.role].name} invite <span className={muted}>· until {when(i.expiresAt)}</span>{" "}
              <button className={quiet} onClick={() => run(() => revoke({ inviteId: i.id }))}>
                Cancel
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Audit({ teamId }: { teamId: Id<"teams"> }) {
  const rows = useQuery(api.teams.auditLog, { teamId });
  return (
    <section className={`border-b ${line} px-4 py-12 sm:px-10`}>
      <h3 className="text-xl font-medium">Audit log</h3>
      <p className={`mt-2 text-sm ${muted}`}>
        Who did what, newest first. It can&apos;t be edited. What was shared is sealed: the team&apos;s laptops show it, this page doesn&apos;t.
      </p>
      {!rows ? (
        <p className={`mt-4 text-sm ${muted}`}>Loading…</p>
      ) : (
        <ul className="mt-4 space-y-1 text-sm">
          {rows.map((r) => (
            <li key={r.id}>
              <span className={`${muted} font-mono text-xs`}>{when(r.at)}</span> <span className="font-medium">{r.actor}</span>{" "}
              {TEAM_AUDIT_LABELS[r.action as TeamAuditAction] ?? r.action}
              {r.target ? `: ${r.target}` : ""}
              {r.role ? ` (${TEAM_ROLE_LABELS[r.role].name.toLowerCase()})` : ""}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Brand({
  teamId,
  brand,
  run,
}: {
  teamId: Id<"teams">;
  brand: { name: string; accent: string; hideMadeWith: boolean; logoUrl: string | null } | null;
  run: (job: () => Promise<unknown>) => Promise<void>;
}) {
  const setBrand = useMutation(api.teams.setBrand);
  const uploadUrl = useMutation(api.teams.logoUploadUrl);
  const [name, setName] = useState(brand?.name ?? "");
  const [accent, setAccent] = useState(brand?.accent ?? "#1a5fd0");
  const [logo, setLogo] = useState<File | null>(null);
  const problem = brandProblem({ name, accent, hideMadeWith: false });
  const logoProblem =
    logo && (!(BRAND_LOGO_TYPES as readonly string[]).includes(logo.type) || logo.size > BRAND_LOGO_MAX_BYTES)
      ? "The logo must be a PNG, WebP or JPEG of at most 200 KB."
      : null;
  return (
    <section className={`border-b ${line} px-4 py-12 sm:px-10`}>
      <h3 className="text-xl font-medium">Your brand (white-label)</h3>
      <p className={`mt-2 text-sm ${muted}`}>
        Shown to this team in their Titan117 app&apos;s header and on the pages they share. &ldquo;Made with Titan117&rdquo; stays on shared pages.
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Name
          <input className={field} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Colour
          <span className="flex items-center gap-2">
            <input type="color" aria-label="Pick a colour" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-10 w-12" />
            <input className={`${field} w-28 font-mono`} value={accent} onChange={(e) => setAccent(e.target.value)} />
          </span>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Logo
          <input type="file" accept={BRAND_LOGO_TYPES.join(",")} onChange={(e) => setLogo(e.target.files?.[0] ?? null)} />
        </label>
        <span className="rounded-[10px] px-4 py-2 text-sm font-medium text-white" style={{ background: /^#[0-9a-f]{6}$/i.test(accent) ? accent : "#999" }}>
          Preview
        </span>
      </div>
      {(problem || logoProblem) && <p className="mt-3 text-sm text-[#c2361f]">{problem ?? logoProblem}</p>}
      <div className="mt-4 flex gap-4">
        <button
          className={button}
          disabled={!!problem || !!logoProblem}
          onClick={() =>
            run(async () => {
              let logoId: Id<"_storage"> | undefined;
              if (logo) {
                const res = await fetch(await uploadUrl({ teamId }), { method: "POST", headers: { "Content-Type": logo.type }, body: logo });
                logoId = ((await res.json()) as { storageId: Id<"_storage"> }).storageId;
              }
              await setBrand({ teamId, brand: { name, accent, hideMadeWith: false }, ...(logoId ? { logoId } : {}) });
            })
          }
        >
          Save the brand
        </button>
        {brand && (
          <button className={quiet} onClick={() => run(() => setBrand({ teamId, brand: null }))}>
            Remove it
          </button>
        )}
      </div>
    </section>
  );
}
