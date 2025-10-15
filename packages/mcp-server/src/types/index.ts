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
 * sessionId is optional - automatically resolved from transport connection
 */
export const StartPtyInputSchema = z.object({
  command: z.string(),
  shellMode: z.boolean().optional(),
});

export const KillPtyInputSchema = z.object({ processId: z.string() });

export const ListPtyInputSchema = z.object({});

export const ReadPtyInputSchema = z.object({ processId: z.string() });

/**
 * PTY tool output schemas
 */
export const StartPtyOutputSchema = z.object({ processId: z.string() });

export const KillPtyOutputSchema = z.object({ success: z.boolean() });

export const PtyInfoSchema = z.object({
  id: z.string(),
  status: z.string(),
  createdAt: z.string(),
  lastActivity: z.string(),
});

export const ListPtyOutputSchema = z.object({ ptys: z.array(PtyInfoSchema) });

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
