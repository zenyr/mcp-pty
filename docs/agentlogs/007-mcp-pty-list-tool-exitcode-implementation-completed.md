## MCP-PTY List Tool ExitCode Implementation Completed

### Initial Approach
User requested exitCode as number | null in list tool response.

### Issues Identified
PtyInfoSchema lacked exitCode field, list handler didn't include exitCode in pty objects.

### TDD Approach Adopted
Applied TDD: updated tests first, confirmed failure, modified code, verified pass.

### Implementation Details
- Added exitCode: z.number().nullable() to PtyInfoSchema
- Modified list handler to include exitCode: pty.getExitCode() in each pty object
- Updated test assertions to verify exitCode presence and type

### TDD Process
- Modified "list tool handler returns PTY list" test to check exitCode property
- All 26 tests passed, confirming type safety and functionality

### Final Outcome
List tool now provides exitCode (null for running, number for terminated) per PTY, maintaining type safety.