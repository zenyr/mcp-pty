import { expect, test } from "bun:test";
import { normalizeCommand } from "../index";

test("normalizeCommand - single command without args", () => {
  const result = normalizeCommand("ls");
  expect(result).toBe('{"command":"ls","args":[]}');
});

test("normalizeCommand - single command with args", () => {
  const result = normalizeCommand("ls -la");
  expect(result).toBe('{"command":"ls","args":["-la"]}');
});

test("normalizeCommand - multiple args", () => {
  const result = normalizeCommand("echo hello world");
  expect(result).toBe('{"command":"echo","args":["hello","world"]}');
});

test("normalizeCommand - pipeline with |", () => {
  const result = normalizeCommand("echo hello | grep h");
  expect(result).toBe('{"command":"sh","args":["-c","echo hello | grep h"]}');
});

test("normalizeCommand - logical AND", () => {
  const result = normalizeCommand("echo start && echo end");
  expect(result).toBe(
    '{"command":"sh","args":["-c","echo start && echo end"]}',
  );
});

test("normalizeCommand - logical OR", () => {
  const result = normalizeCommand("false || echo fallback");
  expect(result).toBe(
    '{"command":"sh","args":["-c","false || echo fallback"]}',
  );
});

test("normalizeCommand - semicolon", () => {
  const result = normalizeCommand("echo first; echo second");
  expect(result).toBe(
    '{"command":"sh","args":["-c","echo first; echo second"]}',
  );
});

test("normalizeCommand - redirection >", () => {
  const result = normalizeCommand("echo hello > file.txt");
  expect(result).toBe('{"command":"sh","args":["-c","echo hello > file.txt"]}');
});

test("normalizeCommand - redirection >>", () => {
  const result = normalizeCommand("echo hello >> file.txt");
  expect(result).toBe(
    '{"command":"sh","args":["-c","echo hello >> file.txt"]}',
  );
});

test("normalizeCommand - input redirection <", () => {
  const result = normalizeCommand("cat < file.txt");
  expect(result).toBe('{"command":"sh","args":["-c","cat < file.txt"]}');
});

test("normalizeCommand - here document <<", () => {
  const result = normalizeCommand("cat << EOF\nhello\nEOF");
  expect(result).toBe(
    '{"command":"sh","args":["-c","cat << EOF\\nhello\\nEOF"]}',
  );
});

test("normalizeCommand - complex pipeline", () => {
  const result = normalizeCommand("ls | grep .txt | sort");
  expect(result).toBe('{"command":"sh","args":["-c","ls | grep .txt | sort"]}');
});

test("normalizeCommand - with quotes (single command)", () => {
  const result = normalizeCommand('echo "hello world"');
  expect(result).toBe('{"command":"echo","args":["hello world"]}');
});

test("normalizeCommand - quotes with operators inside (requires shell due to quotes)", () => {
  const result = normalizeCommand('echo "foo&&bar"');
  expect(result).toBe('{"command":"sh","args":["-c","echo \\"foo&&bar\\""]}');
});

test("normalizeCommand - multiline single command", () => {
  const result = normalizeCommand("echo hello\nworld");
  expect(result).toBe('{"command":"sh","args":["-c","echo hello\\nworld"]}');
});

test("normalizeCommand - heredoc", () => {
  const result = normalizeCommand("cat << EOF\nhello\nworld\nEOF");
  expect(result).toBe(
    '{"command":"sh","args":["-c","cat << EOF\\nhello\\nworld\\nEOF"]}',
  );
});

test("normalizeCommand - empty string", () => {
  const result = normalizeCommand("");
  expect(result).toBe('{"command":"","args":[]}');
});

test("normalizeCommand - only whitespace", () => {
  const result = normalizeCommand("   ");
  expect(result).toBe('{"command":"","args":[]}');
});
