import { describe, expect, test } from "bun:test";
import { normalizeWorkingDirectory } from "../path";

describe("normalizeWorkingDirectory", () => {
  test("expands tilde (~) alone to home directory", () => {
    const result = normalizeWorkingDirectory("~");
    expect(result).toBe(process.env.HOME || "");
  });

  test("expands tilde with slash (~/foo) to home directory", () => {
    const result = normalizeWorkingDirectory("~/foo");
    expect(result).toBe(`${process.env.HOME || ""}/foo`);
  });

  test("rejects ~username patterns (security)", () => {
    expect(() => normalizeWorkingDirectory("~user/path")).toThrow(
      "Working directory must be an absolute path or start with ~",
    );
  });

  test("does NOT expand tilde in middle of path", () => {
    const result = normalizeWorkingDirectory("/foo/~/bar");
    expect(result).toBe("/foo/~/bar");
  });

  test("rejects relative path (.)", () => {
    expect(() => normalizeWorkingDirectory(".")).toThrow(
      "Working directory must be an absolute path or start with ~",
    );
  });

  test("rejects relative path (..)", () => {
    expect(() => normalizeWorkingDirectory("..")).toThrow(
      "Working directory must be an absolute path or start with ~",
    );
  });

  test("rejects relative path (./foo)", () => {
    expect(() => normalizeWorkingDirectory("./foo")).toThrow(
      "Working directory must be an absolute path or start with ~",
    );
  });

  test("rejects relative path without prefix (foo)", () => {
    expect(() => normalizeWorkingDirectory("foo")).toThrow(
      "Working directory must be an absolute path or start with ~",
    );
  });

  test("keeps absolute path unchanged", () => {
    const result = normalizeWorkingDirectory("/absolute/path");
    expect(result).toBe("/absolute/path");
  });

  test("trims leading whitespace", () => {
    const result = normalizeWorkingDirectory("  /foo/bar");
    expect(result).toBe("/foo/bar");
  });

  test("trims trailing whitespace", () => {
    const result = normalizeWorkingDirectory("/foo/bar  ");
    expect(result).toBe("/foo/bar");
  });

  test("trims both leading and trailing whitespace", () => {
    const result = normalizeWorkingDirectory("  /foo/bar  ");
    expect(result).toBe("/foo/bar");
  });

  test("throws error for empty string", () => {
    expect(() => normalizeWorkingDirectory("")).toThrow(
      "Working directory path cannot be empty",
    );
  });

  test("throws error for whitespace-only string", () => {
    expect(() => normalizeWorkingDirectory("   ")).toThrow(
      "Working directory path cannot be empty",
    );
  });

  test("handles path with spaces correctly", () => {
    const result = normalizeWorkingDirectory("/path with spaces");
    expect(result).toBe("/path with spaces");
  });

  test("handles tilde with relative path after expansion", () => {
    const result = normalizeWorkingDirectory("~/./foo");
    expect(result).toBe(`${process.env.HOME || ""}/foo`);
  });

  test("handles complex relative path with tilde", () => {
    const result = normalizeWorkingDirectory("~/../foo");
    expect(result).not.toContain("~");
    expect(result).toContain("/foo");
  });
});
