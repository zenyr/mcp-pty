# mcp-pty Project Plan

## Project Status Overview

### Completed Phases

#### Phase 1: Package Infrastructure

- ✅ Monorepo setup with Bun workspace
- ✅ TypeScript configuration (strict mode, ES2022, ESNext)
- ✅ ESLint & Prettier setup
- ✅ Package dependency management

#### Phase 2: PTY Manager (@pkgs/pty-manager)

- ✅ Type definitions (PtySession, PtyInstance, SessionStatus, etc.)
- ✅ Process status types (initializing, active, idle, terminating, terminated)
- ✅ PTY class implementation using bun-pty
- ✅ xterm headless integration for terminal state & ANSI sequences
- ✅ Process isolation with nanoid-based instance IDs
- ✅ Command execution & stream processing (stdin/stdout/stderr)
- ✅ PtyManager class with sessionId-based lifecycle management
- ✅ System shell environment inheritance (shellMode with PATH preservation)
- ✅ ANSI sequence capture & strip options
- ✅ Interactive input support (write method with terminal state extraction)
- ✅ CJK/Emoji/multiline/ANSI control codes support (Ctrl+C, etc.)
- ✅ Graceful shutdown (SIGTERM → SIGKILL with 3s grace period)
- ✅ Unit & integration tests

#### Phase 3: Session Manager (@pkgs/session-manager)

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

#### Phase 4: MCP Server Implementation (@pkgs/mcp-server)

- ✅ Core server setup with MCP SDK, dual transports (stdio/HTTP), detection logic
- ✅ Session integration with client connection mapping and cleanup
- ✅ MCP resources: status, sessions/list, session/{id}/output, session/{id}/status
- ✅ MCP tools: start_pty (with shellMode), kill_pty, list_pty, read_pty, activate_pty_tools
- ✅ Integration layer wiring SessionManager + PtyManager
- ✅ Error handling, logging, and MCP responses
- ✅ Testing & quality assurance (unit, integration, type checks)
- ✅ CLI entry point with bin field configuration
- ✅ XDG Base Directory specification support
- ✅ Configuration priority system (CLI args > XDG config > env vars > defaults)

---

### Phase 5: Documentation & Examples

#### 5.1 User Documentation

- ✅ README.md update:
  - ✅ Project overview
  - ✅ Installation instructions
  - ✅ Configuration guide (stdio vs HTTP)
  - ✅ Environment variables reference
  - ✅ XDG config file location
- ✅ API documentation:
  - ✅ MCP resources schema
  - ✅ MCP tools schema
  - ✅ Error codes & handling

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

##### Current Security Issues (Critical Priority)

**🔴 Critical Vulnerabilities**

1. **Command Injection** - `normalize-commands` lacks validation when wrapping with `sh -c`
   - [ ] Add dangerous pattern detection (rm -rf /, fork bombs, etc.)
   - [ ] Implement command validation layer before shell execution
   - [ ] Extend bash-parser error handling with security checks

2. **Privilege Escalation Bypass** - sudo detection only checks string prefix
   - [ ] Enhance sudo detection to check executable path (e.g., `/usr/bin/sudo`, `doas`, `su`, `run0`)
   - [ ] Add validation for normalized commands after bash-parser processing
   - [ ] Implement executable basename checking in `checkExecutablePermission`

3. **PTY Write Input Injection** - `write_input` tool accepts arbitrary bytes
   - [ ] Filter dangerous ANSI escape sequences
   - [ ] Implement control character whitelist/blacklist
   - [ ] Add rate limiting for write operations

4. **Shell Metacharacter Attacks** - Glob patterns and redirections unfiltered
   - [ ] Restrict file glob patterns (`*`, `?`, `[]`) in sensitive contexts
   - [ ] Validate redirection operators (`>`, `>>`, `<`, `<<`)
   - [ ] Add path traversal protection

5. **Environment Variable Pollution** - PTY inherits parent process environment
   - [ ] Implement safe default environment (whitelist approach)
   - [ ] Block dangerous variables (`LD_PRELOAD`, `LD_LIBRARY_PATH`)
   - [ ] Add per-session environment isolation

**🟡 Medium Priority Issues**

6. **Resource Exhaustion** - No limits on PTY creation or resource usage
   - [ ] Add PTY instance count limit per session (configurable, default: 10)
   - [ ] Implement memory usage monitoring and limits
   - [ ] Add command execution timeout (configurable, default: 30min)
   - [ ] Implement xterm buffer size limits

7. **Session Security** - Predictable session IDs and weak timeout
   - [ ] Evaluate ULID predictability for security contexts
   - [ ] Make idle timeout configurable (current: 5min fixed)
   - [ ] Add session-level authentication for HTTP mode
   - [ ] Implement rate limiting for session creation

8. **Information Disclosure** - Logs may contain sensitive data
   - [ ] Implement log sanitization for commands and outputs
   - [ ] Add redaction patterns for common secrets (tokens, passwords)
   - [ ] Create separate audit log for security events

**🟢 Existing Protections**

- ✅ Root privilege detection with explicit consent requirement
- ✅ Sudo command detection (partial - needs enhancement)
- ✅ Session-based PTY isolation
- ✅ Graceful SIGTERM → SIGKILL shutdown
- ✅ Consent-based dangerous action framework (`MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS`)

##### Security Hardening Roadmap

**Phase 6.2.1: Critical Fixes (Pre-Release Blocker)**
- [ ] Implement command validation layer in `normalize-commands`
- [ ] Enhance privilege escalation detection (sudo/doas/su/run0/pkexec/dzdo)
- [ ] Add dangerous pattern detection (rm -rf /, chmod 777, dd, mkfs, fork bombs)
- [ ] Implement safe environment variable defaults
- [ ] Add basic resource limits (PTY count, execution timeout)

**Phase 6.2.2: Enhanced Security (Post v1.0)**
- [ ] PTY write input filtering and rate limiting
- [ ] Advanced shell metacharacter protection
- [ ] Memory usage monitoring and enforcement
- [ ] Session authentication for HTTP transport
- [ ] Comprehensive audit logging

**Phase 6.2.3: Documentation (Parallel Track)**
- [ ] Create SECURITY.md with threat model and mitigation strategies
- [ ] Document security considerations in README.md
- [ ] Add security best practices guide
- [ ] Document consent environment variables and their implications
- [ ] Create security incident response guide

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
Phase 1 (Infrastructure) ✅
  ├─→ Phase 2 (PTY Manager) ✅
  └─→ Phase 3 (Session Manager) ✅
        ├─→ Phase 4 (MCP Server) ✅
               ├─→ Phase 5 (Documentation) ⬅️ **Current Phase**
               └─→ Phase 6 (Production Readiness)
```

---

## Current Priority: Phase 5 - Documentation & Examples

### Recently Completed

- ✅ **CLI Entry Point Setup** - `bunx mcp-pty` command support
- ✅ **XDG Config System** - `~/.config/mcp-pty/config.json` support
- ✅ **Configuration Priority** - CLI args > XDG config > env vars > defaults
- ✅ **5.1 User Documentation** - README with XDG config guide
- ✅ **PTY Schema Improvements** - Removed z.any() usage in types and tools
- ✅ **PTY Output Retrieval** - Implemented in tools and resources
- ✅ **PTY Count Calculation** - Added to status resource
- ✅ **Session Creation Time Management** - Added to PtyManager
- ✅ **System Shell Environment Inheritance** - shellMode with PATH preservation
- ✅ **Tool Name Simplification** - Removed `_pty` suffix from all tools (start, kill, list, read)
- ✅ **Resource URI Simplification** - Removed `sessions/` prefix from resource templates
- ✅ **Immediate Output on Start** - `start` tool now returns initial PTY output with 500ms wait
- ✅ **Interactive Input Support** - `write_input` tool with terminal state extraction
- ✅ **Terminal State Queries** - xterm buffer-based screen content + cursor position
- ✅ **Comprehensive Text Support** - CJK/Emoji/multiline/ANSI control codes (Ctrl+C, etc.)
- ✅ **normalize-commands Package Implementation** - Command parsing and normalization based on bash-parser
- ✅ **MCP-PTY List Tool ExitCode** - Added exitCode field to list tool
- ✅ **HTTP Transport Fixes** - Improved session reconnection and notification handling
- ✅ **Reconnection Fix** - Support reconnection with session reuse
- ✅ **normalize-commands Integration** - Integrated command parsing into pty-manager
- ✅ **Test Enhancement** - Extended tests for environment variables and argument parsing
- ✅ **Accurate pwd Setting** - Fixed issue where commands execute with mcp-pty server directory as pwd by making pwd mandatory in start tool

### In Progress

- **5.1 User Documentation** - README.md update with latest features
- **5.2 Developer Documentation** - architecture deep-dive and contribution guides and normalization

### Suggested Implementation Order

1. **5.1 User Documentation** - README.md update with latest features
2. **5.2 Developer Documentation** - architecture deep-dive and contribution guides
3. **5.3 Examples & Demos** - client configurations and use cases
4. **6.x Production Readiness** - performance, security, observability

### Next Steps

1. Update README.md with latest features and configuration options
2. Create architecture deep-dive documentation
3. Develop contribution guidelines and development setup guide
4. Build example MCP client configurations (stdio and HTTP modes)
5. Create sample use cases (long-running servers, interactive tools)

---

## Additional Plans

1. Environment variable passing: Analyze what env MCP clients expect
2. Accurate pwd setting: Fix issue where commands execute with mcp-pty server directory as pwd
3. **Node.js Runtime Support**: Currently `bunx mcp-pty` works but `npx mcp-pty` fails (Bun-only runtime). Add Node.js compatibility for wider adoption.
4. **Library Export & Type Definitions**: Current package is CLI-only (no TypeScript sources in NPM package). When converting to library, add `.d.ts` generation and re-enable type exports in `package.json`.
