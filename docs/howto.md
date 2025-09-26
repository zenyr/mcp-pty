# AgentLog 작성 가이드

## 개요

AgentLog는 프로젝트 개발 과정의 기록을 체계적으로 관리하기 위한 문서입니다. 각 개발 세션의 작업 내용을 기록하여 프로젝트 히스토리, 의사결정 과정, 그리고 미래 개발자를 위한 참고 자료로 활용됩니다.

## 파일명 규칙

`docs/agentlogs/{number}-{description}.md`

- `{number}`: 연속적인 번호 (001, 002, 003...)
- `{description}`: 작업 내용의 간단한 영어 설명 (하이픈으로 연결)

예시:

- `001-tested-bun-tty.md`
- `002-updated-docs-for-current-implementation.md`
- `003-session-manager-implementation-completed.md`

## 문서 구조

### 필수 섹션

```markdown
# DevLog.{number} - {Title}

**Date:** {YYYY-MM-DD 형식의 날짜}  
**Focus:** {세션의 주요 초점 한 줄 요약}

## Summary

{세션 전체 작업의 간단한 요약. 2-3문장}

## What We Did

### 1. {주요 작업 1}

- 세부 내용
- 세부 내용

### 2. {주요 작업 2}

- 세부 내용

## Files Worked On

- `path/to/file.ext`: 설명
- `path/to/another-file.ext`: 설명

## Next Steps

1. **{다음 작업}**: 설명
2. **{다음 작업}**: 설명

## Key Findings

- {중요한 발견이나 교훈}
- {중요한 발견이나 교훈}
```

### 선택 섹션

```markdown
## Additional Updates

**Date:** {추가 업데이트 날짜}  
**Focus:** {추가 작업 초점}

### Changes Made

- 변경사항 설명

## Related Documents

- `docs/file.md`: 관련 이유
```

## 작성 원칙

### 1. 객관적이고 구체적으로

- 개인적인 의견보다는 사실 기반 기록
- 구체적인 파일명, 메소드명, 에러 메시지 포함
- "잘 됨" 대신 "테스트 15개 모두 통과"처럼 수치화

### 2. 시간 순서대로

- 작업 진행 순서대로 What We Did 섹션 구성
- 번호 매겨서 단계별로 설명

### 3. 미래 지향적

- Next Steps에서 다음 작업 명확히 제시
- Key Findings에서 교훈과 시사점 정리

### 4. 간결하게

- 불필요한 수사 제거
- 핵심 내용만 담되 충분한 맥락 제공

## 작성 시점

- 각 개발 세션 종료 시 작성
- 의미 있는 작업 단위 완료 시 (새 패키지 구현, 주요 기능 추가 등)
- 에러 해결이나 아키텍처 변경 시

## 참고사항

- 날짜는 실제 작업 날짜 사용
- Focus는 작업의 핵심 목적
- Summary는 전체 세션의 성과 요약
- What We Did는 구체적인 작업 목록
- Files Worked On은 변경된 파일 목록
- Next Steps는 즉시 다음에 할 작업
- Key Findings는 배운 점이나 중요한 발견

## 파일 넘버링 유지

AgentLog 파일의 연속적인 번호 매기기를 유지하기 위해, 새로운 로그 작성 시 다음 단계를 따르세요:

1. `docs/agentlogs/` 폴더를 리스팅하여 현재 파일들을 확인
2. 가장 높은 번호의 다음 숫자를 사용 (예: 003.md가 있으면 004.md)
3. 중복 번호가 발생한 경우 (예: 003이 두 개), 구현 순서에 따라 재배열:
   - 실제 구현된 순서대로 낮은 번호부터 배정
   - `mv` 명령어로 파일명 변경
4. 번호 변경 시 기존 파일들의 참조를 확인하여 업데이트

이렇게 하면 프로젝트 히스토리의 시간적 순서를 정확히 유지할 수 있습니다.

이 가이드를 따라 일관된 AgentLog를 작성하면 프로젝트의 발전 과정을 효과적으로 추적할 수 있습니다.
