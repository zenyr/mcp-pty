# PR #82 - HTTP Transport Reconnection Hardening

**Date**: 2025-10-25  
**Status**: In Review  
**Related**: [PR #82](https://github.com/zenyr/mcp-pty/pull/82)

## Problem Statement

PR #82 introduced critical fixes for HTTP transport reconnection after server restart:
- **Transport Reuse Issue**: Stale transport instances caused 400 errors when clients reconnected
- **Ambiguous Deferred Initialization**: Race conditions possible due to unclear connection timing
- **Logging Anti-pattern**: Used `console.log` instead of centralized logger

## Root Cause Analysis

### Transport Lifecycle Problem
The StreamableHTTPServerTransport maintains internal state (session handlers, stream mappings). Reusing the same transport instance across reconnections causes:
1. Stale JSON-RPC request handlers pointing to old session state
2. Invalid header states causing 400 Bad Request errors
3. Protocol violations in MCP Streamable HTTP spec

### Why Deferred Initialization?
Deferring `server.connect(transport)` until first client request:
- **Prevents unnecessary connections**: Avoids connecting to transports that may never be used
- **Ensures fresh transport per session**: Each reconnection creates new transport → clean state
- **Matches session creation pattern**: Consistent with new session initialization flow

## Solution

### 1. Type Safety & Logging
- Added explicit logger import from `@pkgs/logger`
- Replaced `console.log` with `transportLogger.debug()`
- Maintains PM2 visibility via centralized logging (consola supports log streaming)

### 2. Variable Naming Clarity
- Changed `newServer`/`newTransport` → `server`/`transport` in reconnection path
- Rationale: Variables represent the transport for *current* session, not "new" in absolute sense
- Reduces cognitive overhead when reading reconnection logic

### 3. Comment Clarity
Replaced design-smell comments:
```ts
// ❌ DON'T call server.connect() yet - let it happen via handleRequest()
// ✅ Defer server.connect() to first request to avoid transport reuse after reconnection
```
This explains the *why* (prevent transport reuse) rather than *what* (don't call connect).

### 4. Reconnection Tests
Added three scenarios:
1. **Fresh transport on reconnect**: Validates no 400 errors from transport reuse
2. **Session persistence**: Confirms session state maintains across reconnections
3. **Multi-request resilience**: Ensures repeated requests don't break transport state

## Transport State Diagram

```
┌─────────────────────────────────────────────────────────┐
│ Request arrives with sessionId X                        │
└──────────────┬──────────────────────────────────────────┘
               │
               ▼
        ┌──────────────┐
        │ Session map  │  ─X─→ (not found)
        │ has sessionId?          │
        └──────────────┘          │
                │                  ▼
                │         ┌─────────────────────┐
                │         │ Check sessionManager│
         (found)│         │ for persisted state │
                │         └────┬────────────────┘
                │              │
         ┌──────┴──────┐       │
         │             │       │
         ▼             ▼       ▼
    ┌────────┐  ┌──────────┐  ┌──────────┐
    │ Reuse  │  │ Recreate │  │  Create  │
    │(error!)│  │ (fixed)  │  │ (fixed)  │
    └────────┘  └──────────┘  └──────────┘
                      │              │
                      └──────┬───────┘
                             ▼
                   ┌─────────────────────┐
                   │ Create fresh        │
                   │ server/transport    │
                   └────┬────────────────┘
                        │
                        ▼
                   ┌─────────────────────┐
                   │ Initialize session  │
                   │ bindings            │
                   └────┬────────────────┘
                        │
                        ▼
                   ┌─────────────────────┐
                   │ Store in session map│
                   │ (pending init)      │
                   └────┬────────────────┘
                        │
        ┌───────────────┴───────────────┐
        │ First client request arrives  │
        └───────────────┬───────────────┘
                        │
                        ▼
                ┌──────────────────────┐
                │ Call server.connect()│
                │ (deferred init)      │
                └──────────┬───────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │ Proceed with │
                    │ handleRequest│
                    └──────────────┘
```

## TypeScript Improvements

### Session Type Definition
```ts
interface HttpSession {
  server: McpServer;
  transport: StreamableHTTPServerTransport & { sessionId?: string };
  isConnecting?: boolean;
}
```

**Why this design?**
- `sessionId` optional on transport: Allows gradual typing (SDK doesn't guarantee property)
- `isConnecting` flag: Prevents race conditions when multiple requests arrive simultaneously during deferred init
- Type guard ensures compiler catches accidental usage before deferred init

## Testing Strategy

### Unit Tests Added
1. **Reconnection creates fresh transport**: POST request after invalid session returns new sessionId
2. **No 400 errors on reconnect**: Validates transport reuse bug is fixed
3. **Session state persistence**: GET request returns session status after creation

### What's NOT Tested
- ❌ PM2-specific process restart (integration test required)
- ❌ Long-lived connections with multiple message exchanges
- ❌ Concurrent reconnection requests (race condition edge case)

Future integration tests should cover these scenarios.

## Logger Integration

**Why not console.log?**
- Bypasses centralized logging system
- Invisible to log aggregation (ELK, Datadog)
- PM2 can't apply custom formatting

**Logger alternative:**
- `consola` backend supports log streaming
- Scope-based tagging: `[http-transport]` prefix automatic
- Respects NODE_DEBUG env variable

## Breaking Changes
None. This is a pure bug fix + hardening. Public API unchanged.

## Verification Checklist
- [x] No `console.*` calls in core code
- [x] Variable names clarified for reconnection path
- [x] Comments explain "why" not "what"
- [x] Tests cover main reconnection scenarios
- [x] Build passes without errors
- [x] AgentLog documents decisions

## Future Work
1. **Integration tests**: Full server restart → reconnection flow
2. **Metrics**: Track reconnection success/failure rates
3. **Timeout handling**: Implement request timeout for stuck transports
4. **Session cleanup**: Garbage collect abandoned sessions
