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
mcp-pty --transport http --port 3000

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
4. **Defaults**: stdio transport, port 3000

### XDG Configuration File

`~/.config/mcp-pty/config.json` (or `$XDG_CONFIG_HOME/mcp-pty/config.json`):

```json
{
  "transport": "stdio",
  "port": 3000,
  "deactivateResources": false
}
```

### Transport Layer

- **stdio**: MCP client runs server as child process directly. Guarantees automatic cleanup on process termination. 1:1 client-server binding.
- **http**: Operates as remote MCP server. Supports multiple concurrent client sessions. HTTP server implementation based on Hono. Real-time notifications via Server-Sent Events (SSE).

### Environment Variables

- `MCP_PTY_DEACTIVATE_RESOURCES=true`: Enable dynamic tool provisioning for clients without Resources support.
- `XDG_CONFIG_HOME`: XDG config directory path (default: `~/.config`)

## API Documentation

### MCP Resources

- `pty://status`: Server status (n sessions with m processes)
- `pty://list`: List PTY processes in current session
- `pty://{id}/output`: Output history of specific PTY process in current session
- `pty://{id}/status`: Status information of specific PTY process in current session

### MCP Tools

- `start`: Create new PTY instance (command and pwd required, returns with initial output)
- `kill`: Terminate PTY instance
- `list`: List PTY processes (when Resources deactivated)
- `read`: Read PTY output (when Resources deactivated)
- `activate_pty_tools`: Dynamic tool provisioning (when Resources deactivated)

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
