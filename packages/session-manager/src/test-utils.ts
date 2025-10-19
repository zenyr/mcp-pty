import { type SessionManager, sessionManager } from "./index.ts";

// Wrapper that tracks created sessions per test
class SessionTracker {
  private createdSessions = new Set<string>();

  createSession(): string {
    const id = sessionManager.createSession();
    this.createdSessions.add(id);
    return id;
  }

  async disposeAll(): Promise<void> {
    // Only cleanup sessions THIS test created
    for (const sessionId of Array.from(this.createdSessions)) {
      await sessionManager.disposeSession(sessionId).catch(() => {
        /* suppress cleanup errors */
      });
    }
    this.createdSessions.clear();
  }

  getTrackedManager(): SessionManager {
    // Return a proxy that wraps createSession
    const self = this;
    return new Proxy(sessionManager, {
      get(target, prop) {
        if (prop === "createSession") {
          return () => self.createSession();
        }
        return Reflect.get(target, prop);
      },
    }) as SessionManager;
  }
}

/**
 * Execute test with isolated session on singleton manager.
 * Tracks only sessions created by THIS test, cleans them up after.
 * Concurrent safe - each test only cleans up its own sessions.
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
  const tracker = new SessionTracker();

  try {
    return await cb(tracker.getTrackedManager());
  } finally {
    await tracker.disposeAll();
  }
};
