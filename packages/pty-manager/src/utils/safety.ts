/**
 * Safety utility for root privilege execution
 *
 * User consent-based safeguard to prevent PTY processes from running with root privileges in MCP-PTY.
 *
 * @remarks
 * This module references Prisma's ai-safety.ts implementation to provide root privilege detection and user consent enforcement.
 */

const dangerousConsentEnvVar = "MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS";

/**
 * Safety consent validation helper
 *
 * Validates user consent via specified environment variable and outputs warning if valid.
 *
 * @param envVar - Environment variable name for consent check
 * @param action - Action description (for warning message)
 * @returns true if consent is valid, false otherwise
 */
export const validateConsent = (envVar: string, action: string): boolean => {
  const userConsent = process.env[envVar];
  if (userConsent?.trim()) {
    console.warn(
      `⚠️  ${action} allowed by explicit user consent: "${userConsent}"`
    );
    return true;
  }
  return false;
};

/**
 * Root privilege execution prohibition error message
 *
 * Message displayed when MCP-PTY detects running with root privileges.
 * Guides user to set MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS environment variable if explicitly consenting.
 */
const rootPermissionErrorPrompt = `\
MCP-PTY detected that it is running with root privileges.

This is a highly dangerous configuration that can lead to security vulnerabilities \
and potential system compromise. Root access should be avoided unless absolutely necessary.

If you are certain that running MCP-PTY with root privileges is required for your use case \
and you understand the security implications, you may explicitly consent by setting the \
${dangerousConsentEnvVar} environment variable with a clear consent message.

Example:
export ${dangerousConsentEnvVar}="I understand the risks and explicitly allow dangerous actions in MCP-PTY"

Please ensure you have reviewed the security implications and consider running with \
reduced privileges or using process isolation mechanisms instead.`;

/**
 * Sudo command execution prohibition error message
 *
 * Message displayed when MCP-PTY detects attempt to execute sudo command.
 * Guides user to set MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS environment variable if explicitly consenting.
 */
const sudoPermissionErrorPrompt = `\
MCP-PTY detected an attempt to execute a sudo command in the PTY session.

This is a dangerous operation as it attempts to escalate privileges within the isolated PTY environment, \
which can lead to unintended system modifications or security risks.

If you are certain that sudo access is required for your use case and you understand the security implications, \
you may explicitly consent by setting the ${dangerousConsentEnvVar} environment variable with a clear consent message.

Example:
export ${dangerousConsentEnvVar}="I understand the risks and explicitly allow dangerous actions in MCP-PTY"

Please ensure you have reviewed the security implications and consider using alternative methods \
for privilege escalation outside of PTY sessions.`;

/**
 * Safety checkpoint for root privilege execution
 *
 * Checks if process is running with root privileges and throws error if no user consent (MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS environment variable).
 *
 * @throws {Error} When running with root privileges but no consent
 *
 * @example
 * ```ts
 * import { checkRootPermission } from './utils/safety'
 *
 * // Call before creating PTY
 * checkRootPermission()
 * ```
 */
export const checkRootPermission = (): void => {
  // Check if root privilege (geteuid 0 means root)
  if (process.geteuid && process.geteuid() === 0) {
    if (
      !validateConsent(
        dangerousConsentEnvVar,
        "MCP-PTY running with root privileges"
      )
    ) {
      throw new Error(rootPermissionErrorPrompt);
    }
  }
};

/**
 * Utility to detect sudo command execution attempts
 *
 * Detects commands starting with sudo in PTY and throws error if no user consent (MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS environment variable).
 *
 * @param command - Command string to execute
 * @throws {Error} When sudo command but no consent
 */
export const checkSudoPermission = (command: string): void => {
  if (command.trim().startsWith("sudo ")) {
    if (
      !validateConsent(dangerousConsentEnvVar, "Executing sudo command in PTY")
    ) {
      throw new Error(sudoPermissionErrorPrompt);
    }
  }
};

/**
 * Executable permission detection utility
 *
 * Throws error if executable filename contains sudo in PTY and no user consent (MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS environment variable).
 *
 * @param executable - Executable filename
 * @throws {Error} When sudo-related file but no consent
 */
export const checkExecutablePermission = (executable: string): void => {
  if (executable.toLowerCase().includes("sudo")) {
    if (
      !validateConsent(
        dangerousConsentEnvVar,
        "Executing sudo-related executable in PTY"
      )
    ) {
      throw new Error(sudoPermissionErrorPrompt);
    }
  }
};
