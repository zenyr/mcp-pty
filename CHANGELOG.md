# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
## [0.1.4]

### <!-- 0 -->🚀 FEATURES

- Improve release workflow with PR-based version bump (#8) ([`12b77d4`](https://github.com/zenyr/mcp-pty/commit/12b77d4b2d93900118fd3b7474ba92caf3b67517))* feat: add GitHub Actions CI workflow (#4)

    * feat: add GitHub Actions CI workflow

    - Test & lint on push/PR to main
    - Multi-OS matrix (ubuntu/macos)
    - Type check, biome, bun test coverage
    - Separate build job after tests pass

    * fix: update CI triggers to include develop branch

    * feat: implement security hardening with command validation and input filtering (#3)

    * feat(security): add command validation for dangerous patterns and privilege escalation

    명령어 검증 기능을 추가하여 위험한 패턴과 권한 상승 명령어 실행을 방지합니다. MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS 환경 변수를 통해 사용자 동의를 요구합니다.

    * feat(security): add command validation for dangerous patterns and privilege escalation

    명령어 검증 기능을 추가하여 위험한 패턴과 권한 상승 명령어 실행을 방지합니다. MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS 환경 변수를 통해 사용자 동의를 요구합니다.

    * feat: enhance security with command validation and input filtering

    - Add dangerous pattern detection in normalize-commands (rm -rf /, fork bombs, etc.)
    - Expand privilege escalation detection (15+ commands including doas, su, run0, etc.)
    - Implement input validation for PTY write operations (block dangerous ANSI sequences)
    - Add MIT LICENSE file
    - Update biome config to allow control characters in security regex patterns
    - Fix linting issues and ensure all checks pass

    Security improvements prevent:
    - Command injection attacks via shell wrapping
    - Privilege escalation bypasses
    - Terminal manipulation via malicious ANSI sequences
    - Unauthorized system modifications

    * refactor: improve security validation with AST-based analysis

    - Replace regex-based validation with bash-parser AST analysis
    - Add comprehensive security test suites (59 new tests)
    - Fix ANSI escape sequence validation to allow safe color codes
    - Extract PRIVILEGE_ESCALATION_COMMANDS to shared constants
    - Remove false positives (chmod 644/755 now allowed, rm -rf /tmp allowed)
    - Add dangerous command detection: mkfs, dd to block devices, redirect to /dev/sd*
    - LICENSE: add trailing newline

    * fix: apply biome lint suggestions

    - Use optional chain for target?.text
    - Remove unused biome-ignore comments

    * feat: make pwd mandatory in start tool (#1)

    pwd 파라미터를 필수로 하여 작업 디렉토리 문제를 해결. 명령어가 올바른 디렉토리에서 실행되도록 보장.

    * feat: add automated NPM release workflow (#5)

    * feat: add automated NPM release workflow on main merge

    * docs: enforce English for all documentation and technical writing

    * fix: use fast-forward merge for linear history in release workflow

    * build: enable bundling for workspace dependencies

    * build: remove TypeScript sources from NPM package (CLI-only)

    * docs: add library type definitions to future plans

    * fix: make PtyOptions.cwd optional with process.cwd() fallback

    * fix: add cwd to all PtyOptions objects in tests and utils

    * ci: remove macOS matrix to reduce CI time (Linux sufficient)

    * fix: use global .npmrc to avoid workspace config conflict

    * feat: use PR for version bump to comply with branch protection

    * feat: add dry-run mode for release workflow testing

- Use PR for version bump to comply with branch protection ([`9978533`](https://github.com/zenyr/mcp-pty/commit/9978533e6d73e4cd39495ecd5f8cdcdb64b6ffb5))

- Add dry-run mode for release workflow testing ([`4b610f2`](https://github.com/zenyr/mcp-pty/commit/4b610f2cb0c20d2ad37b89df5be6308732c8a424))

- Enforce absolute path validation for working directory ([`01f4b6b`](https://github.com/zenyr/mcp-pty/commit/01f4b6b3a8630a3e87ae28b6f58431ee2583bc76))절대 경로 검증을 통해 PTY 프로세스의 작업 디렉토리 모호성을 제거하고 보안성을 강화합니다.

    - Path normalization utility: 절대 경로 및 틸드(~) 경로만 허용, 상대 경로 거부
    - Tilde expansion: ~ 및 ~/를 홈 디렉토리로 확장 (~username은 미지원)
    - Directory validation: 존재 여부 및 디렉토리 타입 검증 추가
    - Schema update: pwd 파라미터 설명에 절대 경로 요구사항 명시
    - Tests: 17개 단위 테스트 및 통합 테스트 추가 (총 45개 테스트 통과)

    상대 경로는 PTY 컨텍스트에서 예측 불가능한 동작을 유발할 수 있어 명시적으로 거부합니다.

- Add project website package for GitHub Pages ([`028fb7c`](https://github.com/zenyr/mcp-pty/commit/028fb7c7c14a91026f52d1972c97abfdce7e7c67))Create static landing page using Bun + React. Includes development server with hot-reloading, production build script with Bun.build API, and basic landing page with features/quickstart sections.

- Enhance website documentation and change default port (#14) ([`40e0d13`](https://github.com/zenyr/mcp-pty/commit/40e0d13ac1e4ed714312a2ec0d2a8733d9551040))* refactor(website): migrate to Bun 1.3.0 native build chain

    커스텀 build.ts/dev-server.ts 제거하고 Bun 네이티브 --hot 서버 및 HTML 번들링 활용. React 19 업그레이드 및 Bun.serve() 라우트 패턴 적용 (HMR/브라우저 로그 스트리밍 지원). AGENTS.md에 Bun 1.3.0+ 기능 가이드 추가.

    * feat(mcp-pty): change default HTTP port to 6420 and enhance website docs

    기본 HTTP 포트를 3000에서 6420으로 변경하여 React 등 일반적인 개발 서버와의 충돌 방지. 웹사이트에 Bun 런타임 필수 요구사항 경고, @zenyr/bun-pty 기술 스택 설명, HTTP 모드 사용 가이드 추가하여 사용자 온보딩 개선.

    * docs: add opencode credit to README

    * feat: add opencode credit to website and README

    * ci: remove --frozen-lockfile to allow lockfile updates in PRs

    * chore: sync lockfile with workspace package updates

    - Update mcp-pty version to 0.0.3
    - Standardize website package name to @pkgs/website alias
    - Sync workspace dependency mapping

    * docs: translate README to English and update default port to 6420

    * chore: trigger CI

    * fix: correct YAML indentation in CI workflow

- Implement two-stage release workflow with manual version control ([`e8ea970`](https://github.com/zenyr/mcp-pty/commit/e8ea970c9efd9551cfd2babf848b77dedb1b8f60))- Refactor release.yml: Manual version selection (patch/minor/major) via workflow_dispatch
    - Add changelog.yml: Separate workflow for CHANGELOG generation and GitHub Release
    - Add cliff.toml: Conventional commits configuration for automated changelog
    - Remove automatic push trigger; require manual workflow dispatch for safety
    - Decouple NPM publish from CHANGELOG/Release creation for independent operation

    Enables safer, more predictable releases while maintaining automation for changelog generation.

- Optimize CI workflow with parallel tests and Bun caching (#34) ([`115c0da`](https://github.com/zenyr/mcp-pty/commit/115c0dac125a6b6c6dc9fa6c1063ec6ab460394c))* feat: optimize CI workflow with parallel tests and Bun caching

    - Add GitHub Actions cache for Bun modules (key: bun.lock)
    - Enable parallel test execution with --concurrent --max-concurrency=6
    - Parallelize lint commands (check & format run concurrently)
    - Pin Bun version to latest, add --no-save for CI stability
    - Expected 40-45% CI time reduction (60-90s → 40-50s)

    * refactor: implement test isolation via callback pattern for concurrent execution

    - Add withTestSessionManager/withTestPtyManager higher-order functions
    - Eliminate test-scoped let/const variables (DRY principle)
    - Implement callback-scoped cleanup with finally blocks
    - Re-enable --concurrent --max-concurrency=6 in CI
    - Verified: 180 tests pass with zero race conditions
    - ~50-60% CI time reduction (60-90s → 30-40s)

    * fix: resolve test isolation race conditions in concurrent execution

    - Implement SessionTracker proxy to track only per-test created sessions
    - Refactor pty-process.test.ts to use withTestPtyProcess helper
    - Refactor mcp-server.test.ts to use withTestSessionManager helper
    - Verified: 195 tests pass with --concurrent --max-concurrency=6 (0 failures)
    - CI time reduced to ~26s (~70% faster than sequential execution)

    * docs: update AgentLog 015 with final test isolation results (70% CI speedup)

- Add examples and demos for MCP client configs and use cases (#38) ([`5b46020`](https://github.com/zenyr/mcp-pty/commit/5b46020d3de60dc7147cc06860138721fdee9a43))* feat: add examples and demos for MCP client configs and use cases

    - Add claude_desktop_config.json for stdio MCP client setup

    - Add http-server.ts for HTTP server deployment

    - Add use-cases.md with examples for dev server, interactive tools, build processes

    - Add AgentLog documenting implementation

- Add 64KB output buffer size limit for LLM context safety (#44) ([`7c7433f`](https://github.com/zenyr/mcp-pty/commit/7c7433fdc3b38bb076255660cbe3ee3f8e3ad3ce))* feat: add 64KB output buffer size limit for LLM context safety

    - Prevent unbounded memory growth from long-running processes
    - Maintains FIFO behavior: oldest output discarded when limit exceeded
    - 64KB optimized for LLM context windows (Claude ~8-200K tokens)
    - outputBuffer still used by toPromise(), getOutputBuffer(), and MCP resources
    - xterm/headless manages terminal rendering separately

    * docs: add agentlog for outputbuffer size limit implementation

    * style: apply biome format to http-server example


### <!-- 1 -->🐛 BUG FIXES

- Resolve NPM publish authentication issue (#7) ([`61fd9f0`](https://github.com/zenyr/mcp-pty/commit/61fd9f0f12f3a4015e7f5ba731bdaecf2d3cd691))* feat: add GitHub Actions CI workflow (#4)

    * feat: add GitHub Actions CI workflow

    - Test & lint on push/PR to main
    - Multi-OS matrix (ubuntu/macos)
    - Type check, biome, bun test coverage
    - Separate build job after tests pass

    * fix: update CI triggers to include develop branch

    * feat: implement security hardening with command validation and input filtering (#3)

    * feat(security): add command validation for dangerous patterns and privilege escalation

    명령어 검증 기능을 추가하여 위험한 패턴과 권한 상승 명령어 실행을 방지합니다. MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS 환경 변수를 통해 사용자 동의를 요구합니다.

    * feat(security): add command validation for dangerous patterns and privilege escalation

    명령어 검증 기능을 추가하여 위험한 패턴과 권한 상승 명령어 실행을 방지합니다. MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS 환경 변수를 통해 사용자 동의를 요구합니다.

    * feat: enhance security with command validation and input filtering

    - Add dangerous pattern detection in normalize-commands (rm -rf /, fork bombs, etc.)
    - Expand privilege escalation detection (15+ commands including doas, su, run0, etc.)
    - Implement input validation for PTY write operations (block dangerous ANSI sequences)
    - Add MIT LICENSE file
    - Update biome config to allow control characters in security regex patterns
    - Fix linting issues and ensure all checks pass

    Security improvements prevent:
    - Command injection attacks via shell wrapping
    - Privilege escalation bypasses
    - Terminal manipulation via malicious ANSI sequences
    - Unauthorized system modifications

    * refactor: improve security validation with AST-based analysis

    - Replace regex-based validation with bash-parser AST analysis
    - Add comprehensive security test suites (59 new tests)
    - Fix ANSI escape sequence validation to allow safe color codes
    - Extract PRIVILEGE_ESCALATION_COMMANDS to shared constants
    - Remove false positives (chmod 644/755 now allowed, rm -rf /tmp allowed)
    - Add dangerous command detection: mkfs, dd to block devices, redirect to /dev/sd*
    - LICENSE: add trailing newline

    * fix: apply biome lint suggestions

    - Use optional chain for target?.text
    - Remove unused biome-ignore comments

    * feat: make pwd mandatory in start tool (#1)

    pwd 파라미터를 필수로 하여 작업 디렉토리 문제를 해결. 명령어가 올바른 디렉토리에서 실행되도록 보장.

    * feat: add automated NPM release workflow (#5)

    * feat: add automated NPM release workflow on main merge

    * docs: enforce English for all documentation and technical writing

    * fix: use fast-forward merge for linear history in release workflow

    * build: enable bundling for workspace dependencies

    * build: remove TypeScript sources from NPM package (CLI-only)

    * docs: add library type definitions to future plans

    * fix: make PtyOptions.cwd optional with process.cwd() fallback

    * fix: add cwd to all PtyOptions objects in tests and utils

    * ci: remove macOS matrix to reduce CI time (Linux sufficient)

    * fix: use global .npmrc to avoid workspace config conflict

- Implement proper dry-run mode for release workflow (#10) ([`da64bf4`](https://github.com/zenyr/mcp-pty/commit/da64bf4fd27642a4b738699f2b7f505db0f8852d))* feat: add GitHub Actions CI workflow (#4)

    * feat: add GitHub Actions CI workflow

    - Test & lint on push/PR to main
    - Multi-OS matrix (ubuntu/macos)
    - Type check, biome, bun test coverage
    - Separate build job after tests pass

    * fix: update CI triggers to include develop branch

    * feat: implement security hardening with command validation and input filtering (#3)

    * feat(security): add command validation for dangerous patterns and privilege escalation

    명령어 검증 기능을 추가하여 위험한 패턴과 권한 상승 명령어 실행을 방지합니다. MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS 환경 변수를 통해 사용자 동의를 요구합니다.

    * feat(security): add command validation for dangerous patterns and privilege escalation

    명령어 검증 기능을 추가하여 위험한 패턴과 권한 상승 명령어 실행을 방지합니다. MCP_PTY_USER_CONSENT_FOR_DANGEROUS_ACTIONS 환경 변수를 통해 사용자 동의를 요구합니다.

    * feat: enhance security with command validation and input filtering

    - Add dangerous pattern detection in normalize-commands (rm -rf /, fork bombs, etc.)
    - Expand privilege escalation detection (15+ commands including doas, su, run0, etc.)
    - Implement input validation for PTY write operations (block dangerous ANSI sequences)
    - Add MIT LICENSE file
    - Update biome config to allow control characters in security regex patterns
    - Fix linting issues and ensure all checks pass

    Security improvements prevent:
    - Command injection attacks via shell wrapping
    - Privilege escalation bypasses
    - Terminal manipulation via malicious ANSI sequences
    - Unauthorized system modifications

    * refactor: improve security validation with AST-based analysis

    - Replace regex-based validation with bash-parser AST analysis
    - Add comprehensive security test suites (59 new tests)
    - Fix ANSI escape sequence validation to allow safe color codes
    - Extract PRIVILEGE_ESCALATION_COMMANDS to shared constants
    - Remove false positives (chmod 644/755 now allowed, rm -rf /tmp allowed)
    - Add dangerous command detection: mkfs, dd to block devices, redirect to /dev/sd*
    - LICENSE: add trailing newline

    * fix: apply biome lint suggestions

    - Use optional chain for target?.text
    - Remove unused biome-ignore comments

    * feat: make pwd mandatory in start tool (#1)

    pwd 파라미터를 필수로 하여 작업 디렉토리 문제를 해결. 명령어가 올바른 디렉토리에서 실행되도록 보장.

    * feat: add automated NPM release workflow (#5)

    * feat: add automated NPM release workflow on main merge

    * docs: enforce English for all documentation and technical writing

    * fix: use fast-forward merge for linear history in release workflow

    * build: enable bundling for workspace dependencies

    * build: remove TypeScript sources from NPM package (CLI-only)

    * docs: add library type definitions to future plans

    * fix: make PtyOptions.cwd optional with process.cwd() fallback

    * fix: add cwd to all PtyOptions objects in tests and utils

    * ci: remove macOS matrix to reduce CI time (Linux sufficient)

    * fix: use global .npmrc to avoid workspace config conflict

    * feat: use PR for version bump to comply with branch protection

    * feat: add dry-run mode for release workflow testing

    * fix: remove non-existent label from PR creation

    * fix: properly implement dry-run mode with event type checks

- Remove non-existent label from PR creation ([`47c3209`](https://github.com/zenyr/mcp-pty/commit/47c3209c86bf0a7b1e794d85d4d1d6c355ae9b97))

- Properly implement dry-run mode with event type checks ([`16aedcb`](https://github.com/zenyr/mcp-pty/commit/16aedcb39bc367281884246aa21cee431eab3929))

- Resolve merge conflict with proper dry-run implementation ([`f27ec8c`](https://github.com/zenyr/mcp-pty/commit/f27ec8ca538bedde1a3c40c90ca8bf423576c0ab))

- Handle empty input gracefully with warning (#15) (#16) ([`746b6b8`](https://github.com/zenyr/mcp-pty/commit/746b6b8bd75e614994a1c358be68e580e39eaea9))- Add empty input validation in PtyProcess.write() method
    - Return warning message instead of throwing ArrayBufferView error
    - Update MCP tool schemas to support optional warning field
    - Add comprehensive test coverage for edge cases
    - Add CHANGELOG.md for tracking notable changes

- Remove unused variable and correct test assertion ([`86eeabf`](https://github.com/zenyr/mcp-pty/commit/86eeabf73ee12d6c7c3848adcea4a55057df519e))PtyProcess 코드 품질을 개선하여 불필요한 변수와 잘못된 테스트 어서션을 수정합니다.

    - process.ts: toPromise()에서 사용하지 않는 구독 변수 제거
    - pty-process.test.ts: write throws 테스트에서 불필요한 await 제거

- Add paths condition to release workflow to prevent unnecessary NPM publish ([`ab240f5`](https://github.com/zenyr/mcp-pty/commit/ab240f5bf231751341eb14529ceb5493f7322018))- Add paths: ['packages/mcp-pty/**'] to on.push in .github/workflows/release.yml
    - Only trigger workflow when packages/mcp-pty has changes
    - Resolves issue #29

- Expand release workflow trigger to all packages except website ([`efdc813`](https://github.com/zenyr/mcp-pty/commit/efdc813602577561a7633d181f663792c0b8ab9b))- Change paths from 'packages/mcp-pty/**' to 'packages/!(website)/**'
    - Ensures internal dependency changes (logger, pty-manager, session-manager) trigger publish
    - Prevents version skips when dependencies are updated
    - Fixes issue #29 with broader scope for monorepo packages

- Trigger GitHub Pages deploy only on website package changes ([`7d67de5`](https://github.com/zenyr/mcp-pty/commit/7d67de5f2c296289816560d952ca0233eff55abc))Optimize CI/CD by adding path filter to deploy-pages workflow. Deploy now only triggers when packages/website or workflow config changes, avoiding unnecessary executions on other repo changes.

- Resolve PR #33 review comments on release workflow ([`f186483`](https://github.com/zenyr/mcp-pty/commit/f186483709752aadf6c84ae1d4ed1c9c687653ca))- Inline CHANGELOG generation to eliminate race condition (critical fix)
    - Add NPM publish rollback on failure to prevent zombie version bumps
    - Change merge strategy from --ff-only to --no-ff for reliability
    - Fix cliff.toml regex pattern: 'doc' → 'docs?' to match both singular/plural
    - Remove separate changelog.yml workflow (consolidated into release.yml)
    - Update AgentLog with rationale for design decisions

- Optimize CI workflow paths for src changes (#36) ([`7899f1c`](https://github.com/zenyr/mcp-pty/commit/7899f1c2093049528147c1ecfd194f3968389d39))* fix: optimize CI workflow to run only on src changes

    - Add paths filter to ci.yml to trigger CI only when packages/!(website)/src/** or related config files change
    - Prevents unnecessary CI runs for docs changes
    - Improves build efficiency

    * docs: add agent info to AgentLog

- Correct YAML indentation in release workflow ([`126a4b1`](https://github.com/zenyr/mcp-pty/commit/126a4b11a81f23fd79faeaeab3f7fbe239b34804))- Fix inconsistent indentation causing parsing errors
    - Ensure workflow_dispatch trigger works properly

- Correct YAML indentation in release workflow ([`3a76c86`](https://github.com/zenyr/mcp-pty/commit/3a76c86078700d72b55db3ac8468667b9c152b4b))- Fix indentation for Configure Git step to match other steps

- Correct YAML indentation for all steps in release workflow ([`b504bcc`](https://github.com/zenyr/mcp-pty/commit/b504bcc23461dcc1d3ba81330653d30c62372da9))- Ensure consistent 7-space indentation for all step items

- Remove blank line between permissions and steps in YAML ([`e42cca3`](https://github.com/zenyr/mcp-pty/commit/e42cca30a6d17e195584fdf61fb2141c6185b88d))- Fix YAML parsing error by removing unnecessary blank line

- Quote job name to avoid YAML parsing issues with & ([`20239ed`](https://github.com/zenyr/mcp-pty/commit/20239ed3742dffef30a455931dab925873ba2e25))- Wrap job name in quotes to prevent YAML anchor conflicts

- Standardize YAML indentation to 2 spaces ([`9916203`](https://github.com/zenyr/mcp-pty/commit/9916203ff9643cb53cb7162a5f1f357c1c61a2b5))- Change from inconsistent indentation to standard GitHub Actions format
    - Use 2-space indentation throughout the workflow

- Quote workflow name to avoid YAML parsing issues ([`810ffa8`](https://github.com/zenyr/mcp-pty/commit/810ffa88ee206115e4378da63f1b0f0fde2fbd79))- Wrap workflow name in quotes to prevent & character conflicts

- Ensure release workflow runs on main branch ([`8cd5500`](https://github.com/zenyr/mcp-pty/commit/8cd550004e88e4c7f1226ec074981332bb1f20eb))- Add ref: 'main' to checkout step
    - Add push to main after commits
    - Maintain sync to develop branch

- Resolve release workflow issues ([`d86d78f`](https://github.com/zenyr/mcp-pty/commit/d86d78f9dc5dbdd3d8e8ab73ce7db19539f1d4d7))- Remove prepublishOnly hook to prevent duplicate test runs
    - Generate CHANGELOG before commit to avoid tag mismatch
    - Fix workflow to run from develop branch and merge to main
    - Add proper rollback handling with tag cleanup
    - Consolidate version bump and CHANGELOG into single commit

- Make now variable optional in cliff.toml template ([`8ba8c4c`](https://github.com/zenyr/mcp-pty/commit/8ba8c4c9dbea57291926cbe85335c5b4684a4a78))Handle case where --unreleased flag is used without a version/date context.
    Wraps now variable in conditional to prevent template render error.

- Bypass branch protection for release workflow push ([`944731a`](https://github.com/zenyr/mcp-pty/commit/944731ad5d8a270fd223d2aa67ffe326cd69ed9d))- Add pull-requests write permission
    - Use git push -f to force push commits to protected develop branch
    - Allows workflow_dispatch to update develop without PR requirement

- Reorder workflow steps to push tag first, merge to main, then sync back to develop ([`04f0de3`](https://github.com/zenyr/mcp-pty/commit/04f0de30043e7d600c420ec71ad373f941fd4a19))- Push tag to origin
    - Merge develop to main and push main
    - Sync main back to develop with force push
    - Avoids direct develop branch protection violations


### <!-- 10 -->💼 OTHER

- Upgrade dependencies and remove duplicate pty package ([`5f4c352`](https://github.com/zenyr/mcp-pty/commit/5f4c35261d654115abd834230950e5d6511141e8))Update @biomejs/biome to 2.2.6 and @zenyr/bun-pty-darwin-arm64 to 0.4.3. Remove duplicate optionalDependencies entry for @zenyr/bun-pty-darwin-arm64 (already in @zenyr/bun-pty). Add React/ReactDOM for website package.


### <!-- 2 -->🚜 REFACTOR

- Restructure CI workflow for efficient validation (#39) ([`6b56e46`](https://github.com/zenyr/mcp-pty/commit/6b56e46ebdf41a4d1e2611fc0cb8eb8d10d722f0))* refactor: decompose CI workflow into reusable test and build jobs

    - ci.yml: lightweight orchestrator that calls test.yml and build.yml
    - test.yml: extracted as reusable workflow_call for test & lint tasks
    - build.yml: extracted as reusable workflow_call for build tasks
    - simplifies maintenance and allows future flexible trigger configurations

    * refactor: restructure CI workflow for efficient validation

    - ci.yml: always runs, uses paths-filter to detect code changes
    - test.yml: parallel lint/test/build jobs (only runs on code changes)
    - docs-only PRs skip heavy CI, pass immediately with success job
    - eliminates computing waste while ensuring all PRs get status check


### <!-- 3 -->📚 DOCUMENTATION

- Consolidate plan.md with concise formatting ([`ccdfdf3`](https://github.com/zenyr/mcp-pty/commit/ccdfdf31be31887c1ee31c5b5e9c5afa2cf3efd8))Streamline plan.md by reducing verbosity while maintaining clarity. Simplify task descriptions, status indicators, and roadmap sections for improved readability.

- Translate README.md to English (#17) ([`c267f27`](https://github.com/zenyr/mcp-pty/commit/c267f27dc9332c0df86b40edafc3a5e63b826fb2))

- Update howto and summary guides ([`0eae86d`](https://github.com/zenyr/mcp-pty/commit/0eae86d456c569499fb67020c414d5ca677aaca0))AgentLog 작성 가이드와 요약 문서를 개선하여 가독성과 일관성을 높입니다.

    - howto.md: 구조 개선, 영어 우선 원칙 추가, 간결성 강조
    - summary.md: 영어 번역, 012 로그까지 업데이트
    - 012-readme-update-completed.md: README 업데이트 로그 추가

- Enhance README with features section and API details ([`4a5657d`](https://github.com/zenyr/mcp-pty/commit/4a5657d4d153b8ac1e76c9c8373073b5a25d9f52))README를 최신 기능과 상세한 API 문서로 개선하여 사용자 온보딩을 강화합니다.

    - Features 섹션 추가: 주요 기능 9가지 요약
    - API 문서 개선: 리소스와 툴 설명 상세화, 파라미터 명시
    - 오류 코드 및 구성 옵션 유지

- Add PR guidelines section ([`94f22e2`](https://github.com/zenyr/mcp-pty/commit/94f22e24980bbfa4f8d0d37210290c34d3042bd7))AGENTS.md에 PR 가이드라인 섹션을 추가하여 PR 생성 프로세스를 표준화합니다.

    - AgentLogs 작성 요구사항 추가
    - 커밋 세분화 및 PR 설명 가이드 추가

- Add mandatory @git subagent guidelines for commit operations ([`896254d`](https://github.com/zenyr/mcp-pty/commit/896254d079de1db30288bec85cda32b11981663c))- Require all git commits/pushes to use Task(@git) subagent
    - Add clear delegation rules and example prompts
    - Prevent direct bash git commands in main agent
    - Improves consistency and audit trail

- Clarify git agent delegation in AGENTS.md ([`7a18640`](https://github.com/zenyr/mcp-pty/commit/7a186404a607670360e83506956df1d9dd376fba))Add explicit guidance to use @git agent for all git commit operations via Task tool. Improves consistency and prevents developers from making manual commits.

- Compress AGENTS.md for conciseness without information loss ([`61893ec`](https://github.com/zenyr/mcp-pty/commit/61893ec54bc9be3363a9112b1f0242a5a65cbe31))Improve developer experience by reducing document scanning time while maintaining all critical constraints, requirements, and rationales:
    - Language Policy: Condensed multi-line into single line
    - TypeScript Expert: Compressed categories, preserved all technical details
    - Workspace: Merged into single line with all constraints (no any/!, type guards, path aliases, SDK)
    - Bun Developer: Split into 3 focused subsections, maintained all tech stack requirements
    - Prohibitions: Compressed while retaining all rules
    - Git & Commits: Already documented in prior commit

- Comprehensive developer documentation for Issue #19 (#35) ([`39fb84d`](https://github.com/zenyr/mcp-pty/commit/39fb84d6c0a2d91d51b4fc4b18b60a10a727dd8a))- Add architecture deep-dive with system overview and package details
    - Add package interaction diagrams with Mermaid visualizations
    - Add contribution guidelines with development workflow and standards
    - Add development setup guide with environment configuration
    - Add normalize-commands integration documentation
    - Create AgentLog documenting implementation process

- Fix inaccuracies and remove unnecessary details from developer documentation (#37) ([`bd52743`](https://github.com/zenyr/mcp-pty/commit/bd5274374241d413574c2466f52f2a033abef983))- Fix monitoring interval documentation (1-minute, not configurable)
    - Remove incorrect 'bun link' setup instructions
    - Fix TypeScript import preference to 'non-relative' (aligns with @pkgs/*)
    - Simplify normalize-commands doc (remove benchmarks, future specs, troubleshooting)
    - Reduce documentation from 1,930 to 1,782 lines for clarity

    Related to PR #35 review findings. Removes 166 lines of non-essential detail while preserving actionable integration guidance.

- Add agent identity and communication guidelines to PR section (#40) ([`773d391`](https://github.com/zenyr/mcp-pty/commit/773d391d4c3ec88d9760a5c79406ccb644979b65))

- Add agent identity and communication guidelines to PR section ([`58aba97`](https://github.com/zenyr/mcp-pty/commit/58aba97d0b351ab89c9088ad8b1dd5e34ebac4b1))

- Add agentlog for branch protection setup ([`cc8e3b9`](https://github.com/zenyr/mcp-pty/commit/cc8e3b946176a2439440e10987329e506c58a13f))- Enabled PR requirement and CI checks for develop branch
    - Prevents direct pushes to enforce code review process

- Clean up agentlogs numbering to remove duplicates ([`de07f33`](https://github.com/zenyr/mcp-pty/commit/de07f33dc66edeb756aefeaa9c9130583bd02d78))- Resolved duplicate numbers 014 and 017 by shifting subsequent files
    - Maintained chronological order and file integrity
    - No content changes, only filename renumbering

- Fix agentlogs numbering duplicates (#47) ([`a6bb45e`](https://github.com/zenyr/mcp-pty/commit/a6bb45e2437331f024cc7598bd1ed750f752c620))- Renamed duplicate 014 and 017 files to sequential numbers
    - All agentlogs now have unique numbering from 001 to 022

- Add agentlogs for branch protection and release process ([`7f4455e`](https://github.com/zenyr/mcp-pty/commit/7f4455ec0e8cc15c7cb9adde2405e75ec7a774ec))- Add 023-fix-branch-protection-require-checks.md
    - Add 024-release-process-initiated.md


### <!-- 7 -->⚙️ MISCELLANEOUS TASKS

- Bump version to 0.0.2 ([`4373f25`](https://github.com/zenyr/mcp-pty/commit/4373f2593d497113ee971f5c006235fbf271c751))

- Bump version to 0.0.3 ([`2655993`](https://github.com/zenyr/mcp-pty/commit/26559931a622be9c04beae2852be672d9a0df8f3))

- Sync version from main (v0.0.2) ([`b33a184`](https://github.com/zenyr/mcp-pty/commit/b33a18464ed3bb43a0f6b1e60bf8701636094f38))

- Sync with main ([`05964d1`](https://github.com/zenyr/mcp-pty/commit/05964d155af9e736ed26a251c207229589c21f7c))

- Update biome config to 2.2.6 and fix lint warnings ([`ef6528d`](https://github.com/zenyr/mcp-pty/commit/ef6528dfeb608eae67a6073352f83d4abed6aa73))Migrate biome schema from 2.2.5 to 2.2.6. Add radix parameter to parseInt call in dev-server.ts to fix lint warning.

- Add GitHub Pages deployment workflow ([`9a9c429`](https://github.com/zenyr/mcp-pty/commit/9a9c429080a6c7d7e83e0078d659f5ad543ecf17))Automate static site deployment on push to main/develop branches. Build website package with Bun and deploy to GitHub Pages using official deploy-pages action.

- Bump all package versions to 0.0.4 ([`05b843c`](https://github.com/zenyr/mcp-pty/commit/05b843cbc168594ca7aec28e0b5a11c242ee3215))Synchronize version numbers across all workspace packages before release workflow testing

- Set version to 0.1.1 for next release ([`cef0542`](https://github.com/zenyr/mcp-pty/commit/cef0542a4ee8a597e9c9fd873d945cce507a372d))

- Set version to 0.1.3 for next release ([`cf7c201`](https://github.com/zenyr/mcp-pty/commit/cf7c2011ab1c128c5e81a77d63f5b629d749fe50))


