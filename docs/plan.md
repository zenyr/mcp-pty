# mcp-pty Project Plan

## Project Status Overview

### Completed Phases

#### Phase 1: Package Infrastructure

- ✅ Monorepo setup with Bun workspace
- ✅ TypeScript configuration (strict mode, ES2022, ESNext)
- ✅ ESLint & Prettier setup
- ✅ Package dependency management

#### Phase 2: PTY Manager (@app/pty-manager)

- ✅ Type definitions (PtySession, PtyInstance, SessionStatus, etc.)
- ✅ Process status types (initializing, active, idle, terminating, terminated)
- ✅ PTY class implementation using bun-pty
- ✅ xterm headless integration for terminal state & ANSI sequences
- ✅ Process isolation with nanoid-based instance IDs
- ✅ Command execution & stream processing (stdin/stdout/stderr)
- ✅ PtyManager class with sessionId-based lifecycle management
- ✅ ANSI sequence capture & strip options
- ✅ Graceful shutdown (SIGTERM → SIGKILL with 3s grace period)
- ✅ Unit & integration tests

#### Phase 3: Session Manager (@app/session-manager)

- ✅ Type definitions (Session, SessionStatus, SessionId, etc.)
- ✅ Transport layer types (stdio | streaming-http)
- ✅ ULID-based session ID generation
- ✅ In-memory session store (Map-based)
- ✅ Session CRUD operations
- ✅ 1:N PTY binding management (session → multiple PTY instances)
- ✅ Session lifecycle state transitions (initializing → active → idle → terminating → terminated)
- ✅ Idle timeout monitoring (5min auto-terminate)
- ✅ SessionManager class with transport-aware initialization
- ✅ Event system for session changes (SSE support)
- ✅ Graceful shutdown with cleanup procedures
- ✅ Unit & integration tests

#### Phase 4: MCP Server Implementation (@app/mcp-server)

- ✅ Core server setup with MCP SDK, dual transports (stdio/HTTP), detection logic
- ✅ Session integration with client connection mapping and cleanup
- ✅ MCP resources: status, sessions/list, session/{id}/output, session/{id}/status
- ✅ MCP tools: start_pty, kill_pty, list_pty, read_pty, activate_pty_tools
- ✅ Integration layer wiring SessionManager + PtyManager
- ✅ Error handling, logging, and MCP responses
- ✅ Testing & quality assurance (unit, integration, type checks)

---

## Remaining Phases

#### 4.1 Core Server Setup

- ✅ Install MCP SDK dependencies (`@modelcontextprotocol/sdk`)
- ✅ Implement dual transport layer:
  - ✅ stdio transport (1:1 client-server binding)
  - ✅ streaming-HTTP transport (Hono-based multi-client support)
- ✅ Transport detection & initialization logic
- ✅ Server lifecycle management (start/stop/graceful shutdown)

#### 4.2 Session Integration

- ✅ Integrate SessionManager with MCP server
- ✅ Client connection → session creation mapping
- ✅ Client disconnect → session cleanup handling
- ✅ stdio: parent process monitoring
- ✅ HTTP: SSE connection management & idle timeout (5min)

#### 4.3 MCP Resources Implementation

- ✅ `pty://status` - server status (n sessions, m processes)
- ✅ `pty://sessions/list` - current session's PTY process list
- ✅ `pty://session/{id}/output` - specific PTY output history
- ✅ `pty://session/{id}/status` - specific PTY status info

#### 4.4 MCP Tools Implementation (Fallback Mode)

- ✅ Environment variable check (`MCP_PTY_DEACTIVATE_RESOURCES=true`)
- ✅ Fixed tools:
  - ✅ `start_pty` - create new PTY instance
  - ✅ `kill_pty` - terminate PTY instance
- ✅ Conditional tools (when resources disabled):
  - ✅ `list_pty` - list PTY processes
  - ✅ `read_pty` - read PTY output
- ✅ `activate_pty_tools` - dynamic tool provisioning

#### 4.5 Integration Layer

- ✅ Wire SessionManager + PtyManager into MCP server
- ✅ Request routing (resources vs tools)
- ✅ Error handling & MCP error responses
- ✅ Logging with consola

#### 4.6 Testing & Quality

- ✅ Unit tests for transport layers
- ✅ Integration tests:
  - ✅ stdio transport scenarios
  - ✅ HTTP transport scenarios
  - ✅ Multi-client session isolation
- ✅ End-to-end tests with real MCP clients
- ✅ Type checks (`bun check`)
- ✅ Linting (`bun run lint`)

---

### Phase 5: Documentation & Examples

#### 5.1 User Documentation

- [ ] README.md update:
  - [ ] Project overview
  - [ ] Installation instructions
  - [ ] Configuration guide (stdio vs HTTP)
  - [ ] Environment variables reference
- [ ] API documentation:
  - [ ] MCP resources schema
  - [ ] MCP tools schema
  - [ ] Error codes & handling

#### 5.2 Developer Documentation

- [ ] Architecture deep-dive
- [ ] Package interaction diagrams
- [ ] Contribution guidelines
- [ ] Development setup guide

#### 5.3 Examples & Demos

- [ ] Example MCP client configuration (stdio mode)
- [ ] Example HTTP server deployment
- [ ] Sample use cases:
  - [ ] Long-running development server (e.g., `npm run dev`)
  - [ ] Interactive CLI tools (e.g., `htop`, `vim`)
  - [ ] Multi-step build processes

---

### Phase 6: Production Readiness

#### 6.1 Performance Optimization

- [ ] Memory leak detection & prevention
- [ ] Process resource limits enforcement
- [ ] Streaming output buffer optimization
- [ ] Idle session cleanup verification

#### 6.2 Security Hardening

- [ ] Session isolation validation
- [ ] Input sanitization for shell commands
- [ ] Resource usage monitoring & limits
- [ ] Audit security considerations section

#### 6.3 Observability

- [ ] Structured logging (consola)
- [ ] Error tracking & reporting
- [ ] Metrics collection (sessions, processes, uptime)
- [ ] Health check endpoints (HTTP mode)

#### 6.4 Deployment

- [ ] Docker container support
- [ ] systemd service example
- [ ] Cloud deployment guides (optional)
- [ ] Version release process

---

## Phase Dependency Graph

```
Phase 1 (Infrastructure)
  ├─→ Phase 2 (PTY Manager) ✅
  └─→ Phase 3 (Session Manager) ✅
        ├─→ Phase 4 (MCP Server) ✅
              ├─→ Phase 5 (Documentation) ⬅️ **Current Phase**
              └─→ Phase 6 (Production Readiness)
```

---

## Current Priority: Phase 5 - Documentation & Examples

### In Progress

- **5.1 User Documentation** - updating README and API docs (in progress)

### Suggested Implementation Order

1. **5.1 User Documentation** - update README and API docs ✅ (in progress)
2. **5.2 Developer Documentation** - architecture and contribution guides
3. **5.3 Examples & Demos** - client configurations and use cases

### Next Steps

Continue with README updates and API documentation to support user adoption.
