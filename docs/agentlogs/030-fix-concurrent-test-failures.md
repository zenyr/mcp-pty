# AgentLog 030: Fix Concurrent Test Failures

**Agent**: Claude Sonnet 4.5  
**Date**: 2025-01-21  
**PR**: #64

## Problem

CI tests failing in concurrent mode with "Session not found" errors in 7/25 tests. Tests passed in sequential mode but failed when run with `--concurrent`.

## Root Cause Analysis

### Initial Issues
1. **Duplicate exports** in `pty-manager/src/index.ts` (TS2300 error) - fixed
2. **Global sessionManager usage** in resources/tools causing context mismatch - fixed with injection

### Critical Bug
`withTestSessionManager` test utility used snapshot-based session tracking:
```ts
const sessionsBeforeTest = new Set(sessionManager.getAllSessions().map(s => s.id));
// ... test runs
const newSessions = sessionsAfterTest.filter(s => !sessionsBeforeTest.has(s.id));
```

**Race condition in concurrent mode**:
- Test A snapshots sessions BEFORE Test B creates its session
- Test A creates session A
- Test B snapshots sessions (includes session A)
- Test A finishes, cleanup disposes "new" sessions (session A)
- **Test B cleanup ALSO disposes session A** (from Test B's perspective, it's "new")
- Test B handlers fail with "Session not found"

This caused 6-7 tests to fail intermittently in concurrent mode.

## Solution

### Replace Snapshot with Proxy-based Tracking

Changed from "diff before/after" to "track actual creates":

```ts
// OLD: snapshot before/after (race condition)
const sessionsBeforeTest = new Set(sessionManager.getAllSessions().map(s => s.id));

// NEW: intercept createSession calls
const createdSessions = new Set<string>();
const wrappedManager = new Proxy(sessionManager, {
  get(target, prop) {
    if (prop === "createSession") {
      return () => {
        const sessionId = target.createSession();
        createdSessions.add(sessionId);  // Track THIS test's sessions
        return sessionId;
      };
    }
    return target[prop as keyof SessionManager];
  },
});
```

**Benefits**:
- Each test only tracks sessions IT created via Proxy intercept
- No race conditions from concurrent getAllSessions() calls
- Cleanup only disposes sessions owned by that test
- Zero cross-test interference

### Missing sessionManager Parameters

Fixed 12 test calls missing sessionManager parameter:
```ts
// OLD
bindSessionToServer(server, sessionId);

// NEW  
bindSessionToServer(server, sessionId, sessionManager);
```

## Files Modified

- `packages/session-manager/src/test-utils.ts` - Proxy-based session tracking
- `packages/mcp-pty/src/__tests__/mcp-server.test.ts` - add sessionManager to 12 bind calls

## Test Results

**Before**: 18-19/25 pass (6-7 fail) in concurrent mode  
**After**: 25/25 pass (0 fail) in concurrent mode

**Full suite**: 213 pass, 6 skip, 0 fail across 219 tests

## Technical Details

### Why Proxy Over Wrapper Object?

TypeScript SessionManager has 20+ methods/properties. Wrapper object required implementing all:
```ts
// Would fail type check
const wrappedManager: SessionManager = {
  ...sessionManager,
  createSession: () => { /* custom */ }
};
// Error: missing 15+ properties
```

Proxy provides transparent pass-through with selective interception:
```ts
const wrappedManager = new Proxy(sessionManager, {
  get(target, prop) {
    if (prop === "createSession") return customImpl;
    return target[prop];  // Pass through everything else
  }
});
```

## Lessons Learned

1. **Snapshot-based isolation fails in concurrent contexts** - use event-driven tracking instead
2. **Proxy pattern ideal for selective method interception** - avoids wrapper boilerplate
3. **Test utility race conditions hard to detect** - only manifest under `--concurrent`
4. **Missing optional parameters silently use fallbacks** - caused global sessionManager usage

## Related Issues

- Fixes #64 CI test failures in concurrent mode
- Resolves all "Session not found" errors in MCP tools/resources tests
