import type { z } from "zod";
import { resolveControlCode } from "../../types/control-codes";
import { normalizeWorkingDirectory } from "../../utils";
import {
  type KillPtyInputSchema,
  type ListPtyInputSchema,
  type ReadPtyInputSchema,
  type StartPtyInputSchema,
  WriteInputSchema,
} from "../schemas";
import type { HandlerContext, ToolResult } from "../types";

/**
 * Tool handler: start PTY
 * satisfies ensures args type matches schema, enabling full type inference
 */
export const startToolHandler = (async (
  args: z.infer<typeof StartPtyInputSchema>,
  context: HandlerContext,
) => {
  const { command, pwd } = args;
  const { sessionManager, sessionId } = context;

  const ptyManager = sessionManager.getPtyManager(sessionId);
  if (!ptyManager) throw new Error("Session not found");

  const cwd = normalizeWorkingDirectory(pwd);
  let stat: Awaited<ReturnType<typeof Bun.file.prototype.stat>>;
  try {
    stat = await Bun.file(cwd).stat();
  } catch (_error) {
    throw new Error(
      `Working directory does not exist or is inaccessible: ${cwd}`,
    );
  }

  if (!stat.isDirectory()) {
    throw new Error(`Path is not a directory: ${cwd}`);
  }

  const { processId, screen, exitCode } = await ptyManager.createPty({
    command,
    cwd,
  });

  sessionManager.addPty(sessionId, processId);

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ processId, screen, exitCode }),
      },
    ],
    structuredContent: { processId, screen, exitCode },
  };
}) satisfies (
  args: z.infer<typeof StartPtyInputSchema>,
  context: HandlerContext,
) => ToolResult | Promise<ToolResult>;

/**
 * Tool handler: kill PTY
 */
export const killToolHandler = (async (
  args: z.infer<typeof KillPtyInputSchema>,
  context: HandlerContext,
) => {
  const { processId } = args;
  const { sessionManager, sessionId } = context;

  const ptyManager = sessionManager.getPtyManager(sessionId);
  if (!ptyManager) throw new Error("Session not found");

  const success = ptyManager.removePty(processId);
  if (success) sessionManager.removePty(sessionId, processId);

  return {
    content: [{ type: "text" as const, text: JSON.stringify({ success }) }],
    structuredContent: { success },
  };
}) satisfies (
  args: z.infer<typeof KillPtyInputSchema>,
  context: HandlerContext,
) => ToolResult | Promise<ToolResult>;

/**
 * Tool handler: list PTYs
 */
export const listToolHandler = (async (
  _args: z.infer<typeof ListPtyInputSchema>,
  context: HandlerContext,
) => {
  const { sessionManager, sessionId } = context;

  const ptyManager = sessionManager.getPtyManager(sessionId);
  if (!ptyManager) throw new Error("Session not found");

  const ptys = ptyManager
    .getAllPtys()
    .map((pty) => ({
      id: pty.id,
      status: pty.status,
      createdAt: pty.createdAt.toISOString(),
      lastActivity: pty.lastActivity.toISOString(),
      exitCode: pty.getExitCode(),
    }));

  return {
    content: [{ type: "text" as const, text: JSON.stringify({ ptys }) }],
    structuredContent: { ptys },
  };
}) satisfies (
  args: z.infer<typeof ListPtyInputSchema>,
  context: HandlerContext,
) => ToolResult | Promise<ToolResult>;

/**
 * Tool handler: read PTY buffer
 */
export const readToolHandler = (async (
  args: z.infer<typeof ReadPtyInputSchema>,
  context: HandlerContext,
) => {
  const { processId } = args;
  const { sessionManager, sessionId } = context;

  const ptyManager = sessionManager.getPtyManager(sessionId);
  if (!ptyManager) throw new Error("Session not found");

  const pty = ptyManager.getPty(processId);
  if (!pty) throw new Error("PTY not found");

  const screen = pty.captureBuffer().join("\n").trimEnd();

  return {
    content: [{ type: "text" as const, text: JSON.stringify({ screen }) }],
    structuredContent: { screen },
  };
}) satisfies (
  args: z.infer<typeof ReadPtyInputSchema>,
  context: HandlerContext,
) => ToolResult | Promise<ToolResult>;

/**
 * Tool handler: write input to PTY
 */
export const writeInputToolHandler = (async (
  args: z.infer<typeof WriteInputSchema>,
  context: HandlerContext,
) => {
  const { processId, input, ctrlCode, data, waitMs = 1000 } = args;
  const { sessionManager, sessionId } = context;

  const ptyManager = sessionManager.getPtyManager(sessionId);
  if (!ptyManager) throw new Error("Session not found");

  const pty = ptyManager.getPty(processId);
  if (!pty) throw new Error("PTY not found");

  // Validate input parameters
  const validationResult = WriteInputSchema.safeParse({
    processId,
    input,
    ctrlCode,
    data,
    waitMs,
  });
  if (!validationResult.success) {
    throw new Error(
      `Invalid input: ${validationResult.error.issues
        .map((i) => i.message)
        .join(", ")}`,
    );
  }

  // At least one input mode required
  if (input === undefined && ctrlCode === undefined && data === undefined) {
    throw new Error(
      "At least one of 'input', 'ctrlCode', or 'data' must be provided",
    );
  }

  // data and (input/ctrlCode) are mutually exclusive
  const hasData = data !== undefined;
  const hasInputOrCtrl = input !== undefined || ctrlCode !== undefined;
  if (hasData && hasInputOrCtrl) {
    throw new Error(
      "Cannot use 'data' together with 'input' or 'ctrlCode'. Use either data (raw mode) OR input+ctrlCode (safe mode).",
    );
  }

  let finalData: string;
  if (data !== undefined) {
    finalData = data;
  } else {
    finalData = (input ?? "") + (ctrlCode ? resolveControlCode(ctrlCode) : "");
  }

  const result = await pty.write(finalData, waitMs);
  return {
    content: [{ type: "text" as const, text: JSON.stringify(result) }],
    structuredContent: result,
  };
}) satisfies (
  args: z.infer<typeof WriteInputSchema>,
  context: HandlerContext,
) => ToolResult | Promise<ToolResult>;

/**
 * Export tool handlers for registration
 */
export const toolHandlers = {
  start: startToolHandler,
  kill: killToolHandler,
  list: listToolHandler,
  read: readToolHandler,
  write_input: writeInputToolHandler,
} as const;
