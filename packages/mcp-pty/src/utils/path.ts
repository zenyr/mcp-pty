import { isAbsolute, resolve } from "node:path";

/**
 * Normalize and validate working directory path
 * - ONLY accepts absolute paths or tilde (~) paths
 * - Expands tilde (~) to home directory ONLY at the start of path
 * - Trims whitespace
 * - Rejects relative paths (., .., ./foo, foo)
 * @param pwd - Working directory path (must be absolute or start with ~)
 * @returns Normalized absolute path
 * @throws {Error} if path is empty, relative, or invalid
 */
export const normalizeWorkingDirectory = (pwd: string): string => {
  // Trim whitespace
  const trimmed = pwd.trim();

  if (!trimmed) {
    throw new Error("Working directory path cannot be empty");
  }

  // Expand tilde ONLY at the very start of the path
  // Only expand ~ or ~/ patterns (NOT ~username)
  let normalized = trimmed;
  if (normalized === "~" || normalized.startsWith("~/")) {
    // Only expand if it's exactly ~ or starts with ~/
    // This prevents ~user expansion (security risk)
    normalized = normalized.replace(/^~(?=\/|$)/, process.env.HOME || "");
  }

  // Reject relative paths - must be absolute
  if (!isAbsolute(normalized)) {
    throw new Error(
      `Working directory must be an absolute path or start with ~. Received: ${trimmed}`,
    );
  }

  // Normalize the absolute path
  return resolve(normalized);
};
