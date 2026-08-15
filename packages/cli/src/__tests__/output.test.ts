import { describe, it, expect } from "vitest";
import { formatJSON, maskSecret } from "../output.js";

describe("formatJSON", () => {
  it("formats object as pretty JSON", () => {
    const result = formatJSON({ id: "box-1", status: "running" });
    expect(result).toBe(JSON.stringify({ id: "box-1", status: "running" }, null, 2));
  });

  it("formats array", () => {
    const result = formatJSON([1, 2, 3]);
    expect(result).toBe("[\n  1,\n  2,\n  3\n]");
  });

  it("formats null", () => {
    expect(formatJSON(null)).toBe("null");
  });
});

describe("maskSecret", () => {
  it("masks non-empty values with a fixed-width mask", () => {
    expect(maskSecret("supersecret")).toBe("••••••••");
    expect(maskSecret("x")).toBe("••••••••");
  });

  it("does not leak the original length", () => {
    expect(maskSecret("short")).toBe(maskSecret("a-much-longer-secret-value"));
  });

  it("renders empty values as (empty)", () => {
    expect(maskSecret("")).toBe("(empty)");
  });
});
