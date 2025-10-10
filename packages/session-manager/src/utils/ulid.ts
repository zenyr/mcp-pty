import { ulid } from "ulid";

/**
 * Generate new session ID.
 * Based on ULID for time-sortable ordering.
 */
export const generateSessionId = (): string => ulid();
