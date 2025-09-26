# PTY Manager Kanban

## Todo

## InProgress

## Done

### 프로젝트 설정 및 의존성

- package.json에 필요한 의존성 추가 (bun-pty, @xterm/headless, consola, nanoid)
- tsconfig.json 최적화 (strict=true, target=ES2022, module=ESNext, noImplicitAny 등)
- lint 명령어 추가 (eslint)
- .eslintrc.json 및 .prettierrc 설정 추가

### 타입 정의

- PTY 세션 인터페이스 정의 (PtySession, PtyInstance, SessionStatus 등, sessionId 포함)
- 프로세스 상태 타입 정의 (initializing, active, idle, terminating, terminated)
- processId 타입 정의 (nanoid 기반 문자열)
- 스트림 및 터미널 관련 타입 정의 (TerminalOutput, CommandInput 등)

### PTY 생성 및 관리

- PTY 클래스 구현 (bun-pty를 활용한 spawn)
- xterm headless 통합하여 터미널 상태 유지 및 ANSI 시퀀스 처리
- 프로세스 격리 및 여러 인스턴스 관리 (nanoid 기반 ID 생성)
- PTY 인스턴스 생명주기 관리 (생성, 초기화, 종료)

### 프로세스 제어

- 명령 실행 및 스트림 처리 로직 구현
- stdin/stdout/stderr 파이프라인 구현 (비동기 스트림 처리)
- 프로세스 시작/종료/재시작 기능 (processId 기반)
- 프로세스 상태 모니터링 및 에러 핸들링

### PTY 관리 인터페이스

- sessionId를 생성자로 받는 PtyManager 클래스 구현
- processId 생성 및 관리 (nanoid 기반)
- PTY 인스턴스 조회, 생성, 삭제 메소드
- 세션별 PTY 목록 및 상태 제공 인터페이스

### 스트림 및 비동기 처리

- 스트림 비동기 처리 구현 (ReadableStream 활용)
- ANSI 시퀀스 캡처 및 strip 옵션 제공
- TUI 완벽 지원 (xterm headless serialize addon 활용)
- 실시간 출력 스트리밍

### Graceful Shutdown

- 세션 종료 감지 및 cleanup 프로시저 구현
- SIGTERM/SIGKILL 시퀀스 구현
- 3초 grace period 적용 및 현재 명령 완료 대기
- 메타데이터 정리 및 리소스 해제

### 테스트 및 품질

- 유닛 테스트 작성 (bun test 활용)
- 통합 테스트 (PTY 명령 실행 시나리오)
- 타입 체크 및 린팅 적용 (bun check, eslint)
- 코드 커버리지 측정 및 문서화

## Canceled
