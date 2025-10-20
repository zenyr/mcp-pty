# Control Codes Reference

## Overview

The `write_input` tool supports user-friendly named control codes instead of raw byte sequences, preventing escape sequence confusion in LLM interactions.

## Usage

```json
{
  "processId": "proc_xxx",
  "input": "print('hello')",
  "ctrlCode": "Enter"
}
```

Or raw sequences:

```json
{
  "processId": "proc_xxx",
  "input": "print('hello')",
  "ctrlCode": "\n"
}
```

## Available Control Codes

### REPL & Shell

| Name | Byte | Hex | Description |
|------|------|-----|-------------|
| `Enter` | `\n` | `0x0a` | Execute command / newline |
| `Return` | `\r` | `0x0d` | Carriage return |
| `Ctrl+C` | `\x03` | `0x03` | Interrupt process (SIGINT) |
| `Ctrl+D` | `\x04` | `0x04` | End of file / logout |
| `Tab` | `\t` | `0x09` | Auto-completion |
| `Ctrl+Z` | `\x1a` | `0x1a` | Suspend process (SIGTSTP) |
| `Ctrl+R` | `\x12` | `0x12` | Reverse search (bash) |

### Text Editors (vim/nano/emacs)

| Name | Byte | Hex | Description |
|------|------|-----|-------------|
| `Escape` | `\x1b` | `0x1b` | Exit insert mode (vim) |
| `Ctrl+[` | `\x1b` | `0x1b` | Alternative Escape |

### Shell Editing

| Name | Byte | Hex | Description |
|------|------|-----|-------------|
| `Ctrl+A` | `\x01` | `0x01` | Beginning of line |
| `Ctrl+E` | `\x05` | `0x05` | End of line |
| `Ctrl+U` | `\x15` | `0x15` | Clear line before cursor |
| `Ctrl+K` | `\x0b` | `0x0b` | Clear line after cursor |
| `Ctrl+W` | `\x17` | `0x17` | Delete word backward |
| `Ctrl+L` | `\x0c` | `0x0c` | Clear screen |

### Arrow Keys (ANSI escape sequences)

| Name | Byte | Description |
|------|------|-------------|
| `ArrowUp` | `\x1b[A` | Move up / history previous |
| `ArrowDown` | `\x1b[B` | Move down / history next |
| `ArrowLeft` | `\x1b[D` | Move cursor left |
| `ArrowRight` | `\x1b[C` | Move cursor right |

### Other

| Name | Byte | Hex | Description |
|------|------|-----|-------------|
| `Backspace` | `\x7f` | `0x7f` | Delete character |

## Aliases

Some control codes have multiple names for convenience:

- `EOF` = `Ctrl+D` = `\x04`
- `EOT` = `Ctrl+D` = `\x04`
- `Interrupt` = `Ctrl+C` = `\x03`
- `Ctrl+[` = `Escape` = `\x1b`

## Examples

### Example 1: Execute Python command

```json
{
  "processId": "proc_123",
  "input": "print('hello world')",
  "ctrlCode": "Enter"
}
```

### Example 2: Interrupt running process

```json
{
  "processId": "proc_123",
  "ctrlCode": "Ctrl+C"
}
```

### Example 3: Navigate shell history

```json
// Previous command
{
  "processId": "proc_123",
  "ctrlCode": "ArrowUp"
}

// Execute it
{
  "processId": "proc_123",
  "ctrlCode": "Enter"
}
```

### Example 4: Exit vim insert mode and save

```json
// Step 1: Exit insert mode
{
  "processId": "proc_123",
  "ctrlCode": "Escape"
}

// Step 2: Type save command (use raw mode for colon commands)
{
  "processId": "proc_123",
  "data": ":wq\n"
}
```

### Example 5: Shell line editing

```json
// Type wrong command
{
  "processId": "proc_123",
  "input": "wrong command"
}

// Clear entire line
{
  "processId": "proc_123",
  "ctrlCode": "Ctrl+U"
}

// Type correct command
{
  "processId": "proc_123",
  "input": "correct command",
  "ctrlCode": "Enter"
}
```

## Raw Byte Sequences

For advanced use cases, you can use raw byte sequences directly:

### Single bytes
- `"\n"` - Newline (LF)
- `"\r"` - Carriage return (CR)
- `"\t"` - Tab
- `"\x03"` - Ctrl+C
- `"\x1b"` - Escape

### Hex format
- `"\x00"` to `"\xff"` - Any byte value
- Maximum length: 4 bytes for control sequences

### Multi-byte sequences
- `"\x1b[A"` - Arrow Up
- `"\x1b[B"` - Arrow Down
- `"\x1b[C"` - Arrow Right
- `"\x1b[D"` - Arrow Left

## Validation

The `resolveControlCode()` function validates input:

1. **Named codes**: Resolved from `CONTROL_CODES` table
2. **Raw sequences**: Accepted if ≤ 4 bytes
3. **Invalid**: Throws error with available options

Example error:

```
Invalid control code: "InvalidCodeName". Use named codes (Enter, Escape, Ctrl+C) 
or raw sequences (\n, \x1b). Available codes: Enter, Escape, Tab, Ctrl+C, ...
```

## Implementation

Control codes are defined in `packages/mcp-pty/src/types/control-codes.ts`.

### Functions

```typescript
// Resolve control code name to byte sequence
resolveControlCode(code: string): string

// Check if string is a valid control code name
isControlCodeName(value: string): boolean

// List all available control code names
getAvailableControlCodes(): string[]
```

### Constants

```typescript
CONTROL_CODES: Record<string, string>
```

## See Also

- [Write Input Examples](./write-input-examples.md) - Practical usage examples
- [Inspect CLI Reference](../ref/inspect-cli.md) - CLI usage guide
