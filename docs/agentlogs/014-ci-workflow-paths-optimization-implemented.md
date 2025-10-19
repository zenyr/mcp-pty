## CI Workflow Paths Optimization Implemented

### Initial Approach
docs 변경시에도 전체 CI 실행되는 비효율성 발견.

### Issues Identified
ci.yml에 paths 필터 부재로 모든 변경에 CI 트리거.

### Solution Attempt
paths 필터 추가하여 src 변경시에만 CI 실행.

### Implementation Details
- paths: packages/!(website)/src/**, .github/workflows/ci.yml, package.json, tsconfig.json, bun.lock, biome.json 추가.
- docs/ 제외하여 docs 변경시 CI 스킵.

### Final Outcome
CI 최적화 완료. docs 변경시 불필요한 CI 실행 방지.