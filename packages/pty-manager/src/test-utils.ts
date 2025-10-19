import { PtyManager } from "./manager.ts";
import { PtyProcess } from "./process.ts";
import type { PtyOptions } from "./types/index.ts";

/**
 * Test utilities for PtyManager and PtyProcess with COMPLETE isolation.
 * ZERO shared state between tests - each test owns its resources.
 * All setup/cleanup happens within callback scope (no let/const pollution).
 */

/**
 * Execute test with isolated PtyManager.
 * Manager created, passed to callback, disposed after.
 * Concurrent safe - no shared variables.
 *
 * @example
 * ```ts
 * test("manager", async () => {
 *   await withTestPtyManager("session-1", async (mgr) => {
 *     const { processId } = await mgr.createPty("sh");
 *     expect(processId).toBeDefined();
 *   });
 * });
 * ```
 */
export const withTestPtyManager = async <T>(
  sessionId: string,
  cb: (manager: PtyManager) => T | Promise<T>,
): Promise<T> => {
  const manager = new PtyManager(sessionId);
  try {
    return await cb(manager);
  } finally {
    manager.dispose();
  }
};

/**
 * Execute test with isolated PtyProcess.
 * Process created, passed to callback, disposed after.
 * Concurrent safe - no shared variables.
 *
 * @example
 * ```ts
 * test("process", async () => {
 *   await withTestPtyProcess("cat", async (pty) => {
 *     const res = await pty.write("test\n");
 *     expect(res.screen).toContain("test");
 *   });
 * });
 * ```
 */
export const withTestPtyProcess = async <T>(
  command: string | PtyOptions,
  cb: (pty: PtyProcess) => T | Promise<T>,
): Promise<T> => {
  const pty = new PtyProcess(command);
  try {
    return await cb(pty);
  } finally {
    await pty.dispose().catch(() => {
      /* suppress cleanup errors */
    });
  }
};

/**
 * Execute test with isolated manager + multiple processes.
 * Concurrent safe - all resources scoped to callback.
 *
 * @example
 * ```ts
 * test("manager with ptys", async () => {
 *   await withTestPtyManagerAndProcesses(
 *     "session-1",
 *     ["sh", "cat"],
 *     async (mgr, ptys) => {
 *       expect(ptys).toHaveLength(2);
 *     }
 *   );
 * });
 * ```
 */
export const withTestPtyManagerAndProcesses = async <T>(
  sessionId: string,
  commands: string[],
  cb: (manager: PtyManager, processes: PtyProcess[]) => T | Promise<T>,
): Promise<T> => {
  const manager = new PtyManager(sessionId);
  const processes = commands.map((cmd) => new PtyProcess(cmd));

  try {
    return await cb(manager, processes);
  } finally {
    await Promise.all(
      processes.map((p) =>
        p.dispose().catch(() => {
          /* suppress */
        }),
      ),
    );
    manager.dispose();
  }
};
