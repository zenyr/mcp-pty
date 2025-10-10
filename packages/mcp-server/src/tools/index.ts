import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { sessionManager } from "@pkgs/session-manager";
import {
  KillPtyInputSchema,
  KillPtyOutputSchema,
  ListPtyInputSchema,
  ListPtyOutputSchema,
  ReadPtyInputSchema,
  ReadPtyOutputSchema,
  StartPtyInputSchema,
  StartPtyOutputSchema,
} from "../types";

/**
 * Register PTY tools to the server
 * @param server McpServer instance
 */
export const registerPtyTools = (server: McpServer): void => {
  // Register start_pty tool
  server.registerTool(
    "start_pty",
    {
      title: "Start PTY",
      description: "Create new PTY instance",
      inputSchema: StartPtyInputSchema.shape,
      outputSchema: StartPtyOutputSchema.shape,
    },
    async ({ sessionId, command }: { sessionId: string; command: string }) => {
      const ptyManager = sessionManager.getPtyManager(sessionId);
      if (!ptyManager) throw new Error("Session not found");
      const processId = ptyManager.createPty(command);
      sessionManager.addPty(sessionId, processId);
      return {
        content: [{ type: "text", text: JSON.stringify({ processId }) }],
        structuredContent: { processId },
      };
    },
  );

  // Register kill_pty tool
  server.registerTool(
    "kill_pty",
    {
      title: "Kill PTY",
      description: "Terminate PTY instance",
      inputSchema: KillPtyInputSchema.shape,
      outputSchema: KillPtyOutputSchema.shape,
    },
    async ({
      sessionId,
      processId,
    }: {
      sessionId: string;
      processId: string;
    }) => {
      const ptyManager = sessionManager.getPtyManager(sessionId);
      if (!ptyManager) throw new Error("Session not found");
      const success = ptyManager.removePty(processId);
      if (success) sessionManager.removePty(sessionId, processId);
      return {
        content: [{ type: "text", text: JSON.stringify({ success }) }],
        structuredContent: { success },
      };
    },
  );

  // Register list_pty tool
  server.registerTool(
    "list_pty",
    {
      title: "List PTY",
      description: "List PTY processes",
      inputSchema: ListPtyInputSchema.shape,
      outputSchema: ListPtyOutputSchema.shape,
    },
    async ({ sessionId }: { sessionId: string }) => {
      const ptyManager = sessionManager.getPtyManager(sessionId);
      if (!ptyManager) throw new Error("Session not found");
      const ptys = ptyManager.getAllPtys().map((pty) => ({
        id: pty.id,
        status: pty.status,
        createdAt: pty.createdAt.toISOString(),
        lastActivity: pty.lastActivity.toISOString(),
      }));
      return {
        content: [{ type: "text", text: JSON.stringify({ ptys }) }],
        structuredContent: { ptys },
      };
    },
  );

  // Register read_pty tool
  server.registerTool(
    "read_pty",
    {
      title: "Read PTY",
      description: "Read PTY output",
      inputSchema: ReadPtyInputSchema.shape,
      outputSchema: ReadPtyOutputSchema.shape,
    },
    async ({
      sessionId,
      processId,
    }: {
      sessionId: string;
      processId: string;
    }) => {
      const ptyManager = sessionManager.getPtyManager(sessionId);
      if (!ptyManager) throw new Error("Session not found");
      const pty = ptyManager.getPty(processId);
      if (!pty) throw new Error("PTY not found");
      const output = pty.getOutputBuffer();
      return {
        content: [{ type: "text", text: JSON.stringify({ output }) }],
        structuredContent: { output },
      };
    },
  );

  // activate_pty_tools: TODO
};
