# AgentLog Writing Guide

## Overview
AgentLogs document dev sessions for history, decisions, future ref. Fact-based, not opinions.

## File Naming
docs/agentlogs/{number}-{description}.md

- {number}: sequential (001, 002...)
- {description}: brief English hyphenated

Examples:
- 001-tested-bun-tty.md
- 006-normalize-commands-implementation-completed.md

## Document Structure

### Required Sections
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

### Optional Sections
```markdown
## Additional Updates
**Date:** {update date}
**Focus:** {update focus}

### Changes Made
- Specific changes

## Related Documents
- docs/file.md: reason
```

## Writing Principles

### 1. Objective and Specific
- Fact-based, include file names, method names, error msgs
- Quantify: "15 tests passed" not "worked well"

### 2. Chronological
- List What We Did in exec order
- Number steps

### 3. Future-Oriented
- Clear Next Steps
- Key Findings with lessons

### 4. Concise
- No fluff, sufficient context
- Grammar sacrificed for brevity

## When to Write
- End of dev session
- Major work unit complete (new pkg, feature)
- Error resolution or arch change

## Numbering Maintenance
1. List docs/agentlogs/ to check current files
2. Use next highest number
3. If duplicates, reorder by impl sequence
4. Update refs when renumbering

Follow for consistent AgentLogs tracking project evolution.

**Future Writers:** Use English, sacrifice grammar for brevity, prioritize concision. Follow these guidelines when writing new AgentLogs.