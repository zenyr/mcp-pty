# Session Manager Kanban

## Todo

### 프로젝트 설정 및 의존성

- package.json에 필요한 의존성 추가 (ulid, consola, hono 등)
- tsconfig.json 최적화 (strict=true, target=ES2022, module=ESNext, noImplicitAny 등)
- lint 명령어 추가 (eslint)
- .eslintrc.json 및 .prettierrc 설정 추가

## InProgress

## Done

### 프로젝트 설정 및 의존성

- package.json에 필요한 의존성 추가 (ulid, consola, hono 등)
- tsconfig.json 최적화 (strict=true, target=ES2022, module=ESNext, noImplicitAny 등)
- lint 명령어 추가 (eslint)
- .eslintrc.json 및 .prettierrc 설정 추가

### 타입 정의

- 세션 인터페이스 정의 (Session, SessionStatus, SessionId 등)
- 세션 상태 타입 정의 (initializing, active, idle, terminating, terminated)
- sessionId 타입 정의 (ULID 기반 문자열)
- PTY 바인딩 관련 타입 정의 (PtyBinding, PtyInstanceReference 등)
- 전송 계층 타입 정의 (TransportType: stdio | streaming-http)

### 세션 관리

- ULID 기반 세션 ID 생성 로직 구현
- 세션 저장소 구현 (메모리 기반, Map<SessionId, Session>)
- 세션 생성, 조회, 삭제 메소드 구현
- 세션 메타데이터 관리 (생성 시간, 마지막 활동 시간 등)

### PTY 바인딩 관리

- 세션과 PTY 인스턴스의 1:N 매핑 구현
- PTY 인스턴스 추가/제거 메소드
- 세션별 PTY 목록 조회 인터페이스
- PTY 생명주기와 세션 생명주기 동기화

### 생명주기 관리

- 세션 상태 전이 로직 구현 (initializing → active → idle → terminating → terminated)
- 상태 변경 이벤트 핸들링
- idle 타임아웃 모니터링 (5분 후 종료)
- 세션 활성 상태 모니터링 및 업데이트

### 세션 관리 인터페이스

- SessionManager 클래스 구현 (전송 타입에 따른 초기화)
- 세션 CRUD 인터페이스 제공
- PTY 바인딩 관리 인터페이스
- 세션 상태 및 통계 제공 메소드

### 통합 및 이벤트 처리

- MCP 서버와의 통합을 위한 이벤트 시스템 구현
- 세션 변경 이벤트 브로드캐스트 (SSE 지원)
- 에러 핸들링 및 로깅 (consola 활용)

### Graceful Shutdown

- 세션 종료 감지 메커니즘 구현 (stdio: 부모 프로세스 종료, streaming-HTTP: 클라이언트 연결 해제)
- Cleanup 프로시저 구현 (3초 grace period, SIGTERM → SIGKILL)
- 현재 실행 중인 명령 완료 대기
- 세션 메타데이터 및 PTY 인스턴스 정리

### 테스트 및 품질

- 유닛 테스트 작성 (bun test 활용, 세션 생성/삭제 시나리오)
- 통합 테스트 (전송 계층별 세션 관리 시나리오)
- 타입 체크 및 린팅 적용 (bun check, eslint)
- 코드 커버리지 측정 및 문서화

## Canceled
