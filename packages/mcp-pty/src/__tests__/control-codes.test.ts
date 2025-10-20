import { describe, expect, test } from "bun:test";
import {
  CONTROL_CODES,
  getAvailableControlCodes,
  isControlCodeName,
  resolveControlCode,
} from "../types/control-codes";

describe("Control Codes", () => {
  test("CONTROL_CODES contains essential codes", () => {
    expect(CONTROL_CODES.Enter).toBe("\n");
    expect(CONTROL_CODES["Ctrl+C"]).toBe("\x03");
    expect(CONTROL_CODES.Escape).toBe("\x1b");
    expect(CONTROL_CODES.Tab).toBe("\t");
  });

  test("isControlCodeName validates names correctly", () => {
    expect(isControlCodeName("Enter")).toBe(true);
    expect(isControlCodeName("Ctrl+C")).toBe(true);
    expect(isControlCodeName("InvalidCode")).toBe(false);
    expect(isControlCodeName("\n")).toBe(false);
  });

  test("resolveControlCode handles named codes", () => {
    expect(resolveControlCode("Enter")).toBe("\n");
    expect(resolveControlCode("Escape")).toBe("\x1b");
    expect(resolveControlCode("Ctrl+C")).toBe("\x03");
    expect(resolveControlCode("ArrowUp")).toBe("\x1b[A");
  });

  test("resolveControlCode handles raw sequences", () => {
    expect(resolveControlCode("\n")).toBe("\n");
    expect(resolveControlCode("\x1b")).toBe("\x1b");
    expect(resolveControlCode("\x03")).toBe("\x03");
    expect(resolveControlCode("\r")).toBe("\r");
  });

  test("resolveControlCode rejects invalid long strings", () => {
    expect(() => resolveControlCode("this is too long")).toThrow();
    expect(() => resolveControlCode("InvalidCodeName")).toThrow();
  });

  test("getAvailableControlCodes returns all codes", () => {
    const codes = getAvailableControlCodes();
    expect(codes).toContain("Enter");
    expect(codes).toContain("Escape");
    expect(codes).toContain("Ctrl+C");
    expect(codes.length).toBeGreaterThan(10);
  });

  test("Control code byte values are correct", () => {
    expect(CONTROL_CODES.Enter.charCodeAt(0)).toBe(0x0a);
    expect(CONTROL_CODES["Ctrl+C"].charCodeAt(0)).toBe(0x03);
    expect(CONTROL_CODES.Escape.charCodeAt(0)).toBe(0x1b);
    expect(CONTROL_CODES["Ctrl+D"].charCodeAt(0)).toBe(0x04);
  });

  test("Arrow keys use ANSI escape sequences", () => {
    expect(CONTROL_CODES.ArrowUp).toBe("\x1b[A");
    expect(CONTROL_CODES.ArrowDown).toBe("\x1b[B");
    expect(CONTROL_CODES.ArrowRight).toBe("\x1b[C");
    expect(CONTROL_CODES.ArrowLeft).toBe("\x1b[D");
  });

  test("Aliases work correctly", () => {
    expect(CONTROL_CODES.EOF).toBe(CONTROL_CODES["Ctrl+D"]);
    expect(CONTROL_CODES.Interrupt).toBe(CONTROL_CODES["Ctrl+C"]);
    expect(CONTROL_CODES["Ctrl+["]).toBe(CONTROL_CODES.Escape);
  });
});
