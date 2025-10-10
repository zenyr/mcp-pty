import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { sessionManager } from "@pkgs/session-manager";
import { z } from "zod";

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
      inputSchema: { sessionId: z.string(), command: z.string() },
      outputSchema: { processId: z.string() },
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
      inputSchema: { sessionId: z.string(), processId: z.string() },
      outputSchema: { success: z.boolean() },
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
      inputSchema: { sessionId: z.string() },
      outputSchema: {
        ptys: z.array(z.any()), // TODO: Proper schema
      },
    },
    async ({ sessionId }: { sessionId: string }) => {
      const ptyManager = sessionManager.getPtyManager(sessionId);
      if (!ptyManager) throw new Error("Session not found");
      const ptys = ptyManager.getAllPtys();
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
      inputSchema: { sessionId: z.string(), processId: z.string() },
      outputSchema: { output: z.string() },
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
      // TODO: Get output
      const output = "PTY output here";
      return {
        content: [{ type: "text", text: JSON.stringify({ output }) }],
        structuredContent: { output },
      };
    },
  );

  // activate_pty_tools: TODO
};
