import { describe, expect, it } from "vitest";

import { PLANS, planAllowance, validSeats } from "./index.js";
import { brandProblem, canChangeMember, canInviteAs, cleanTeamName, contrastRatio, teamCan } from "./teams.js";

describe("team roles", () => {
  it("lets each role do only its own things", () => {
    expect(teamCan("viewer", "useItems")).toBe(true);
    expect(teamCan("viewer", "writeData")).toBe(false);
    expect(teamCan("viewer", "shareItems")).toBe(false);
    expect(teamCan("member", "shareItems")).toBe(true);
    expect(teamCan("member", "invite")).toBe(false);
    expect(teamCan("admin", "invite")).toBe(true);
    expect(teamCan("admin", "setBrand")).toBe(false);
    expect(teamCan("owner", "manageTeam")).toBe(true);
    expect(teamCan(null, "useItems")).toBe(false);
  });

  it("keeps the owner out of everyone's reach and admins to the owner", () => {
    expect(canChangeMember("owner", "owner", null)).toBe(false);
    expect(canChangeMember("admin", "owner", "member")).toBe(false);
    expect(canChangeMember("admin", "admin", null)).toBe(false);
    expect(canChangeMember("admin", "member", "admin")).toBe(false);
    expect(canChangeMember("admin", "member", "viewer")).toBe(true);
    expect(canChangeMember("admin", "viewer", null)).toBe(true);
    expect(canChangeMember("owner", "member", "admin")).toBe(true);
    expect(canChangeMember("member", "viewer", null)).toBe(false);
    expect(canInviteAs("admin", "admin")).toBe(false);
    expect(canInviteAs("owner", "admin")).toBe(true);
    expect(canInviteAs("owner", "owner")).toBe(false);
    expect(canInviteAs("member", "viewer")).toBe(false);
  });

  it("cleans names", () => {
    expect(cleanTeamName("  Acme <b>Ops</b>  ")).toBe("Acme bOpsb");
  });
});

describe("per-seat plans", () => {
  it("pool credits per seat and keep seats in range", () => {
    expect(planAllowance("pro")).toBe(1500);
    expect(planAllowance("team", 3)).toBe(3 * PLANS.team.monthlyCredits);
    expect(planAllowance("custom", 9)).toBe(0);
    expect(validSeats("team", 1)).toBe(false);
    expect(validSeats("team", 3)).toBe(true);
    expect(validSeats("team", 2.5)).toBe(false);
    expect(validSeats("pro", 1)).toBe(true);
    expect(validSeats("pro", 2)).toBe(false);
    expect(PLANS.agency.perSeat?.whiteLabel).toBe(true);
    expect(PLANS.team.perSeat?.whiteLabel).toBe(false);
  });
});

describe("brand", () => {
  it("measures contrast like WCAG", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrastRatio("#1a5fd0", "#ffffff")).toBeGreaterThan(4.5);
  });

  it("refuses unreadable colours and our own name", () => {
    const ok = { name: "Bright Agency", accent: "#1a5fd0", hideMadeWith: false };
    expect(brandProblem(ok)).toBeNull();
    expect(brandProblem({ ...ok, accent: "#ffcc00" })).toMatch(/hard to read/);
    expect(brandProblem({ ...ok, accent: "blue" })).toMatch(/#1a5fd0/);
    expect(brandProblem({ ...ok, name: "Titan 117 Pro" })).toMatch(/Titan117/);
    expect(brandProblem({ ...ok, name: "x" })).toMatch(/two letters/);
  });
});
