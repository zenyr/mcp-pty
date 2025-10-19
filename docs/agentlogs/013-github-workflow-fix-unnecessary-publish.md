## GitHub Workflow Fix for Unnecessary NPM Publish

### Initial Approach
이슈 #29 확인: Release 워크플로우가 main 브랜치 푸시 시마다 NPM publish 실행, packages/mcp-pty 코드 변경 없어도 트리거됨.

### Issues Identified
PR merge 시 코드 변경 없어도 워크플로우 실행, 불필요한 publish 발생.

### Solution Attempt
paths 조건 추가: website 제외한 모든 packages 변경 시만 워크플로우 실행.
내부 의존성(logger, pty-manager, session-manager) 변경도 포함하여 버전 스킵 방지.

### Implementation Details
- .github/workflows/release.yml on.push에 paths: ['packages/!(website)/**'] 추가
- website 패키지만 제외, 내부 의존 패키지 변경도 자동 감지

### TDD Process
- packages/mcp-pty 테스트 실행: 45 pass, 0 fail

### Final Outcome
워크플로우 수정 완료, 불필요한 NPM publish 방지.