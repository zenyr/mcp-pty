# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
## [0.5.3]

### <!-- 1 -->🐛 BUG FIXES

- Replace force-push with PR auto-merge and remove version fallback (#50) ([`46520f8`](https://github.com/zenyr/mcp-pty/commit/46520f8c01f4fe1a0f6d35a27a9e29288bb76e1d))* fix: replace force-push with PR auto-merge and remove version fallback

    - Replace git push -f with gh pr create + auto-merge for main sync
    - Remove version_type || 'minor' fallback (already required: true)
    - Remove main branch PR review requirement (solo developer)
    - Preserves branch protection while enabling full automation

- Adapt release workflow for protected develop branch (#51) ([`093314c`](https://github.com/zenyr/mcp-pty/commit/093314cb7628f059b017b9a68b45130a2217b600))- Create release branch instead of direct push to develop
    - Sequential PR flow: release→develop (auto-merge) → develop→main (auto-merge)
    - Add polling mechanism to wait for develop PR merge before creating main PR
    - Auto-delete release branch after develop merge
    - Fixes #49


### <!-- 7 -->⚙️ MISCELLANEOUS TASKS

- Sync version to 0.5.0 to match NPM registry ([`2736254`](https://github.com/zenyr/mcp-pty/commit/273625437bd552f7ec827e22c95b43a394b94db0))

- Bump version to 0.5.2 (#52) ([`a4c2c3c`](https://github.com/zenyr/mcp-pty/commit/a4c2c3cc35df3282c7b4b4501d0c7d1fac003e7b))* fix: adapt release workflow for protected develop branch

    - Create release branch instead of direct push to develop
    - Sequential PR flow: release→develop (auto-merge) → develop→main (auto-merge)
    - Add polling mechanism to wait for develop PR merge before creating main PR
    - Auto-delete release branch after develop merge
    - Fixes #49

    * chore: bump version to 0.5.2

    Skip 0.5.1 (already published from failed workflow)
    Prepare for release workflow validation


