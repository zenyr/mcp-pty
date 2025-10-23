## Release Process & Infrastructure Setup

### Phase 1-3: Branch Protection, Package Release & Documentation

Fixed branch protection rules on develop branch requiring all status checks before merge. Initiated mcp-pty release from v0.0.3 → v0.0.4 via GitHub Actions workflow. Corrected README package name references (`mcp-pty-server` → `mcp-pty`).

### Key Changes
- Updated develop branch protection to enforce required status checks
- Confirmed v0.0.4 availability on npm registry for clean patch bump
- Fixed README title & installation docs to match actual package name `mcp-pty`
- Leveraged existing release.yml workflow for automated CI/CD version bump & publish

### Outcome
Branch protection enforced, release workflow triggered, README documentation accurate. PR #48 created against develop branch.
