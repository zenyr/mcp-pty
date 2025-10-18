## Normalize-Commands Test Enhancement Completed

### Initial Approach
Reviewed existing normalize-commands package test coverage for command parsing accuracy.

### Issues Identified
- Environment variable assignments like `DEBUG=1 echo foo` were incorrectly parsed as command "echo" with args ["foo"]
- Missing test cases for complex argument patterns with equals signs
- Test code had duplication opportunities

### Environment Variable Parsing Fix Attempt
Modified `extractCommandInfo` to check for `cmd.prefix` and return null when present, forcing shell execution.

### Enhanced Shell Detection Logic
Updated `requiresShellExecution` to check for environment variable assignments in command prefix.

### Test Case Expansion
Added comprehensive test cases:
- `foo --cwd=1 bar baz` → command "foo", args ["--cwd=1","bar","baz"]
- `foo bar=1 baz` → command "foo", args ["bar=1","baz"]
- `VAR1=1 VAR2=2 echo hello` → sh -c execution
- `DEBUG=1` → sh -c execution
- `A=1 B=2 C=3 echo test` → sh -c execution

### DRY Refactoring
Converted 24 individual test cases to `test.each` array format, eliminating code duplication.

### TDD Process
- Initial: 18 tests passing
- Added: 6 new test cases for environment variables and argument parsing
- Refactored: All 24 tests using data-driven approach
- All tests passing with proper shell detection for environment variables

### Final Outcome
Environment variable assignments now correctly trigger shell execution via sh -c. Argument parsing with equals signs works correctly. Test suite is DRY and maintainable.