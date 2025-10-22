# HTTP Session Recovery E2E Investigation

## Initial Approach

Test server restart scenario with client session persistence. Design: 404 response + new sessionId header allows MCP SDK client to auto-recover via mcp-session-id header.

### Test Scenario

1. Client: connect with sessionId `A`, listTools() call ✓
2. Server: restart (new process)
3. Client: listTools() with old sessionId `A`
4. Server: return 404 + new sessionId `B` in mcp-session-id header
5. MCP SDK: auto-retry with new sessionId `B`
6. ❌ Result: `Bad Request: Server not initialized` 400 error

## Issues Identified

### Server-side 404 Recovery Mechanism

**File**: `packages/mcp-pty/src/transports/index.ts` (line 222-249)

Original design:
- Detect terminated session → create new sessionId
- Call `newServer.connect(newTransport)` immediately to initialize
- Return 404 → subsequent logic skipped
- Store in sessions map: `sessions.set(newSessionId, newSession)`

**Problem**: Next request (new sessionId) fails at `transport.handleRequest(req, res)` with 400 error

### Deferred Initialization Attempt

**Change**: Skip `server.connect()` on 404, defer to next request

**Result**:
- ✓ Status "initializing" → "active" transition works
- ✓ `server.connect()` call succeeds
- ✗ `transport.handleRequest()` still returns 400 error

### Log Analysis

Second request (new sessionId `01K8617Q8NQSS8Y6PWH8C9AE5G`):

```
[DEBUG] session exists: true
[DEBUG] Session exists for 01K8617Q8NQSS8Y6PWH8C9AE5G, reusing it
ℹ Initialized session before handleRequest: 01K8617Q8NQSS8Y6PWH8C9AE5G
[DEBUG] Before handleRequest: status=active, sessionExists=true
[DEBUG] About to call handleRequest - session.server type: object, session.transport type: object
--> POST /mcp 400 11ms
```

State:
- ✓ Session exists in map
- ✓ Deferred init executed (server.connect called)
- ✓ Server/transport objects exist
- ✗ `transport.handleRequest(req, res)` → 400 JSON-RPC error

## Root Cause Hypothesis

MCP SDK `StreamableHTTPServerTransport` behavior suspected:

**Option 1: HTTP Request-bound Transport**
- Transport binds to specific HTTP request/response stream
- First 404 response cycle uses transport
- Second HTTP request (different TCP connection) cannot reuse transport

**Option 2: Per-Request Transport Required**
- Each HTTP request needs fresh transport instance
- Stored transport valid only for first request

**Option 3: Incomplete Initialization**
- `server.connect(transport)` completes but internal state incomplete
- `handleRequest()` call fails initialization check

## What Works ✓

1. **404 Recovery Loop**: HTTP 404 + new sessionId header works correctly
2. **Unit Tests**: All 9 HTTP transport tests pass
3. **Connection Only**: New sessionId with `client.connect()` succeeds
4. **Same Session Repeats**: 3x listTools() on single session succeeds
5. **Deferred Init**: Status "initializing" → connect() → "active" works

## Test Files Created

1. `http-server-e2e.ts` (51 lines): Test HTTP server
2. `http-recovery-with-retry.ts` (211 lines): Manual retry E2E test
3. `http-recovery-manual-e2e.ts` (189 lines): User-input-driven E2E
4. `http-recovery-fresh-client.ts` (47 lines): Fresh client connection test
5. `http-recovery-e2e.ts` (195 lines): Auto-wait E2E (non-functional)
6. `http-retry-same-session.ts` (48 lines): Transport reuse validation
7. `e2e-runner.ts` (148 lines): PTY-based orchestration (incomplete)

## Manual Testing Steps

```bash
# Terminal 1: Start HTTP server
cd /Users/jinhyeok/personal/funsies/mcp-pty
bun --cwd=packages/mcp-pty run src/__tests__/http-server-e2e.ts

# Terminal 2: Run E2E client (manual retry)
cd /Users/jinhyeok/personal/funsies/mcp-pty
bun --cwd=packages/mcp-pty run src/__tests__/http-recovery-with-retry.ts

# Terminal 1: Stop server (Ctrl+C)
# Terminal 1: Restart server
# Terminal 2: Press Enter → still 400 error
```

## Implementation Details

### 404 Response Changes

**Line 229-249**: New sessionId generation

Before:
```typescript
await newServer.connect(newTransport);  // immediate init
sessionManager.updateStatus(newSessionId, "active");
```

After:
```typescript
// DON'T connect here - deferred init handles it
sessionManager.createSession();  // status: "initializing"
```

### Deferred Init Logic

**Line 344-372**: Initialize on next request

```typescript
const sessionStatus = sessionManager.getSession(currentSessionId);
if (sessionStatus && sessionStatus.status === "initializing") {
  await session.server.connect(session.transport);
  sessionManager.updateStatus(currentSessionId, "active");
}
```

## Debug Logging Added

**File**: `packages/mcp-pty/src/transports/index.ts`

- Line 177-188: `[DEBUG] Incoming request`, session exists check
- Line 281: `[DEBUG] Session exists for...`, reuse logic
- Line 389-390: `[DEBUG] Before handleRequest`, status validation
- Line 398-400: `[DEBUG] About to call handleRequest`, transport type

## TDD Results

**HTTP Transport Tests**: 9/9 pass ✓
- GET /mcp without session
- POST /mcp without body
- POST /mcp with invalid session (404)
- POST /mcp with valid session
- GET /mcp with invalid session
- DELETE /mcp without header
- Client outlives server: initialization race condition
- Client outlives server: multiple isolated clients
- Client outlives server: real MCP client with stale session recovery

**E2E Recovery Test**: Failed ❌
- Simple connection: ✓
- listTools() after 404 recovery: ❌ (Server not initialized)

## Next Steps

### Priority 1: Transport Design Investigation
- Review MCP SDK `StreamableHTTPServerTransport` source
- Confirm if new transport required per HTTP request
- Understand transport lifecycle

### Priority 2: Transport Factory Pattern
Current:
```typescript
const newTransport = createHttpTransport(newSessionId);
sessions.set(newSessionId, { server, transport });
```

Proposed:
```typescript
// Don't store transport, create per request
sessions.set(newSessionId, { server });  // no transport

// Before handleRequest() call
if (!session.transport) {
  session.transport = createHttpTransport(currentSessionId);
}
```

### Priority 3: SDK Spec Review
- Re-read MCP Streamable HTTP specification
- Review 404 + session recovery mechanics

## Files Modified

- `packages/mcp-pty/src/transports/index.ts`: Deferred init adjustments, debug logging
- `docs/agentlogs/033-http-recovery-e2e-investigation.md`: This document

## Key Findings

1. **404 recovery mechanism is sound**: HTTP 404 + mcp-session-id header works
2. **Connection-level OK**: New sessionId with connect() succeeds
3. **Issue in RPC method calls**: Only occurs on listTools() etc, not connection
4. **Transport reuse suspected**: Stored transport valid only for specific HTTP request

## Blockers

- MCP SDK code access limited (npm package)
- Transport internal state not inspectable
- No reference implementations available

## References

- MCP SDK: `@modelcontextprotocol/sdk@1.20.0`
- StreamableHTTPServerTransport: No public documentation
- MCP Spec: https://spec.modelcontextprotocol.io (no 404 recovery section)
