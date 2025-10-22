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
  // Track sessions created DURING this test via Proxy
  const createdSessions = new Set<string>();

  // Wrap sessionManager to intercept createSession, disposeSession, getAllSessions, getSessionCount
  const wrappedManager = new Proxy(sessionManager, {
    get(target, prop) {
      if (prop === "createSession") {
        return () => {
          const sessionId = target.createSession();
          createdSessions.add(sessionId);
          return sessionId;
        };
      }
      // Intercept disposeSession to remove from tracking
      if (prop === "disposeSession") {
        return async (sessionId: string) => {
          createdSessions.delete(sessionId);
          return target.disposeSession(sessionId);
        };
      }
      // Intercept getAllSessions to only return sessions created by this test
      if (prop === "getAllSessions") {
        return () => {
          const allSessions = target.getAllSessions();
          return allSessions.filter((s) => createdSessions.has(s.id));
        };
      }
      // Intercept getSessionCount to only count sessions created by this test
      if (prop === "getSessionCount") {
        return () => createdSessions.size;
      }
      return target[prop as keyof SessionManager];
    },
  });

  try {
    return await cb(wrappedManager);
  } finally {
    // Only cleanup sessions actually created by this test
    await Promise.all(
      Array.from(createdSessions).map((sessionId) =>
        sessionManager.disposeSession(sessionId).catch(() => {
          /* suppress cleanup errors */
        }),
      ),
    );
  }
};
