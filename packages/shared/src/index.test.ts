import { describe, expect, it } from "vitest";

import { ERROR_CODES, isErrorCode, PROTOCOL_VERSION } from "./index.js";

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
