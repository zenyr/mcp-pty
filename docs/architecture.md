# Architecture Deep-Dive

## Overview

mcp-pty is a Model Context Protocol (MCP) server that provides persistent pseudo-terminal (PTY) sessions for AI agents. The architecture follows a modular, monorepo structure with clear separation of concerns across multiple packages.

## Core Architecture

### Package Structure

```
packages/
├── mcp-pty/           # Main MCP server implementation
├── pty-manager/       # PTY process lifecycle management
├── session-manager/   # Client session handling
├── normalize-commands/# Command parsing and security
├── logger/           # Centralized logging
└── experiments/      # Experimental features
```

### Design Principles

1. **Session Isolation**: Each MCP client gets its own isolated session with dedicated PTY manager
2. **Transport Agnostic**: Supports both stdio (1:1) and HTTP (multi-client) transports
3. **Security First**: Command normalization and validation before execution
4. **Resource Management**: Automatic cleanup of idle sessions and PTY processes
5. **Type Safety**: Full TypeScript with strict configuration

## Package Interactions

### Core Flow

1. **Client Connection** → `mcp-pty` server initializes
2. **Session Creation** → `session-manager` creates new session with ULID
3. **PTY Management** → `pty-manager` handles PTY processes for the session
4. **Command Processing** → `normalize-commands` validates and parses commands
5. **Execution** → PTY process executes command in persistent shell
6. **Response** → Results returned via MCP resources or tools

### Data Flow

```
MCP Client → Transport Layer → MCP Server → Session Manager → PTY Manager → PTY Process
                ↑                                              ↓
                └─────── Resources/Tools Response ←──────────────┘
```

## Package Details

### mcp-pty (Main Server)

**Responsibilities:**
- MCP protocol implementation using official SDK
- Transport layer abstraction (stdio/HTTP)
- Resource and tool registration
- Configuration management (XDG, CLI, env vars)

**Key Components:**
- `McpServerFactory`: Creates configured MCP servers
- `transports/`: HTTP (Hono-based) and stdio implementations
- `tools/`: MCP tool definitions (start_pty, kill_pty, etc.)
- `resources/`: MCP resource definitions (pty:// URIs)

### session-manager

**Responsibilities:**
- Session lifecycle management (create, monitor, dispose)
- PTY manager instance binding per session
- Idle session detection and cleanup
- Event-driven architecture for session state changes

**Key Features:**
- ULID-based session identification
- Graceful shutdown with SIGTERM → SIGKILL fallback (3s timeout)
- 5-minute idle timeout with 1-minute monitoring interval
- Event listeners for session state changes

### pty-manager

**Responsibilities:**
- PTY process creation and lifecycle management
- Process state tracking and output buffering
- Safety checks and command validation
- Resource cleanup on process termination

**Key Features:**
- Bun.spawn-based PTY creation
- Real-time output capture and buffering
- Process exit code tracking
- Safety validations for working directories

### normalize-commands

**Responsibilities:**
- Bash command parsing using bash-parser AST
- Security validation and dangerous command detection
- Command normalization for direct vs shell execution
- Privilege escalation prevention

**Security Features:**
- Blocks dangerous commands (mkfs, rm -rf /, chmod 777)
- Prevents block device writes
- AST-based validation for complex shell constructs
- Configurable bypass with user consent

### logger

**Responsibilities:**
- Centralized logging with context
- Configurable log levels
- Transport-aware logging (stdio suppression)
- Structured logging for debugging

## Transport Layer Architecture

### stdio Transport
- **Use Case**: Direct 1:1 client-server binding
- **Implementation**: MCP SDK stdio server
- **Cleanup**: Automatic on process termination
- **Logging**: Suppressed to avoid protocol interference

### HTTP Transport
- **Use Case**: Multi-client remote access
- **Implementation**: Hono-based HTTP server
- **Features**: 
  - Server-Sent Events (SSE) for real-time updates
  - Session persistence across reconnections
  - Concurrent client support
- **Port**: Configurable (default: 6420)

## Security Architecture

### Command Validation Pipeline

1. **Input**: Raw command string from client
2. **Parsing**: bash-parser creates AST
3. **Validation**: Security checks on AST nodes
4. **Normalization**: Determine shell vs direct execution
5. **Execution**: Safe command execution

### Security Measures

- **Command Blacklist**: Privilege escalation, dangerous filesystem operations
- **Path Validation**: Working directory safety checks
- **Resource Isolation**: Session-based PTY isolation
- **Timeout Protection**: Process execution limits
- **User Consent**: Configurable bypass for dangerous actions

## Resource Management

### Session Lifecycle
```
Created → Initializing → Active → Idle → Terminating → Terminated
    ↑         ↓           ↓        ↓         ↓          ↓
  ULID    PTY Bind    Activity  Monitor  Graceful   Cleanup
```

### PTY Process Lifecycle
```
Created → Starting → Running → Finished → Disposed
    ↑         ↓        ↓         ↓          ↓
  Spawn    Command  Output    Exit Code  Cleanup
```

## Configuration System

### Priority Order
1. **CLI Arguments** (`--transport`, `--port`)
2. **XDG Config File** (`~/.config/mcp-pty/config.json`)
3. **Environment Variables** (`MCP_PTY_*`)
4. **Defaults** (stdio, port 6420)

### Configuration Schema
```typescript
interface Config {
  transport: "stdio" | "http";
  port?: number;
  deactivateResources?: boolean;
}
```

## Error Handling

### Error Categories
- **Validation Errors**: Command security failures
- **Process Errors**: PTY creation/execution failures
- **Session Errors**: Session management failures
- **Transport Errors**: Communication failures

### Error Response Format
- MCP standard error responses
- Detailed error messages with context
- Error codes for programmatic handling
- Logging for debugging and monitoring

## Performance Considerations

### Optimizations
- **Incremental Compilation**: TypeScript incremental builds
- **Output Buffering**: Efficient PTY output handling
- **Session Monitoring**: Non-blocking idle detection
- **Resource Cleanup**: Automatic memory management

### Scalability
- **HTTP Transport**: Multi-client support
- **Session Isolation**: Independent resource management
- **Async Operations**: Non-blocking I/O throughout
- **Memory Efficiency**: Bounded output buffers

## Testing Architecture

### Test Structure
- **Unit Tests**: Package-specific functionality
- **Integration Tests**: Cross-package interactions
- **Test Utilities**: Mock factories and helpers
- **Security Tests**: Command validation edge cases

### Test Categories
- **PTY Management**: Process lifecycle testing
- **Session Management**: State transition testing
- **Command Processing**: Security validation testing
- **Transport Layer**: Communication protocol testing

## Future Extensibility

### Extension Points
- **New Transports**: WebSocket, gRPC implementations
- **Command Processors**: Additional language parsers
- **Security Policies**: Custom validation rules
- **Resource Types**: New MCP resource definitions

### Architecture Benefits
- **Modular Design**: Independent package development
- **Type Safety**: Interface-driven development
- **Event System**: Extensible session management
- **Configuration**: Flexible deployment options