# mcp-pty 프로젝트 설계 문서

## 프로젝트 개요

mcp-pty는 Bun + xterm.js + 공식 MCP SDK를 활용하여 background process를 MCP 클라이언트 종속으로 실행시키는 MCP 서버입니다. 일반적인 shell execute와 달리, 클라이언트 세션에 바인딩된 지속적인 pseudo-terminal 환경을 제공합니다.

## 핵심 아키텍처 설계

### 1. 모노레포 구조 (Bun Workspace)

프로젝트는 세 가지 핵심 패키지로 구성된 모노레포입니다:

- `@app/mcp-server`: MCP 서버 및 통신 레이어
- `@app/pty-manager`: PTY 생성, 관리 및 프로세스 제어
- `@app/session-manager`: 세션 추적, 생명주기 관리

### 2. 이중 전송 계층 지원

#### stdio 전송

- MCP 클라이언트가 서버를 자식 프로세스로 직접 실행
- 프로세스 종료시 자동 cleanup 보장
- 1:1 클라이언트-서버 바인딩

#### Streaming-HTTP 전송

- 원격 MCP 서버로 동작
- 다중 클라이언트 동시 세션 지원
- Hono 기반 HTTP 서버 구현
- SSE를 통한 실시간 notification 지원

### 3. 세션 관리 아키텍처

각 MCP 클라이언트에 대해 고유한 세션 컨텍스트를 유지합니다:

- **세션 식별**: ULID 기반 세션 ID 생성 (UUID 대신 ULID로 변경, 시간 정렬 가능)
- **생명주기 추적**: 클라이언트 연결/해제 상태 모니터링 (상태: initializing → active → idle → terminating → terminated)
- **자원 바인딩**: PTY 인스턴스와 세션의 1:N 매핑 (세션당 여러 인스턴스)

### 4. PTY 프로세스 관리

~~Bun의 네이티브 spawn 기능을 활용한 PTY 에뮬레이션:~~
bun-pty + @xterm/headless 활용

- **프로세스 격리**: 각 세션별 독립된 shell 프로세스 (nanoid 로 여러 인스턴스 관리)
- **터미널 상태**: xterm.js와 호환되는 터미널 설정 유지
- **스트림 파이프라인**: stdin/stdout/stderr 스트림 관리

### 5. 이중 인터페이스 설계

#### MCP Resources 기반

- `pty://status`: 본 MCP 서버 상태 제공 (n 개 세션에서 m 개의 process)
- `pty://sessions/list`: 현재 세션의 하위 PTY 프로세스 목록 조회
- `pty://session/{id}/output`: 현재 세션의 특정 PTY 프로세스 출력 히스토리
- `pty://session/{id}/status`: 현재 세션의 특정 PTY 프로세스 상태 정보

#### MCP Tools 백업

- 환경 변수 `MCP_PTY_DEACTIVATE_RESOURCES=true` 시 자동 활성화
- `activate_pty_tools`: Resources 미지원 클라이언트용 동적 툴 제공 // 좀 더 LLM 에이전트가 직관적으로 호출할 수 있도록?
- `start_pty`, `kill_pty` 툴 고정 제공, `list_pty`, `read_pty` 툴은 Resources 미지원 시 제공

### 6. Graceful Shutdown 메커니즘

#### 세션 종료 감지

- stdio: 부모 프로세스 종료 모니터링
- streaming-HTTP: 클라이언트 연결 해제 감지 (명시적 디스커넥트시 또는 Idle 상태로 5분 경과시)

#### Cleanup 프로시저

1. 신규 명령 차단 (3초 grace period)
2. 현재 실행 중인 명령 완료 대기
3. SIGTERM을 하위 프로세스에 전송
4. 3초 후 SIGKILL로 강제 종료
5. 세션 메타데이터 정리

### 7. 타입스크립트 모노레포 설정

#### 임포트 전략

- 상대 경로 임포트 허용 (relative imports allowed)
- Bun workspace를 통한 패키지 간 참조
- `bun check` 명령어로 타입 체크 자동화

#### 빌드 파이프라인

- 각 패키지별 독립적인 빌드 설정
- Bun 네이티브 런타임 최적화

## 기술적 의사결정

### PTY 구현 방식

bun-pty를 활용하여 PTY 생성과 관리, @xterm/headless를 서버 측에서 headless 모드로 사용하여 터미널 출력을 완벽하게 처리합니다. ANSI escape sequence를 포함한 TUI를 지원하며, serialize addon으로 화면 상태를 캡처하고, 기본적으로 ANSI를 strip하지 않고 반환하되 요청 시 strip 한 출력을 제공합니다.

### 세션 상태 관리

메모리 기반 세션 저장소를 사용하여 복잡성을 줄이고 성능을 최적화합니다. 영속성이 필요한 경우 향후 플러그인 아키텍처로 확장 가능합니다.

### 보안 고려사항

- 프로세스 격리를 통한 세션간 간섭 방지
- 클라이언트별 리소스 사용량 모니터링

이 설계는 MCP 프로토콜의 유연성을 최대한 활용하면서도 Bun의 네이티브 성능과 TypeScript의 타입 안정성을 확보하는 균형잡힌 접근 방식입니다.
