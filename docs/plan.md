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
- ✅ `pty://list` - current session's PTY process list (renamed from `sessions/list`)
- ✅ `pty://{id}/output` - specific PTY output history (renamed from `session/{id}/output`)
- ✅ `pty://{id}/status` - specific PTY status info (renamed from `session/{id}/status`)

#### 4.4 MCP Tools Implementation (Fallback Mode)

- ✅ Environment variable check (`MCP_PTY_DEACTIVATE_RESOURCES=true`)
- ✅ Fixed tools:
  - ✅ `start` - create new PTY instance (renamed from `start_pty`, returns immediate output)
  - ✅ `kill` - terminate PTY instance (renamed from `kill_pty`)
  - ✅ `write_input` - write data to PTY stdin with terminal state response
- ✅ Conditional tools (when resources disabled):
  - ✅ `list` - list PTY processes (renamed from `list_pty`)
  - ✅ `read` - read PTY output (renamed from `read_pty`)
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

#### 4.7 Implementation Refinements

- ✅ CLI entry point configuration (`package.json` bin field)
- ✅ XDG config loader implementation (`utils/config.ts`)
- ✅ Configuration cascade system (CLI > XDG > env > defaults)
- ✅ `bunx mcp-pty` command support
- ✅ ANSI strip 옵션 구현 (pty-manager/process.ts - ansiStrip option in PtyOptions)
- ✅ PTY 스키마 개선 (mcp-server/types/index.ts, tools/index.ts - z.any() 제거)
- ✅ PTY 출력 가져오기 구현 (mcp-server/tools/index.ts, resources/index.ts)
- ✅ PTY 개수 계산 (mcp-server/resources/index.ts)
- ✅ 세션 생성 시간 관리 (pty-manager/manager.ts)
- ✅ Interactive input support (PtyProcess.write() + write_input tool)
- ✅ Terminal state extraction (xterm buffer + cursor position)
 - [x] PTY 인스턴스 정리 로직 (session-manager/index.ts)
 - [x] 세션별 서버 인스턴스 생성 검토 (mcp-server/transports/index.ts)

#### 4.8 Command Parser Implementation

- [x] Treesitter 기반 command parser 패키지 생성 (@pkgs/command-parser) - bash-parser로 대체
- [x] Shell grammar 정의 (bash/tree-sitter-bash 활용) - bash-parser AST 활용
- [x] Parser 함수 구현: `parseCommand(input: string) => { normalized: string; isShellCommand: boolean }`
- [x] Shell 명령어 감지 로직 (&&, ||, |, ;, redirection 등)
- [x] 명령어 정규화 (whitespace 정리, quote 처리)
- [x] PTY 실행 로직 통합 (isShellCommand에 따라 sh -c vs direct spawn)
- [x] Unit tests 및 integration tests
- [x] Error handling 및 edge cases (malformed commands)

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
               ├─→ Phase 4.7 (Refinements) ✅
               │     ├─→ Phase 4.8 (Command Parser) ✅
              │     │     ├─→ Phase 5 (Documentation) ⬅️ **Current Phase**
              │     │     └─→ Phase 6 (Production Readiness)
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
- ✅ **normalize-commands Package Implementation** - bash-parser 기반 명령어 파싱 및 정규화
- ✅ **MCP-PTY List Tool ExitCode** - 리스트 툴에 exitCode 필드 추가
- ✅ **HTTP Transport Fixes** - 세션 재연결 및 알림 처리 개선
- ✅ **Reconnection Fix** - 세션 재사용으로 재연결 지원
- ✅ **normalize-commands Integration** - pty-manager에 명령어 파싱 통합
- ✅ **Test Enhancement** - 환경 변수 및 인자 파싱 테스트 확장

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
