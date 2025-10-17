# bun inspect CLI — 간결·정확 가이드

bun inspect CLI는 MCP 서버를 스크립트·자동화 환경에서 호출·테스트할 때 사용합니다. 아래는 공식 README 기반의 핵심 문법과 자주 쓰이는 메서드/인자 패턴입니다.

기본 실행

- 로컬 번들(프로세스 실행)
  bun inspect --cli node build/index.js

- 설정 파일에서 서버 선택
  bun inspect --cli --config path/to/config.json --server myserver

환경변수 / 서버 인자

- 환경변수 전달
  bun inspect --cli -e KEY=val -e KEY2=val2 node build/index.js

- 서버 인자 전달 (inspector 플래그와 구분)
  bun inspect --cli -- node build/index.js --server-flag

핵심 메서드 패턴

- 조회형 (간단)
  bun inspect --cli <target> --method tools/list
  bun inspect --cli <target> --method resources/list
  bun inspect --cli <target> --method prompts/list

  <target>는 로컬 서버 실행 시 "node build/index.js" 또는 원격 URL(예: https://host)입니다.

- 도구 실행 (tools/call)
  bun inspect --cli <target> --method tools/call --tool-name <name> [--tool-arg k=v ...]

도구 인자 규칙 (진실만)

- 단순 키=값
  --tool-arg key=val --tool-arg another=val2

- JSON / 중첩 객체 전달
  CLI가 자동으로 `@file.json` 같은 파일 인클루전을 지원한다는 문서는 없습니다. 즉, --tool-arg @file.json 형태로 파일을 자동 읽어 확장해 주지 않습니다.

  대안(권장): 셸에서 파일 내용을 읽어 한 줄(compact)로 만들어 --tool-arg에 넣으세요. 예시는 아래와 같습니다.

  POSIX (bash/zsh) + jq 설치 가정:
  bun inspect --cli node build/index.js --method tools/call --tool-name mytool --tool-arg "payload=$(jq -c . file.json)"

  jq가 없을 때(간단한 줄바꿈 제거):
  bun inspect --cli node build/index.js --method tools/call --tool-name mytool --tool-arg "payload=$(tr -d '\n' < file.json)"

  PowerShell (pwsh):
  $p = (Get-Content -Raw file.json).Trim(); bun inspect --cli node build/index.js --method tools/call --tool-name mytool --tool-arg "payload=$p"

- 제어문자 / 멀티라인
  --tool-arg 'data="line1\nline2"'  # 또는 셸에서 적절히 이스케이프

원격 접속 / 전송 방식

- 기본(원격 URL) — SSE 권장
  bun inspect --cli https://my-mcp-server.example.com --method tools/list

- Streamable HTTP
  bun inspect --cli https://my-mcp-server.example.com --transport http --method tools/list

- 헤더 추가
  bun inspect --cli https://... --header "Authorization: Bearer TOKEN" --method tools/list

인증 / 세션 토큰

- Inspector Proxy 시작 시 콘솔에 세션 토큰 출력.
- 토큰 전달 예: --header "Authorization: Bearer <token>" 또는 환경변수 MCP_PROXY_AUTH_TOKEN=<hex>
- DANGEROUSLY_OMIT_AUTH 사용은 권장하지 않음.

주요 기본 도구 (프로젝트 예)

- start: input { command: string } → { processId, screen }
- kill: input { processId } → { success }
- list: input none → { ptys: [ { id, status, createdAt, lastActivity } ] }
- read: input { processId } → { screen }
- write_input: input { processId, data, waitMs? } → { screen, cursor:{x,y}, exitCode }

출력·디버깅

- CLI는 JSON을 stdout에 출력합니다. jq로 파싱하거나 스크립트에서 재사용하세요.
- 타임아웃/진행 설정: MCP_SERVER_REQUEST_TIMEOUT 등 환경변수로 조정 가능.

토큰 효율 팁

- 단순 조회는 --method만 사용. 불필요한 직렬화 줄이기.
- 복잡한 페이로드는 파일에 저장 후 셸 명령으로 읽어 전달.
- 반복 명령은 작은 래퍼 스크립트로 캡슐화.

참조
- 공식 README(원문): https://raw.githubusercontent.com/modelcontextprotocol/inspector/refs/heads/main/README.md
