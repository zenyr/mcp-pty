## AgentLog Writing Guide

### Overview
AgentLogs document project development sessions for history, decisions, and future reference.

### File Naming
`docs/agentlogs/{number}-{description}.md`

- `{number}`: sequential (001, 002...)
- `{description}`: brief English description (hyphenated)

Examples:
- `001-tested-bun-tty.md`
- `006-normalize-commands-implementation-completed.md`

### Document Structure

#### Required Sections
```markdown
## {Package/Feature} Implementation Completed

### Initial Approach
{Starting method}

### Issues Identified
{Problems found}

### {Solution} Attempt
{Tried approach, why failed}

### Switched to {Final Solution}
{Adopted method, benefits}

### Implementation Details
- Key functions/methods
- Error handling

### TDD Process
- Test count and coverage
- Edge cases handled

### Final Outcome
{Success metrics, requirements met}
```

#### Optional Sections
```markdown
## Additional Updates
**Date:** {update date}
**Focus:** {update focus}

### Changes Made
- Specific changes

## Related Documents
- `docs/file.md`: reason
```

### Writing Principles

#### 1. Objective and Specific
- Fact-based, not opinions
- Include file names, method names, error messages
- Quantify: "15 tests passed" not "worked well"

#### 2. Chronological
- List What We Did in execution order
- Number steps

#### 3. Future-Oriented
- Clear Next Steps
- Key Findings with lessons

#### 4. Concise
- No fluff, but sufficient context
- Grammar sacrificed for brevity

### When to Write
- End of development session
- Major work unit complete (new package, feature)
- Error resolution or architecture change

### Numbering Maintenance
1. List `docs/agentlogs/` to check current files
2. Use next highest number
3. If duplicates, reorder by implementation sequence
4. Update references when renumbering

Follow this for consistent AgentLogs tracking project evolution.