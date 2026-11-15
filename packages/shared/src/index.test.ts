import { describe, expect, it } from "vitest";

import {
  creditsForCost,
  ERROR_CODES,
  isErrorCode,
  PLANS,
  planLookupKey,
  PROTOCOL_VERSION,
  TOPUPS,
  topupLookupKey,
} from "./index.js";

describe("@titan117/shared", () => {
  it("has a positive integer protocol version", () => {
    expect(Number.isInteger(PROTOCOL_VERSION) && PROTOCOL_VERSION > 0).toBe(true);
  });

  it("recognises only the known error codes", () => {
    for (const code of ERROR_CODES) expect(isErrorCode(code)).toBe(true);
    expect(isErrorCode("Error: stack trace")).toBe(false);
    expect(isErrorCode(undefined)).toBe(false);
  });
});

describe("plans and credits", () => {
  it("matches pricing.md", () => {
    expect([PLANS.starter.monthlyCredits, PLANS.pro.monthlyCredits, PLANS.max.monthlyCredits]).toEqual([700, 1500, 3500]);
    expect(TOPUPS.map((t) => t.credits)).toEqual([1000, 2750, 6000]);
  });

  it("names Stripe lookup keys predictably", () => {
    expect(planLookupKey("pro", "year")).toBe("titan117_pro_year");
    expect(topupLookupKey("topup_1000")).toBe("titan117_topup_1000");
  });

  it("charges provider cost × 1.25 in cents, rounded up", () => {
    expect(creditsForCost(0)).toBe(0);
    expect(creditsForCost(-1)).toBe(0);
    expect(creditsForCost(0.08)).toBe(10); // exactly 10, no float overshoot to 11
    expect(creditsForCost(0.015)).toBe(2); // 1.875 → 2
    expect(creditsForCost(0.0001)).toBe(1); // any paid call costs at least one credit
  });
});
