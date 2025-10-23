import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { resourceHandlers } from "./handlers/resources";
import { toolHandlers } from "./handlers/tools";
import {
  KillPtyInputSchema,
  KillPtyOutputSchema,
  ListPtyInputSchema,
  ListPtyOutputSchema,
  ReadPtyInputSchema,
  ReadPtyOutputSchema,
  StartPtyInputSchema,
  StartPtyOutputSchema,
  WriteInputOutputSchema,
  WriteInputSchema,
} from "./schemas";
import type { HandlerContext } from "./types";

/**
 * Register all PTY tools to MCP server
 * Each tool uses registerTool with full schema and description
 */
export const registerTools = (
  server: McpServer,
  context: HandlerContext,
): void => {
  // Start PTY tool
  server.registerTool(
    "start",
    {
      title: "Start PTY",
      description:
        "Create PTY, execute command, return processId & screen. Supports bash/python/node, dev servers, vim/htop, shell cmds. Use write_input for stdin, read for output, kill to terminate.",
      inputSchema: StartPtyInputSchema.shape,
      outputSchema: StartPtyOutputSchema.shape,
    },
    async (args, extra) => {
      // Fallback to bound sessionId for HTTP session recovery scenarios
      // where extra.sessionId might be undefined during reconnection
      return toolHandlers.start(args, {
        ...context,
        sessionId: extra.sessionId || context.sessionId,
      });
    },
  );

  // Kill PTY tool
  server.registerTool(
    "kill",
    {
      title: "Kill PTY",
      description: "Terminate PTY process",
      inputSchema: KillPtyInputSchema.shape,
      outputSchema: KillPtyOutputSchema.shape,
    },
    async (args, extra) => {
      // Fallback to bound sessionId for HTTP session recovery
      return toolHandlers.kill(args, {
        ...context,
        sessionId: extra.sessionId || context.sessionId,
      });
    },
  );

  // List PTYs tool
  server.registerTool(
    "list",
    {
      title: "List PTYs",
      description: "List running PTY processes in session",
      inputSchema: ListPtyInputSchema.shape,
      outputSchema: ListPtyOutputSchema.shape,
    },
    async (args, extra) => {
      // Fallback to bound sessionId for HTTP session recovery
      return toolHandlers.list(args, {
        ...context,
        sessionId: extra.sessionId || context.sessionId,
      });
    },
  );

  // Read PTY tool
  server.registerTool(
    "read",
    {
      title: "Read PTY",
      description: "Read PTY screen buffer",
      inputSchema: ReadPtyInputSchema.shape,
      outputSchema: ReadPtyOutputSchema.shape,
    },
    async (args, extra) => {
      // Fallback to bound sessionId for HTTP session recovery
      return toolHandlers.read(args, {
        ...context,
        sessionId: extra.sessionId || context.sessionId,
      });
    },
  );

  // Write Input tool
  server.registerTool(
    "write_input",
    {
      title: "Write Input to PTY",
      description:
        "Send input to PTY stdin, return screen state. Two modes: Safe (input + ctrlCode) or Raw (data). Ex: {input: 'ls', ctrlCode: 'Enter'} or {data: 'ls\\n'}. Windows SSH: use CRLF (\\r\\n) not LF.",
      inputSchema: WriteInputSchema.shape,
      outputSchema: WriteInputOutputSchema.shape,
    },
    async (args, extra) => {
      // Fallback to bound sessionId for HTTP session recovery
      return toolHandlers.write_input(args, {
        ...context,
        sessionId: extra.sessionId || context.sessionId,
      });
    },
  );
};

/**
 * Register all PTY resources to MCP server
 * Mix of fixed URI and template-based resources
 */
export const registerResources = (
  server: McpServer,
  context: HandlerContext,
): void => {
  // Status resource (fixed URI)
  server.registerResource(
    "status",
    "pty://status",
    { title: "Server Status", description: "Session & process counts" },
    async (uri: URL) => {
      return resourceHandlers.status(uri, context);
    },
  );

  // Processes resource (fixed URI)
  server.registerResource(
    "processes",
    "pty://processes",
    { title: "Session Processes", description: "List running PTYs in session" },
    async (uri: URL) => {
      return resourceHandlers.processes(uri, context);
    },
  );

  // Process output resource (template URI)
  server.registerResource(
    "process-output",
    new ResourceTemplate("pty://processes/{processId}", { list: undefined }),
    { title: "Process Output", description: "Output buffer for PTY process" },
    async (uri: URL, variables: Record<string, string | string[]>) => {
      return resourceHandlers.processOutput(uri, variables, context);
    },
  );
};
