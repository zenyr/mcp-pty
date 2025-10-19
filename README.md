# mcp-pty

mcp-pty는 Bun + xterm.js + 공식 MCP SDK를 활용하여 background process를 MCP 클라이언트 종속으로 실행시키는 MCP 서버입니다. 일반적인 shell execute와 달리, 클라이언트 세션에 바인딩된 지속적인 pseudo-terminal 환경을 제공합니다.

## 설치

### 글로벌 설치 (권장)

```bash
bun install -g mcp-pty
```

### 로컬 개발

```bash
git clone <repository>
cd mcp-pty
bun install
bun link  # 글로벌 명령어 등록
```

## 실행

### CLI 명령어 (권장)

```bash
# 기본 실행 (stdio 모드)
mcp-pty

# HTTP 모드
mcp-pty --transport http --port 3000

# 도움말
mcp-pty --help
```

### 직접 실행 (개발용)

```bash
# stdio 모드
bun run packages/mcp-server/src/index.ts

# HTTP 모드
bun run packages/mcp-server/src/index.ts --transport http
```

## 설정 가이드

### 설정 우선순위

1. **CLI 인자** (최우선): `--transport`, `--port`
2. **XDG Config 파일**: `~/.config/mcp-pty/config.json`
3. **환경 변수**: `MCP_PTY_DEACTIVATE_RESOURCES`
4. **기본값**: stdio transport, port 3000

### XDG 설정 파일

`~/.config/mcp-pty/config.json` (또는 `$XDG_CONFIG_HOME/mcp-pty/config.json`):

```json
{
  "transport": "stdio",
  "port": 6420,
  "deactivateResources": false
}
```

### 전송 계층

- **stdio**: MCP 클라이언트가 서버를 자식 프로세스로 직접 실행. 프로세스 종료시 자동 cleanup 보장. 1:1 클라이언트-서버 바인딩.
- **http**: 원격 MCP 서버로 동작. 다중 클라이언트 동시 세션 지원. Hono 기반 HTTP 서버 구현. SSE를 통한 실시간 notification 지원.

### 환경 변수

- `MCP_PTY_DEACTIVATE_RESOURCES=true`: Resources 미지원 클라이언트용 동적 툴 제공 활성화.
- `XDG_CONFIG_HOME`: XDG 설정 디렉토리 경로 (기본: `~/.config`)

## API 문서

### MCP Resources

- `pty://status`: 본 MCP 서버 상태 제공 (n 개 세션에서 m 개의 process)
- `pty://list`: 현재 세션의 하위 PTY 프로세스 목록 조회
- `pty://{id}/output`: 현재 세션의 특정 PTY 프로세스 출력 히스토리
- `pty://{id}/status`: 현재 세션의 특정 PTY 프로세스 상태 정보

### MCP Tools

- `start`: 새 PTY 인스턴스 생성 (command와 pwd 필수, 초기 출력 포함 즉시 반환)
- `kill`: PTY 인스턴스 종료
- `list`: PTY 프로세스 목록 조회 (Resources 비활성화 시)
- `read`: PTY 출력 읽기 (Resources 비활성화 시)
- `activate_pty_tools`: 동적 툴 제공 (Resources 비활성화 시)

### 에러 코드

- 표준 MCP 에러 응답 사용.

## 개발

```bash
# 타입 체크
bun check

# 린팅
bun run lint

# 테스트
bun test
```

이 프로젝트는 Bun v1.2.22에서 `bun init`으로 생성되었습니다. [Bun](https://bun.com)은 빠른 all-in-one JavaScript 런타임입니다.
