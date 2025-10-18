## normalize-commands Package Implementation Completed

### Initial Approach
Started with simple string includes() for shell operator detection (&& || | ; > >> < << quotes).

### Issues Identified
- Quotes inside operators not handled: echo "foo&&bar" incorrectly flagged as shell command.
- Inaccurate for complex bash syntax.

### Tree-sitter Attempt
Tried tree-sitter-bash for AST parsing, but failed due to Bun's native module compatibility issues (prebuilds missing for darwin-arm64).

### Switched to bash-parser
Adopted bash-parser (pure JS) for accurate AST-based detection.
- Parses bash to AST, detects pipelines, redirects, logical ops via node types.
- Ignores operators inside quotes (AST removes quotes).
- Added regex fallback for edge cases (incomplete heredocs).

### Implementation Details
- normalizeCommand(): input → AST → requiresShell check → extract command/args or sh -c.
- requiresShell: checks Pipeline, LogicalExpression, multiple commands, Redirect nodes.
- extractCommandInfo: pulls command name and Word args from AST.
- Error handling: parse failure → fallback to sh -c.

### TDD Process
- 18 unit tests: single commands, pipelines, redirections, quotes, heredocs, multiline.
- All pass, covering edge cases like quotes with internal operators.

### Final Outcome
Accurate bash command normalization with quote-aware shell detection. Supports mcp-pty Phase 4.8 requirements.