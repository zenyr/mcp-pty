# mcp-pty

An MCP server that manages persistent pseudo-terminal sessions bound to MCP clients using Bun, xterm.js, and the official MCP SDK. Unlike typical shell execution, it provides a continuous terminal environment maintained across multiple command invocations within a client session.

## Installation

### Global Installation (Recommended)

```bash
bun install -g mcp-pty
```

### Local Development

```bash
git clone <repository>
cd mcp-pty
bun install
bun link  # Register as global command
```

## Usage

### CLI Commands (Recommended)

```bash
# Default execution (stdio mode)
mcp-pty

# HTTP mode
mcp-pty --transport http --port 6420

# Help
mcp-pty --help
```

### Direct Execution (Development)

```bash
# stdio mode
bun run packages/mcp-server/src/index.ts

# HTTP mode
bun run packages/mcp-server/src/index.ts --transport http
```

## Configuration

### Configuration Priority

1. **CLI Arguments** (highest): `--transport`, `--port`
2. **XDG Config File**: `~/.config/mcp-pty/config.json`
3. **Environment Variables**: `MCP_PTY_DEACTIVATE_RESOURCES`
4. **Defaults**: stdio transport, port 6420

### XDG Configuration File

`~/.config/mcp-pty/config.json` (or `$XDG_CONFIG_HOME/mcp-pty/config.json`):

```json
{
  "transport": "stdio",
  "port": 6420,
  "deactivateResources": false
}
```

### Transport Layer

- **stdio**: MCP client runs server as child process directly. Guarantees automatic cleanup on process termination. 1:1 client-server binding.
- **http**: Operates as remote MCP server. Supports multiple concurrent client sessions. HTTP server implementation based on Hono. Real-time notifications via Server-Sent Events (SSE).

### Environment Variables

- `MCP_PTY_DEACTIVATE_RESOURCES=true`: Enable dynamic tool provisioning for clients without Resources support.
- `XDG_CONFIG_HOME`: XDG config directory path (default: `~/.config`)

## Features

- **Persistent PTY Sessions**: Continuous terminal environment across multiple command invocations
- **Dual Transport Support**: stdio for 1:1 binding, HTTP for multi-client support with Server-Sent Events
- **Advanced Command Parsing**: normalize-commands integration for accurate bash syntax handling (pipelines, redirections, environment variables)
- **Session Management**: ULID-based session IDs with idle timeout and graceful shutdown
- **Resource-Based Interface**: Modern MCP resources (pty:// URIs) with fallback to tools mode
- **Comprehensive Text Support**: Full Unicode, ANSI escape sequences, and TUI applications
- **Interactive Input**: Real-time terminal state queries and input handling
- **Reconnection Support**: HTTP transport maintains session continuity on client reconnect
- **Security**: Command normalization, path validation, and resource isolation

## API Documentation

### MCP Resources

- `pty://status`: Server status showing active sessions and PTY processes
- `pty://processes`: List all PTY processes in current session with status and exit codes
- `pty://processes/{processId}`: Complete output history of specific PTY process
- `pty://control-codes`: Reference for all available control codes (named codes for write_input tool)

### MCP Tools

- `start`: Create new PTY instance with command execution and working directory
  - Parameters: `command` (string, required), `pwd` (string, absolute path required)
  - Returns: PTY ID and immediate output
- `kill`: Terminate specific PTY instance
  - Parameters: `processId` (string, required)
- `list`: List PTY processes with exit codes
- `read`: Read PTY output/screen buffer
- `write_input`: Send input to PTY stdin, return screen state
  - Modes: Safe (input + ctrlCode) or Raw (data)
  - Parameters: `processId`, `input` (optional), `ctrlCode` (optional), `data` (optional), `asCRLF` (optional, for Windows SSH)
  - Returns: screen, cursor position, exitCode

### Error Codes

- Standard MCP error responses are used.

## Development

```bash
# Type checking
bun check

# Linting
bun run lint

# Testing
bun test
```

This project was generated with `bun init` on Bun v1.2.22. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.

## Credits

Built with opencode (opencode.ai + github sst/opencode)
