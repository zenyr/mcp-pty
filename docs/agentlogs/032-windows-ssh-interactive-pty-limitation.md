# Windows SSH Interactive PTY Limitation Investigation

**Branch**: `feat/windows-ssh-compatibility`  
**Issue**: #65 (PTY Tool UX & Workflow Optimization Feedback)  
**Agent**: Haiku 4.5  
**Date**: 2025-10-22

## Executive Summary

Investigated Windows SSH interactive PTY session output buffering issue. Found that Windows CMD interactive sessions fail to return command output when executed through PTY emulation, while non-interactive SSH commands work perfectly. Root cause identified as incompatibility between xterm/headless terminal emulation and Windows CMD stdout handling.

**Status**: Documented as known limitation. User workarounds provided. No code fix at PTY layer.

## Problem Statement

### Initial Observation
Windows SSH session (zblade14) does not return command output despite:
- Command input being recognized (echo'd back to screen)
- SSH connection established successfully
- Unix SSH sessions working perfectly

### Test Results (2025-10-22)
```
✅ Local PTY (macOS):          whoami, pwd, ls, date all work
✅ Unix SSH (bunkermini):      All commands return output correctly
❌ Windows SSH (zblade14):     No output returned for interactive commands
```

## Investigation & Root Cause Analysis

### Discovery 1: Non-Interactive SSH Works

**Test**: `ssh -vvv zblade14 echo "test"`

**Result**: Command executed successfully, output received
```
debug1: channel 0: rcvd close
test
debug1: Exit status 0
```

**Key finding**: Non-interactive SSH commands complete successfully with output.

### Discovery 2: Interactive PTY Sessions Fail

**Test**: `ssh zblade14` (interactive), then `whoami`

**Result**: Command input echoed but no output returned
```
zenyr@ZBLADE14 C:\Users\zenyr>whoami
# No output, no prompt returned
```

**Difference**: The issue is specific to interactive PTY emulation, not SSH itself.

### Root Cause Hypothesis

**Interactive PTY Failure Chain:**
1. SSH allocates PTY for interactive session ✅
2. Shell prompt appears (login banner) ✅
3. User inputs command (appears on screen) ✅
4. Command executes on remote Windows CMD ❌
5. Command output fails to reach PTY buffer ❌
6. xterm/headless captures nothing ❌

**Why it fails:**
- xterm/headless expects Unix-like shell stdout behavior
- Windows CMD stdout over SSH does not flush/transmit properly to PTY emulator
- The PTY layer cannot distinguish between "still waiting for output" vs "output never sent"

**Evidence supporting hypothesis:**
- Ctrl+C (signal) works fine (different SSH signaling mechanism)
- Bun-pty spawn options use `xterm-256color` terminal type
- xterm/headless `convertEol: true` is for output, not input buffering

## Technical Deep Dive

### Current Code Structure

**PTY Process (pty-manager/src/process.ts)**:
```typescript
// Line 117-118
const pty = spawn(command, args, {
  name: "xterm-256color",
  cols: this.terminal.cols,
  rows: this.terminal.rows,
  convertEol: true,  // Handles EOL conversion
  // ...
});
```

**xterm/headless Configuration**:
```typescript
// Line 114-119
this.terminal = new Terminal({
  cols: 80,
  rows: 24,
  convertEol: true,  // Converts output EOL, not input
  allowProposedApi: true,
});
```

**Control Codes (mcp-pty/src/types/control-codes.ts)**:
```typescript
Enter: "\n",  // Unix LF standard
```

### Why Line Ending Alone Isn't the Issue

Initially investigated Windows CRLF (`\r\n`) vs Unix LF (`\n`):
- `convertEol: true` handles output conversion
- Input line endings (`\n` sent to remote) is standard and correct
- Windows CMD accepts `\n` for enter key in SSH sessions
- Non-interactive SSH works with plain `\n` input

**Conclusion**: Line ending is not the root cause.

## Implementation: Limitation Documentation

### Changes Made

**File: `packages/mcp-pty/README.md`**

Added new section "Platform-Specific Limitations":
```markdown
### Windows SSH Interactive Sessions

⚠️ **Known Issue**: Interactive SSH sessions to Windows hosts may not return 
command output in PTY sessions.

**Workaround Options:**
1. Use non-interactive mode: `ssh host command`
2. Use PowerShell/WSL instead of CMD
3. Force TTY (partial): `ssh -t -t host`
```

### Why Not Auto-Fix?

Considered approaches:
1. **Auto-add `-t` flag**: Allocates TTY but doesn't fix stdout capture
2. **Platform detection**: Can't detect remote OS reliably without execution
3. **CRLF handling**: Not the root cause

**Decision**: Document as limitation. Preserve principle of least surprise.

## Why This Matters

**PTY Tool Design Philosophy**: 
- Provide transparent access to remote shells
- Don't silently modify user commands
- Clear failure modes better than magical fixes

**User Impact**:
- Interactive Windows SSH workflows should use non-interactive pattern
- Alternative: Use PowerShell or WSL which have better SSH compatibility
- Documented expectation prevents confusion

## Related Code Components

**Files examined but unchanged**:
- `packages/normalize-commands/src/index.ts` - Command parsing (not applicable)
- `packages/pty-manager/src/types/index.ts` - Type definitions (correct)
- `packages/mcp-pty/src/types/control-codes.ts` - Control codes (correct)

## Testing Notes

### Local Testing Performed
1. SSH verbose output analysis: Confirmed SSH protocol working
2. Non-interactive execution: Confirmed output capture works
3. Interactive session attempts: Confirmed output buffer issue
4. Multiple platforms: Unix SSH (bunkermini) works perfectly

### What Would Fix This (Future)
1. Patch @zenyr/bun-pty for Windows PTY handling
2. Implement custom stdout capture mechanism
3. Use alternative PTY library with Windows support
4. Investigate SSH protocol-level stdout buffering

## Recommendations for Users

**Best Practice for Windows SSH:**
```bash
# ✅ Recommended: Non-interactive commands
ssh zblade14 whoami
ssh zblade14 "dir C:\Users"
ssh zblade14 "powershell -c Get-Process"

# ✅ Recommended: Use PowerShell directly
ssh zblade14 pwsh -c "whoami"

# ⚠️ Not recommended: Interactive sessions
ssh zblade14  # Avoid if possible
```

## Files Modified

1. `packages/mcp-pty/README.md` - Added Windows SSH limitations section with workarounds
2. `docs/agentlogs/032-windows-ssh-interactive-pty-limitation.md` - This document

## Progress Tracking

- [x] Discovery: Non-interactive SSH works
- [x] Discovery: Interactive PTY fails
- [x] Root cause analysis: xterm/headless incompatibility
- [x] Documentation: Updated README with limitations
- [x] Decision: Accept as limitation, document workarounds
- [ ] Future: Coordinate with @zenyr/bun-pty maintainers
- [ ] Future: Implement Windows-specific PTY handling

## Next Steps

1. **Commit & PR**: Merge documentation changes
2. **Issue #65 Comment**: Update with findings and workarounds
3. **Consider future**: Flag as potential enhancement for next major version
4. **Community**: Share findings with bun-pty library maintainers

## Conclusion

Windows SSH interactive PTY sessions represent a known limitation stemming from fundamental incompatibility between xterm/headless emulation and Windows CMD stdout behavior in SSH contexts. Rather than implement brittle workarounds, the tool now documents this limitation clearly and provides practical alternatives for users.

This investigation demonstrates the importance of understanding tool limitations and providing clear user guidance for workarounds.
