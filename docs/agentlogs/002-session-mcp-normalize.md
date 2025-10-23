# Session + MCP + Normalize Commands Integration

## Feature

Complete implementation of session lifecycle management, MCP server protocol integration, and command normalization utilities to establish foundational layer for PTY operations.

### Phase 3-6

**Session Manager (Phase 3)**: Implemented SessionManager class with full CRUD operations, PTY binding (1:N mapping), lifecycle state machine (initializing → active → idle → terminating → terminated), idle monitoring with 5-min timeout, event-driven architecture, and graceful shutdown. ULID-based session IDs, type-safe with 15 test cases.

**MCP Server (Phase 4)**: Integrated @modelcontextprotocol/sdk with dual transport support (stdio for 1:1, streaming-HTTP via Hono for multi-client). Implemented 4 MCP resources (pty://status, pty://sessions/list, pty://session/{id}/output, pty://session/{id}/status) and 5 tools (start_pty, kill_pty, list_pty, read_pty, activate_pty_tools). Client connect/disconnect triggers session lifecycle. Transport detection via environment. Comprehensive integration tests with session isolation validation.

**Normalize Commands (Phase 4.8)**: Implemented bash-parser-based AST command normalization to accurately detect shell operators (&& || | ; > >> < <<) while respecting quotes. Single commands execute directly, complex bash syntax uses sh -c wrapper. Fallback regex for edge cases (incomplete heredocs). 18 unit tests covering single commands, pipelines, redirects, quotes, multiline. Fixes quote-aware detection (echo "foo&&bar" now correctly identified as direct command).

### Key Changes

- SessionManager: Event-driven session lifecycle with PTY binding, state machine validation, idle monitoring
- MCP Server: Dual transport (stdio/HTTP), resource + tool interface, client isolation
- Normalize Commands: AST-based shell detection, quote-aware parsing, fallback handling
- All packages: Strict TypeScript, Bun-native, comprehensive testing, zero any types

### Outcome

Established core infrastructure for mcp-pty protocol:
- Session layer: Multi-PTY management per session with lifecycle events
- Protocol layer: MCP-compliant server supporting stdio and streaming clients
- Utility layer: Robust command normalization for accurate shell operator detection

Ready for PTY manager integration and end-to-end testing.
