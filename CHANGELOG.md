# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
## [0.3.1]

### <!-- 1 -->🐛 BUG FIXES

- Resolve merge conflicts by resetting main to develop state ([`2320704`](https://github.com/zenyr/mcp-pty/commit/2320704e73fffa26d2704e71456383693162bd90))- Use git reset --hard instead of merge to avoid conflicts
    - Ensures main and develop are synchronized after release
    - Main will be fast-forward to latest develop state

- Handle duplicate tag by deleting before creation ([`43d5cf9`](https://github.com/zenyr/mcp-pty/commit/43d5cf9dab8eaa10e4ff371d3839e9ff952f0a04))- Delete local tag if it exists before creating new one
    - Prevents 'tag already exists' error from repeated workflow runs


### <!-- 7 -->⚙️ MISCELLANEOUS TASKS

- Set version to 0.3.0 ([`02def26`](https://github.com/zenyr/mcp-pty/commit/02def2613215c8420ce7d80dca16536e5ba0a4a9))


