import { z } from "zod";

/**
 * MCP server configuration interface
 */
export interface McpServerConfig {
  name: string;
  version: string;
  deactivateResources?: boolean;
}

/**
 * PTY tool input schemas
 */
export const StartPtyInputSchema = z.object({
  sessionId: z.string(),
  command: z.string(),
});

export const KillPtyInputSchema = z.object({
  sessionId: z.string(),
  processId: z.string(),
});

export const ListPtyInputSchema = z.object({ sessionId: z.string() });

export const ReadPtyInputSchema = z.object({
  sessionId: z.string(),
  processId: z.string(),
});

/**
 * PTY tool output schemas
 */
export const StartPtyOutputSchema = z.object({ processId: z.string() });

export const KillPtyOutputSchema = z.object({ success: z.boolean() });

export const ListPtyOutputSchema = z.object({
  ptys: z.array(z.any()), // TODO: Proper schema
});

export const ReadPtyOutputSchema = z.object({ output: z.string() });

/**
 * Transport type
 */
export type TransportType = "stdio" | "http";

/**
 * Server status
 */
export interface ServerStatus {
  sessions: number;
  processes: number;
}

/**
 * Session status
 */
export interface SessionStatus {
  id: string;
  status: "active" | "terminated";
}
