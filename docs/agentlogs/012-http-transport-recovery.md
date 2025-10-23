# HTTP Transport Recovery Implementation

## Feature

HTTP transport session recovery stabilization + type safety + race condition prevention + server restart handling.

### Phase 031-033

**Session Recovery Stabilization**
- Root cause: Request body consumed prematurely by `await c.req.text()` → JSON-RPC parsing fails. Server init timing problematic.
- Solution: Stop consuming request body before transport can parse JSON-RPC. Use raw stream via `toReqRes(c.req.raw)`.
- Deferred initialization: Create session with status "initializing", defer `server.connect()` to first request.
- Removed notification pre-parsing (transport handles it).

**Type Safety & Race Condition Fixes**
- Type unsafety: `session?.transport.sessionId` implicit any → introduced `HttpSession` interface with `StreamableHTTPServerTransport & { sessionId?: string }`.
- Race condition: Concurrent `server.connect()` calls during deferred init → added `isConnecting` flag guard + wait mechanism (max 100ms timeout).
- Error handling: Untyped catch blocks → `catch (err: unknown)` + instanceof guards.
- Removed ~30 lines duplication via helper functions: `createHttpTransport()`, `initializeSessionBindings()`, `createSessionNotFoundResponse()`.

**Server Restart Recovery**
- Port conflict handling: Added EADDRINUSE error handling with user guidance.
- Session recovery: Server returns 404 with new session ID when stale session detected. SDK auto-updates sessionId.
- Thread-safe concurrent init: Added `isConnecting` flag + wait mechanism (10 retries, 10ms each).
- E2E testing: Real server restart using `Bun.serve().stop()`. Single client survives restart, concurrent clients recover simultaneously.
- Removed excessive console.log debugging statements.

### Key Changes

- `packages/mcp-pty/src/transports/index.ts`
  - Removed `c.req.text()` body consumption before transport processing
  - Added "initializing" status check + deferred `server.connect()`
  - Introduced `HttpSession` interface for type safety
  - Added `isConnecting` flag + wait mechanism for race condition prevention
  - Thread-safe concurrent initialization with status verification
  - Proper EADDRINUSE error handling
  
- `packages/mcp-pty/src/__tests__/http-server-restart-e2e.test.ts`
  - Real server restart validation using `Bun.serve().stop()`
  - Client persistence + sessionId update verification
  - Concurrent multi-client recovery scenarios
  
- `packages/session-manager/src/test-utils.ts`
  - Typed error handling (instanceof Error)

- `packages/experiments/package.json`
  - Added test:mcp script

- `packages/experiments/tsconfig.json`
  - Added "dom" lib (MCP SDK requires URL type)

### Outcome

✅ All 3 issues fixed: HttpSession type safety, isConnecting race guard, typed error handling.
✅ 100+ concurrent tests pass (mcp-pty 48/48, pty-manager 42+, session-manager 15/15, normalize-commands 38/38, logger 3/3).
✅ HTTP transport: 6/6 edge cases (invalid session, concurrent reconnect, 404 responses, deferred init).
✅ E2E server restart recovery validated.
✅ Clean production-ready implementation (no excessive debugging).
