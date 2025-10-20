import { type SessionManager, sessionManager } from "./index.ts";

/**
 * Test utilities for SessionManager with COMPLETE isolation.
 * ZERO shared state between tests - uses singleton pattern for MCP server integration.
 * All state is per-session - isolated by sessionId.
 */

/**
 * Execute test with isolated session on singleton manager.
 * Creates fresh session, passes callback, disposes session after.
 * Concurrent safe - each test gets isolated sessionId.
 *
 * @example
 * ```ts
 * test("session", async () => {
 *   await withTestSessionManager(async (mgr) => {
 *     const id = mgr.createSession();
 *     expect(id).toBeDefined();
 *   });
 * });
 * ```
 */
export const withTestSessionManager = async <T>(
  cb: (manager: SessionManager) => T | Promise<T>,
): Promise<T> => {
  try {
    return await cb(sessionManager);
  } finally {
    // Cleanup all sessions created in this test
    const sessions = sessionManager.getAllSessions();
    await Promise.all(
      sessions.map((session) =>
        sessionManager.disposeSession(session.id).catch(() => {
          /* suppress cleanup errors */
        }),
      ),
    );
  }
};
