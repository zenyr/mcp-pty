# AgentLog 031: HTTP Transport Session Recovery Implementation

**Agent**: Haiku 4.5  
**Date**: 2025-10-22  

## Issue

HTTP transport session recovery unstable. Request body consumed prematurely → JSON-RPC parsing fails. Server init timing problematic.

## Root Cause

1. `await c.req.text()` consumed stream before transport could parse JSON-RPC (StreamableHTTPServerTransport reads raw `req` stream)
2. New sessions called `await server.connect(transport)` immediately → timing issues during stream processing
3. Notification handling (messages without id) required pre-parsing jsonBody

## Solution

### 1. Stop consuming request body
```typescript
// OLD
const body = await c.req.text();
jsonBody = JSON.parse(body);
await session.transport.handleRequest(req, res, jsonBody);

// NEW: pass raw stream
const { req, res } = toReqRes(c.req.raw);
await session.transport.handleRequest(req, res);
```

### 2. Deferred initialization (separate creation from connect)
```typescript
// Create: status = "initializing"
sessionId = sessionManager.createSession();
session = { server: serverFactory(), transport };
sessions.set(sessionId, session);
// NOT calling server.connect() yet

// First request: check status, then connect
if (sessionStatus?.status === "initializing") {
  await session.server.connect(session.transport);
  sessionManager.updateStatus(currentSessionId, "active");
}
await session.transport.handleRequest(req, res);
```

### 3. Remove notification logic (transport handles it)

## Files Changed

- `packages/mcp-pty/src/transports/index.ts`
  - Removed `c.req.text()` body consumption
  - Added "initializing" status check before connect
  - Removed jsonBody pre-parsing

- `packages/experiments/package.json` - Added test:mcp script
- `packages/experiments/tsconfig.json` - Added "dom" lib (MCP SDK needs URL type; root tsconfig unchanged)

## Test Results

✓ 6/6 HTTP transport unit tests  
✓ MCP client integration test (session-recovery-test.ts)
  - First connection: Session created, version retrieved
  - Invalid session: Recovery after 404
  - Second client: Independent session
  - Concurrent operations: Both clients fetch resources simultaneously

Server logs confirm:
```
Session created: 01K85WT5WZ6...
Created new session (pending init): 01K85WT5WZ6...
<-- POST /mcp
Initialized session before handleRequest: 01K85WT5WZ6...
--> POST /mcp 200 2ms
```

## Why Deferred Init?

- Stream safe (unused before connect)
- Timing predictable (init at first request)
- Clear error boundaries

## Next

- Merge fix/http-transport-session-reconnection branch
- Verify MCP SDK StreamableHTTPClientTransport session ID header handling
- Load test concurrent multi-session stability
