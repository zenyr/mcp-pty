# 028-fix-session-connect-bug

## Summary
Fixed a bug in HTTP transport where reconnection to a terminated session would fail, preventing proper session establishment after connect.

## Problem
In the HTTP transport layer (`packages/mcp-pty/src/transports/index.ts`), when attempting to reconnect to an existing session, the code checked for session existence in `sessionManager` but did not verify the session status. If a session was previously terminated (e.g., via DELETE endpoint or connection close), attempting to reconnect would bind to a terminated session, causing session operations to fail.

## Root Cause
The reconnection logic only checked `if (existingSession)` without considering `existingSession.status !== "terminated"`. Terminated sessions should not be reconnected to; instead, a new session should be created.

## Solution
Modified the reconnection condition to include status check:
```typescript
if (existingSession && existingSession.status !== "terminated") {
  // Reconnect to existing session
} else {
  // Create new session
}
```

## Files Changed
- `packages/mcp-pty/src/transports/index.ts`: Added status check in reconnection logic

## Testing
- All existing tests pass (mcp-pty: 57 tests, session-manager: 16 tests)
- No new tests added as the fix is a simple conditional change
- Verified session lifecycle works correctly with terminated session handling

## Impact
- Prevents reconnection to terminated sessions
- Ensures clean session establishment after connect
- Maintains backward compatibility for active sessions