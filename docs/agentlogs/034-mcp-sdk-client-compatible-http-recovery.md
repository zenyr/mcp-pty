# MCP SDK Client Compatible HTTP Server Recovery Implementation

## Problem

User reported 400 "Bad Request: Server not initialized" error when MCP client reconnected after server restart:

```
failed to send message: POST "http://127.0.0.1:63561/session/..." 500 Internal Server Error
Error Posting to endpoint (HTTP 400): Bad Request: Server not initialized
```

**Root Cause**: 404 응답 후 클라이언트 재요청 시점에 새 세션이 아직 초기화되지 않음.

### Issue Flow

1. Client sends request with stale sessionId
2. Server detects terminated session, creates new sessionId
3. Server returns 404 with new sessionId header
4. **Client immediately retries with new sessionId**
5. **Server finds session in map but hasn't called `server.connect()` yet**
6. StreamableHTTPServerTransport rejects request: "Server not initialized" (400)

## Solution: Synchronous Initialization Before 404 Response

### Key Change

**Both POST and GET 404 recovery paths now:**
1. Create new session and register in sessionManager
2. **Synchronously call `await server.connect()` before returning 404**
3. Set session status to "active"
4. Add session to `sessions` map
5. Return 404 with new sessionId header

**Why this works:**
- When client retries with new sessionId, `sessions.get()` succeeds (session exists in map)
- Session is already initialized and "active"
- Client's next request succeeds immediately

### Code Pattern

```typescript
// Recovered session initialization (404 recovery)
const newSessionId = sessionManager.createSession();
const newServer = serverFactory();
const newTransport = createHttpTransport(newSessionId);

initializeSessionBindings(newServer, newSessionId);

// CRITICAL: Initialize server BEFORE returning 404
try {
  await newServer.connect(newTransport);
  sessionManager.updateStatus(newSessionId, "active");
} catch (err) {
  logError(`Failed to initialize recovered session`, err);
  sessionManager.updateStatus(newSessionId, "terminated");
  return c.json(createJsonRpcError(-32603, "Internal error"), 500);
}

sessions.set(newSessionId, newSession);
return createSessionNotFoundResponse(newSessionId);
```

### MCP SDK Client Behavior

StreamableHTTPClientTransport (v1.20.0):
- Receives 404 with `mcp-session-id` header
- Updates internal sessionId property
- **Immediately retries** (no exponential backoff)
- Expects server to be ready

Our server now matches this expectation.

## Testing

### Local E2E Test
```bash
bun test src/__tests__/http-server-restart-e2e.test.ts
# Result: 1 pass - client gracefully recovers from server restart
```

### HTTP Transport Tests
```bash
bun test src/__tests__/http-transport.test.ts
# Results:
# - POST 404 with invalid session: ✅ Pass
# - GET 404 with invalid session: ✅ Pass
# - Session reconnection: ✅ Pass
# Total: 6 pass, 0 fail
```

### Real-World Test (pm2 + MCP Client)
User reported previous error is now resolved. Client can:
- Connect to server
- Survive server restart
- Recover session gracefully
- Continue operation without "Server not initialized" error

## Implementation Details

### 1. POST 404 Recovery (L212-254)
- Stale sessionId detected via `sessionManager.getSession()`
- Session is "terminated" or doesn't exist
- Create new session with immediate initialization
- Return 404 with new sessionId

### 2. GET 404 Recovery (L303-323)
- Same pattern as POST
- GET endpoint also supports 404 recovery
- Ensures consistent behavior

### 3. Deferred Initialization (L252-274)
- NEW sessions (no sessionHeader) still use deferred init
- Allows SDK to send initialize request before server.connect()
- Race condition protection via `isConnecting` flag

### 4. Race Condition Prevention (L343-375)
- `isConnecting` flag prevents concurrent `server.connect()` calls
- Only applies to NEW sessions (not 404 recovery)
- 404 recovery is synchronous, so no race condition risk

## Compatibility Notes

**Follows MCP SDK expectations:**
- 404 with mcp-session-id header
- Immediate retry from client
- Server must be initialized before client retries

**Tested with:**
- @modelcontextprotocol/sdk@1.20.0
- StreamableHTTPClientTransport
- Real pm2 environment (1234 port)

## Benefits

1. **Zero 400 Errors**: "Server not initialized" errors eliminated
2. **Graceful Recovery**: Client survives server restart transparently
3. **Compatible**: Works with SDK's immediate retry behavior
4. **Robust**: Error handling for initialization failures
5. **Maintainable**: Clear comments explaining SDK compatibility

## Lessons Learned

1. **Timing matters**: 404 response must complete after server initialization
2. **Async/await**: Must `await` server.connect() in 404 path
3. **Map consistency**: Session must exist in `sessions` map before returning 404
4. **SDK behavior**: Different clients have different reconnection strategies (auto vs manual)

## Future Improvements

1. Consider exponential backoff for client retries (currently immediate)
2. Add retry limit to prevent infinite loops
3. Monitor recovery metrics (404 frequency, recovery success rate)
4. Support client-side recovery hints in 404 response
