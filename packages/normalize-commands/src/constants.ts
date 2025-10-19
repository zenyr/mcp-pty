/**
 * Shared security constants for command validation
 */

/**
 * Privilege escalation commands that require explicit user consent
 */
export const PRIVILEGE_ESCALATION_COMMANDS = [
  "sudo",
  "doas",
  "su",
  "run0",
  "pkexec",
  "dzdo",
  "pfexec",
  "sesu",
  "usermod",
  "chown",
  "passwd",
  "visudo",
  "vipw",
  "vigr",
] as const;
