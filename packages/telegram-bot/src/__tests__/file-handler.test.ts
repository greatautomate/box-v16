import { describe, it, expect } from "vitest";
import { safePath, parseZipArgs } from "../services/file-handler.js";

const ROOT = "/workspace/home";

describe("safePath", () => {
  it("defaults to the workspace root for empty input", () => {
    expect(safePath(undefined)).toBe(ROOT);
    expect(safePath(null)).toBe(ROOT);
    expect(safePath("")).toBe(ROOT);
    expect(safePath("   ")).toBe(ROOT);
  });

  it("resolves relative paths under the workspace root", () => {
    expect(safePath("src")).toBe(`${ROOT}/src`);
    expect(safePath("a/b/c")).toBe(`${ROOT}/a/b/c`);
  });

  it("collapses . and redundant slashes", () => {
    expect(safePath("./src/./app")).toBe(`${ROOT}/src/app`);
    expect(safePath("src//app///")).toBe(`${ROOT}/src/app`);
  });

  it("contains traversal attempts inside the workspace root", () => {
    expect(safePath("../../etc/passwd")).toBe(ROOT);
    expect(safePath("/etc/passwd")).toBe(ROOT);
    expect(safePath("a/../../..")).toBe(ROOT);
    expect(safePath("project/../sibling")).toBe(`${ROOT}/sibling`);
  });

  it("keeps absolute paths already inside the root", () => {
    expect(safePath(`${ROOT}/project`)).toBe(`${ROOT}/project`);
  });
});

describe("parseZipArgs", () => {
  it("treats empty args as 'all'", () => {
    expect(parseZipArgs("")).toEqual({ mode: "all", paths: [] });
  });

  it("recognizes natural-language intent", () => {
    expect(parseZipArgs("the whole project").mode).toBe("all");
    expect(parseZipArgs("send everything").mode).toBe("all");
  });

  it("recognizes path-like tokens", () => {
    expect(parseZipArgs("src/index.ts")).toEqual({
      mode: "paths",
      paths: ["src/index.ts"],
    });
    expect(parseZipArgs("./dist package.json").mode).toBe("paths");
  });

  it("falls back to help for ambiguous input", () => {
    expect(parseZipArgs("foobar").mode).toBe("help");
  });
});
