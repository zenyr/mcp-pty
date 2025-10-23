# mcp-pty Project Plan

## Project Status Overview

### Completed Phases

#### Phase 1: Package Infrastructure
- ✅ Monorepo setup w/ Bun workspace
- ✅ TS config (strict, ES2022, ESNext)
- ✅ ESLint + Prettier setup
- ✅ Package dependency mgmt

#### Phase 2: PTY Manager (@pkgs/pty-manager)
- ✅ Type defs (PtySession, PtyInstance, SessionStatus)
- ✅ Process status (initializing → active → idle → terminating → terminated)
- ✅ PTY impl w/ bun-pty
- ✅ xterm headless (terminal state, ANSI sequences)
- ✅ Process isolation (nanoid-based IDs)
- ✅ Command exec & stream (stdin/stdout/stderr)
- ✅ PtyManager (sessionId lifecycle)
- ✅ Shell env inheritance (shellMode w/ PATH)
- ✅ ANSI capture/strip
- ✅ Interactive input (write w/ terminal state)
- ✅ CJK/Emoji/multiline/ANSI support (Ctrl+C, etc.)
- ✅ Graceful shutdown (SIGTERM → SIGKILL, 3s grace)
- ✅ Unit + integration tests

#### Phase 3: Session Manager (@pkgs/session-manager)
- ✅ Type defs (Session, SessionStatus, SessionId)
- ✅ Transport types (stdio | streaming-http)
- ✅ ULID session IDs
- ✅ In-mem store (Map)
- ✅ Session CRUD
- ✅ 1:N PTY binding (session → multiple PTYs)
- ✅ Lifecycle transitions
- ✅ Idle timeout (5min auto-term)
- ✅ SessionManager (transport-aware init)
- ✅ Event system (SSE support)
- ✅ Graceful shutdown w/ cleanup
- ✅ Unit + integration tests

#### Phase 4: MCP Server (@pkgs/mcp-server)
- ✅ Core server (MCP SDK, dual transports, detection)
- ✅ Session integration (client mapping, cleanup)
- ✅ Resources: status, processes, processes/{processId}, control-codes
- ✅ Tools: start, kill, list, read, write_input (w/ asCRLF for Windows SSH)
- ✅ SessionManager + PtyManager integration
- ✅ Error handling, logging, MCP responses
- ✅ Tests (unit, integration, type checks)
- ✅ CLI entry (bin config)
- ✅ XDG Base Dir spec
- ✅ Config priority (CLI > XDG > env > defaults)

---

### Phase 5: Documentation & Examples

#### 5.1 User Documentation
- ✅ README.md: overview, install, config (stdio/HTTP), env vars, XDG
- ✅ API docs: resources/tools schema, error codes, control-codes reference

#### 5.2 Developer Documentation
- [ ] Architecture deep-dive
- [ ] Package interaction diagrams
- [ ] Contribution guidelines
- [ ] Dev setup guide

#### 5.3 Examples & Demos
- [ ] MCP client config (stdio)
- [ ] HTTP server deploy
- [ ] Use cases: dev server, interactive tools (htop/vim), build processes

#### 5.4 Project Website
- [ ] GitHub Pages landing page (Bun + React static site)
- [ ] CI automation for GH Pages deploy (only essential steps)

---

### Phase 6: Production Readiness

#### 6.1 Performance
- [ ] Memory leak detection/prevention
- [ ] Process resource limits
- [ ] Streaming buffer optimization
- [ ] Idle session cleanup verification

#### 6.2 Security Hardening

##### Critical Issues (🔴 Pre-Release Blocker)
1. **Command Injection** - `normalize-commands` lacks validation w/ `sh -c`
   - [ ] Dangerous pattern detect (rm -rf /, fork bombs)
   - [ ] Command validation layer pre-exec
   - [ ] bash-parser security checks

2. **Privilege Escalation Bypass** - sudo detect only checks prefix
   - [ ] Enhance sudo detect (exec path: /usr/bin/sudo, doas, su, run0)
   - [ ] Validate normalized commands post-bash-parser
   - [ ] Exec basename check in `checkExecutablePermission`

3. **PTY Write Injection** - `write_input` accepts arbitrary bytes
   - [ ] Filter dangerous ANSI escapes
   - [ ] Control char whitelist/blacklist
   - [ ] Rate limiting for writes

4. **Shell Metachar Attacks** - Unfiltered globs/redirections
   - [ ] Restrict globs (`*`, `?`, `[]`) in sensitive contexts
   - [ ] Validate redirects (`>`, `>>`, `<`, `<<`)
   - [ ] Path traversal protection

5. **Env Var Pollution** - PTY inherits parent env
   - [ ] Safe default env (whitelist)
   - [ ] Block dangerous vars (`LD_PRELOAD`, `LD_LIBRARY_PATH`)
   - [ ] Per-session env isolation

##### Medium Priority (🟡 Post v1.0)
6. **Resource Exhaustion** - No PTY/resource limits
   - [ ] PTY count limit/session (default: 10)
   - [ ] Memory monitoring/limits
   - [ ] Exec timeout (default: 30min)
   - [ ] xterm buffer size limits

7. **Session Security** - Predictable IDs, weak timeout
   - [ ] Eval ULID predictability
   - [ ] Configurable idle timeout (current: 5min)
   - [ ] Session auth (HTTP mode)
   - [ ] Rate limit session creation

8. **Info Disclosure** - Logs contain sensitive data
   - [ ] Log sanitization (commands/outputs)
   - [ ] Redaction patterns (tokens, passwords)
   - [ ] Separate audit log

##### Existing Protections (🟢)
- ✅ Root privilege detect w/ consent
- ✅ Sudo detect (partial, needs enhancement)
- ✅ Session-based PTY isolation
- ✅ Graceful SIGTERM → SIGKILL
- ✅ Consent framework (`MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS`)

##### Roadmap
**6.2.1: Critical Fixes (Pre-Release)**
- [ ] Command validation in `normalize-commands`
- [ ] Privilege escalation detect (sudo/doas/su/run0/pkexec/dzdo)
- [ ] Dangerous pattern detect (rm -rf /, chmod 777, dd, mkfs, fork bombs)
- [ ] Safe env defaults
- [ ] Basic resource limits (PTY count, exec timeout)

**6.2.2: Enhanced Security (Post v1.0)**
- [ ] PTY write filtering/rate limiting
- [ ] Advanced metachar protection
- [ ] Memory monitoring/enforcement
- [ ] Session auth (HTTP)
- [ ] Comprehensive audit logging

**6.2.3: Security Docs (Parallel)**
- [ ] SECURITY.md (threat model, mitigations)
- [ ] README security considerations
- [ ] Security best practices guide
- [ ] Consent env vars docs
- [ ] Incident response guide

#### 6.3 Observability
- [ ] Structured logging (consola)
- [ ] Error tracking/reporting
- [ ] Metrics (sessions, processes, uptime)
- [ ] Health checks (HTTP mode)

#### 6.4 Deployment
- [ ] Docker support
- [ ] systemd service example
- [ ] Cloud deploy guides (optional)
- [ ] Version release process

---

## Phase Dependency Graph

```
Phase 1 (Infrastructure) ✅
  ├─→ Phase 2 (PTY Manager) ✅
  └─→ Phase 3 (Session Manager) ✅
        ├─→ Phase 4 (MCP Server) ✅
               ├─→ Phase 5 (Documentation) ⬅️ **Current**
               └─→ Phase 6 (Production Readiness)
```

---

## Current Priority: Phase 5 - Documentation & Examples

### Recently Completed
- ✅ CLI entry (`bunx mcp-pty`)
- ✅ XDG config (`~/.config/mcp-pty/config.json`)
- ✅ Config priority (CLI > XDG > env > defaults)
- ✅ 5.1 User docs (README w/ XDG)
- ✅ PTY schema (removed z.any())
- ✅ PTY output retrieval (tools/resources)
- ✅ PTY count calc (status resource)
- ✅ Session creation time (PtyManager)
- ✅ Shell env inheritance (shellMode w/ PATH)
- ✅ Tool name simplify (removed `_pty` suffix)
- ✅ Resource URI simplify (removed `sessions/` prefix)
- ✅ Immediate output on start (500ms wait)
- ✅ Interactive input (`write_input` w/ terminal state)
- ✅ Terminal state queries (xterm buffer + cursor)
- ✅ Comprehensive text support (CJK/Emoji/multiline/ANSI)
- ✅ normalize-commands pkg (bash-parser based)
- ✅ List tool exitCode
- ✅ HTTP transport fixes (reconnection, notifications)
- ✅ Reconnection support (session reuse)
- ✅ normalize-commands integration (pty-manager)
- ✅ Test enhancement (env vars, arg parsing)
- ✅ Accurate pwd (mandatory in start tool)
- ✅ Control codes resource (pty://control-codes w/ descriptions & examples)
- ✅ asCRLF support (Windows SSH CRLF conversion)
- ✅ Enhanced tool/schema descriptions (LLM-friendly guidance)

### In Progress
- 5.1 User docs (README update w/ latest features)
- 5.2 Dev docs (architecture deep-dive, contribution guides, normalization)

### Suggested Order
1. 5.1 User docs (README w/ latest)
2. 5.2 Dev docs (arch + contrib)
3. 5.3 Examples (client configs, use cases)
4. 5.4 Project website (GH Pages w/ Bun + React)
5. 6.x Production readiness (perf, security, observability)

### Next Steps
1. Update README w/ latest features/config
2. Arch deep-dive docs
3. Contrib guidelines + dev setup
4. Example MCP client configs (stdio/HTTP)
5. Sample use cases (long-running servers, interactive tools)
6. GH Pages landing (Bun + React static)
7. CI automation for GH Pages deploy

---

## Additional Plans

1. **Node.js Runtime Support**: Currently `bunx mcp-pty` works but `npx mcp-pty` fails (Bun-only runtime). Add Node.js compatibility for wider adoption.
2. **Library Export & Type Definitions**: Current package is CLI-only (no TypeScript sources in NPM package). When converting to library, add `.d.ts` generation and re-enable type exports in `package.json`.
