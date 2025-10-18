import { expect, test } from "bun:test";
import { normalizeCommand } from "../index";

const testCases = [
  {
    input: "ls",
    expected: '{"command":"ls","args":[]}',
    description: "single command without args",
  },
  {
    input: "ls -la",
    expected: '{"command":"ls","args":["-la"]}',
    description: "single command with args",
  },
  {
    input: "echo hello world",
    expected: '{"command":"echo","args":["hello","world"]}',
    description: "multiple args",
  },
  {
    input: "echo hello | grep h",
    expected: '{"command":"sh","args":["-c","echo hello | grep h"]}',
    description: "pipeline with |",
  },
  {
    input: "echo start && echo end",
    expected: '{"command":"sh","args":["-c","echo start && echo end"]}',
    description: "logical AND",
  },
  {
    input: "false || echo fallback",
    expected: '{"command":"sh","args":["-c","false || echo fallback"]}',
    description: "logical OR",
  },
  {
    input: "echo first; echo second",
    expected: '{"command":"sh","args":["-c","echo first; echo second"]}',
    description: "semicolon",
  },
  {
    input: "echo hello > file.txt",
    expected: '{"command":"sh","args":["-c","echo hello > file.txt"]}',
    description: "redirection >",
  },
  {
    input: "echo hello >> file.txt",
    expected: '{"command":"sh","args":["-c","echo hello >> file.txt"]}',
    description: "redirection >>",
  },
  {
    input: "cat < file.txt",
    expected: '{"command":"sh","args":["-c","cat < file.txt"]}',
    description: "input redirection <",
  },
  {
    input: "cat << EOF\nhello\nEOF",
    expected: '{"command":"sh","args":["-c","cat << EOF\\nhello\\nEOF"]}',
    description: "here document <<",
  },
  {
    input: "ls | grep .txt | sort",
    expected: '{"command":"sh","args":["-c","ls | grep .txt | sort"]}',
    description: "complex pipeline",
  },
  {
    input: 'echo "hello world"',
    expected: '{"command":"echo","args":["hello world"]}',
    description: "with quotes (single command)",
  },
  {
    input: 'echo "foo&&bar"',
    expected: '{"command":"sh","args":["-c","echo \\"foo&&bar\\""]}',
    description: "quotes with operators inside (requires shell due to quotes)",
  },
  {
    input: "echo hello\nworld",
    expected: '{"command":"sh","args":["-c","echo hello\\nworld"]}',
    description: "multiline single command",
  },
  {
    input: "cat << EOF\nhello\nworld\nEOF",
    expected:
      '{"command":"sh","args":["-c","cat << EOF\\nhello\\nworld\\nEOF"]}',
    description: "heredoc",
  },
  {
    input: "",
    expected: '{"command":"","args":[]}',
    description: "empty string",
  },
  {
    input: "   ",
    expected: '{"command":"","args":[]}',
    description: "only whitespace",
  },
  {
    input: "DEBUG=1 echo foo",
    expected: '{"command":"sh","args":["-c","DEBUG=1 echo foo"]}',
    description: "environment variable assignment",
  },
  {
    input: "foo --cwd=1 bar baz",
    expected: '{"command":"foo","args":["--cwd=1","bar","baz"]}',
    description: "command with equals in args",
  },
  {
    input: "foo bar=1 baz",
    expected: '{"command":"foo","args":["bar=1","baz"]}',
    description: "command with equals in middle arg",
  },
  {
    input: "VAR1=1 VAR2=2 echo hello",
    expected: '{"command":"sh","args":["-c","VAR1=1 VAR2=2 echo hello"]}',
    description: "multiple environment variables",
  },
  {
    input: "DEBUG=1",
    expected: '{"command":"sh","args":["-c","DEBUG=1"]}',
    description: "environment variable without command",
  },
  {
    input: "A=1 B=2 C=3 echo test",
    expected: '{"command":"sh","args":["-c","A=1 B=2 C=3 echo test"]}',
    description: "multiple env vars with command",
  },
];

test.each(testCases)(
  "normalizeCommand - $description",
  ({ input, expected }) => {
    const result = normalizeCommand(input);
    expect(result).toBe(expected);
  },
);
