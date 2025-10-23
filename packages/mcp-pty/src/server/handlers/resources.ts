import type {
  HandlerContext,
  ResourceResult,
  FixedResourceHandler,
  TemplateResourceHandler,
} from "../types";

/**
 * Resource handler: server status (fixed URI)
 */
export const statusResourceHandler: FixedResourceHandler = async (
  _uri: URL,
  context: HandlerContext,
): Promise<ResourceResult> => {
  const { sessionManager } = context;

  return {
    contents: [
      {
        uri: "pty://status",
        text: JSON.stringify({
          sessions: sessionManager.getSessionCount(),
          processes: sessionManager
            .getAllSessions()
            .reduce((sum: number, session: { id: string }) => {
              const ptyManager = sessionManager.getPtyManager(session.id);
              return sum + (ptyManager ? ptyManager.getAllPtys().length : 0);
            }, 0),
        }),
      },
    ],
  };
};

/**
 * Resource handler: session processes (fixed URI)
 */
export const processesResourceHandler: FixedResourceHandler = async (
  _uri: URL,
  context: HandlerContext,
): Promise<ResourceResult> => {
  const { sessionManager, sessionId } = context;

  const ptyManager = sessionManager.getPtyManager(sessionId);
  if (!ptyManager) throw new Error("Session not found");

  const processes = ptyManager
    .getAllPtys()
    .map(
      (pty: {
        id: string;
        status: string;
        createdAt: Date;
        lastActivity: Date;
      }) => ({
        processId: pty.id,
        status: pty.status,
        createdAt: pty.createdAt.toISOString(),
        lastActivity: pty.lastActivity.toISOString(),
      }),
    );

  return {
    contents: [{ uri: "pty://processes", text: JSON.stringify({ processes }) }],
  };
};

/**
 * Resource handler: process output (template URI with {processId})
 */
export const processOutputResourceHandler: TemplateResourceHandler = async (
  uri: URL,
  variables: Record<string, string | string[]>,
  context: HandlerContext,
): Promise<ResourceResult> => {
  const { sessionManager, sessionId } = context;
  const processId = variables.processId;

  if (typeof processId !== "string") throw new Error("Invalid process id");

  const ptyManager = sessionManager.getPtyManager(sessionId);
  if (!ptyManager) throw new Error("Session not found");

  const pty = ptyManager.getPty(processId);
  if (!pty) throw new Error("PTY process not found");

  const output = pty.getOutputBuffer();
  return { contents: [{ uri: uri.href, text: JSON.stringify({ output }) }] };
};

/**
 * Export resource handlers for registration
 */
export const resourceHandlers = {
  status: statusResourceHandler,
  processes: processesResourceHandler,
  processOutput: processOutputResourceHandler,
} as const;
