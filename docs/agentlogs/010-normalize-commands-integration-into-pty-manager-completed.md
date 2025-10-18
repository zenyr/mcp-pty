## normalize-commands Integration into pty-manager Completed

### Initial Approach
PtyProcess used simple string split for command parsing, ignoring complex bash syntax.

### Issues Identified
Command parsing failed for pipelines, redirections, and logical operators, leading to incorrect execution.

### Switched to normalizeCommand Integration
Adopted bash-parser based normalizeCommand for accurate command and args extraction.

### Implementation Details
- Added @pkgs/normalize-commands dependency to pty-manager/package.json
- Imported normalizeCommand in PtyProcess
- Modified init() to parse commands with JSON.parse(normalizeCommand(this.options.command))
- Ensured fallback handling for parsing errors

### TDD Process
- Added 3 normalization tests in pty-process.test.ts
- Verified simple, pipeline, and redirection commands
- All 72 tests passed, including new ones

### Final Outcome
normalize-commands now properly handles complex commands in pty-manager, improving execution accuracy.