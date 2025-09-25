# mcp-pty 개발 에이전트 룰셋

## 🎯 프로젝트 개발 원칙

### 1. 필수 준수 사항

#### 1.1 기술 스택 제약
- **Bun 우선주의**: 모든 JavaScript 런타임 기능은 Bun 네이티브 API를 최우선 사용
- **Node.js 호환성 금지**: `node:*` 모듈 임포트 시 반드시 Bun 대안 확인 후 사용
- **node-pty 사용 금지**: Bun.spawn()을 활용한 네이티브 PTY 구현 강제
- **공식 MCP SDK 고정**: `@modelcontextprotocol/sdk` 이외의 MCP 라이브러리 사용 금지

#### 1.2 모노레포 구조 엄격 준수
```
mcp-pty/
├── packages/
│   ├── mcp-server/     # MCP 서버 및 통신 레이어
│   ├── pty-manager/    # PTY 생성, 관리 및 프로세스 제어  
│   └── session-manager/ # 세션 추적, 생명주기 관리
├── package.json        # Bun workspace 설정
└── tsconfig.json       # 루트 TypeScript 설정
```

#### 1.3 절대 경로 임포트 강제
- 모든 패키지 간 참조는 `@app/*` 프리픽스 사용 강제
- 상대 경로 (`../`) 임포트 발견 시 즉시 수정
- TypeScript path mapping과 Bun workspace 연동 필수

### 2. 코딩 컨벤션 규칙

#### 2.1 파일 구조 표준
```
packages/[package-name]/
├── src/
│   ├── index.ts        # 진입점 (필수)
│   ├── types/          # 타입 정의
│   ├── utils/          # 유틸리티 함수
│   └── [feature]/      # 기능별 디렉토리
├── package.json
├── tsconfig.json
└── README.md
```

#### 2.2 TypeScript 설정 표준
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext", 
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true
  },
  "extends": "../../tsconfig.json"
}
```

#### 2.3 Package.json 스크립트 표준
모든 패키지는 동일한 스크립트 세트 유지:
```json
{
  "scripts": {
    "build": "bun build src/index.ts --outdir dist --target bun",
    "dev": "bun run --watch src/index.ts", 
    "check": "bunx tsc --noEmit -p tsconfig.json",
    "clean": "rm -rf dist"
  }
}
```

### 3. MCP 프로토콜 구현 규칙

#### 3.1 이중 인터페이스 의무 지원
- **Resources 우선**: 기본적으로 MCP Resources 스펙으로 기능 제공
- **Tools 백업**: `MCP_PTY_DEACTIVATE_RESOURCES=true` 시 자동 Tools 모드 전환
- **동적 감지**: 런타임에 클라이언트 capability 감지 후 적절한 인터페이스 선택

#### 3.2 URI 스키마 표준화
Resources URI는 다음 패턴 엄격 준수:
```
pty://sessions/list                    # 세션 목록
pty://session/{sessionId}/output       # 출력 히스토리
pty://session/{sessionId}/status       # 세션 상태
pty://session/{sessionId}/metadata     # 세션 메타데이터
```

#### 3.3 Tools 네이밍 컨벤션
```typescript
// 허용되는 툴 이름 패턴
const ALLOWED_TOOLS = [
  'list_pty',     // 세션 목록 조회
  'exec_pty',     // 명령 실행
  'query_pty',    // 세션 상태 조회  
  'quit_pty',     // 세션 종료
  'activate_pty_tools' // 동적 툴 활성화
];
```

### 4. 세션 관리 구현 규칙

#### 4.1 세션 ID 생성 규칙
- **UUID v4 고정**: `crypto.randomUUID()` 사용 강제
- **중복 검사**: 기존 세션 ID와 중복 시 재생성
- **형식 검증**: UUID 포맷 validation 필수

#### 4.2 생명주기 관리 의무사항
```typescript
// 세션 상태 전환 순서 엄격 준수
type SessionStatus = 
  | 'initializing'  // 생성 중
  | 'active'        // 활성 상태
  | 'idle'          // 비활성 (30분 타임아웃)
  | 'terminating'   // 종료 처리 중
  | 'terminated';   // 종료 완료
```

#### 4.3 Graceful Shutdown 프로시저
모든 세션 종료는 다음 단계 필수 수행:
1. 상태를 `terminating`으로 변경
2. 신규 명령 수신 차단 (3초 grace period)
3. 현재 실행 중인 명령 완료 대기
4. SIGTERM 전송 후 3초 대기
5. SIGKILL로 강제 종료
6. 메모리에서 세션 데이터 정리

### 5. PTY 구현 제약 사항

#### 5.1 Bun.spawn 사용 규칙
```typescript
// 올바른 PTY 프로세스 생성 패턴
const process = Bun.spawn({
  cmd: [shell],
  cwd: workingDirectory,
  env: {
    ...process.env,
    TERM: 'xterm-256color',      // 고정값
    COLUMNS: cols.toString(),    // 동적 설정
    LINES: rows.toString()       // 동적 설정
  },
  stdin: 'pipe',   // 필수: 양방향 통신
  stdout: 'pipe',  // 필수: 출력 캡처
  stderr: 'pipe'   // 필수: 에러 처리
});
```

#### 5.2 플랫폼별 Shell 감지
```typescript
function detectShell(): string {
  const platform = process.platform;
  if (platform === 'win32') return 'cmd.exe';
  if (platform === 'darwin') return process.env.SHELL || '/bin/zsh';
  return process.env.SHELL || '/bin/bash';
}
```

#### 5.3 스트림 처리 규칙
- **비동기 필수**: 모든 stdin/stdout 처리는 async/await 사용
- **에러 핸들링**: 스트림 에러 시 세션 상태 업데이트 필수
- **버퍼링**: 출력은 메모리 버퍼에 저장 (최대 1MB 제한)

### 6. 전송 계층 구현 제약

#### 6.1 stdio 전송
```typescript
// 부모 프로세스 종료 감지 필수
process.on('disconnect', () => {
  console.log('Parent disconnected, initiating cleanup');
  this.cleanup();
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, graceful shutdown');
  this.gracefulShutdown();
});
```

#### 6.2 HTTP 전송 (Hono 사용)
- **CORS 설정**: `mcp-session-id` 헤더 노출 필수
- **세션 매핑**: HTTP 세션과 PTY 세션 1:1 매핑 강제
- **에러 응답**: JSON-RPC 2.0 포맷 준수

### 7. 테스트 및 검증 규칙

#### 7.1 필수 테스트 시나리오
- [ ] stdio 전송으로 MCP 클라이언트 연결
- [ ] HTTP 전송으로 동시 다중 클라이언트 연결
- [ ] 세션 생성/삭제/조회 기능
- [ ] PTY 명령 실행 및 출력 캡처
- [ ] Graceful shutdown 동작
- [ ] 클라이언트 예기치 않은 종료 시 cleanup

#### 7.2 성능 벤치마크 기준
- 세션 생성: < 100ms
- 명령 실행 응답: < 50ms  
- 동시 세션 지원: 최소 10개
- 메모리 사용량: 세션당 < 10MB

### 8. 보안 및 안전성 규칙

#### 8.1 프로세스 격리
- 각 세션은 독립된 프로세스 공간 사용
- 세션 간 데이터 접근 차단
- 환경 변수 오염 방지

#### 8.2 리소스 제한
```typescript
const LIMITS = {
  MAX_SESSIONS_PER_CLIENT: 5,
  MAX_OUTPUT_BUFFER_SIZE: 1024 * 1024, // 1MB
  SESSION_TIMEOUT: 30 * 60 * 1000,     // 30분
  COMMAND_TIMEOUT: 60 * 1000           // 1분
};
```

#### 8.3 입력 검증
- 모든 클라이언트 입력 sanitization
- Shell injection 공격 방지
- 파일 경로 traversal 차단

## ⚠️ 금지 사항

### 절대 해서는 안 되는 것들
1. **Node.js 특화 모듈 사용**: `child_process`, `cluster` 등
2. **외부 PTY 라이브러리**: `node-pty`, `pty.js` 등
3. **전역 상태 의존**: 모든 상태는 클래스 인스턴스에 캡슐화
4. **동기 블로킹 코드**: `fs.readFileSync()`, `execSync()` 등
5. **하드코딩된 경로**: 모든 경로는 설정을 통해 주입
6. **에러 무시**: 모든 에러는 적절히 핸들링 및 로깅

### 코드 리뷰 자동 거부 기준
- `require('child_process')` 발견
- `../` 상대 경로 임포트 발견  
- `any` 타입 남용 (유틸리티 함수 제외)
- 에러 핸들링 누락
- 테스트 코드 없는 핵심 기능

## 🔧 개발 환경 설정 필수사항

### 에디터 설정
```json
// .vscode/settings.json
{
  "typescript.preferences.includePackageJsonAutoImports": "on",
  "typescript.suggest.autoImports": true,
  "editor.codeActionsOnSave": {
    "source.organizeImports": true
  }
}
```

### 린트 규칙
- ESLint + Prettier 필수
- `@typescript-eslint/no-explicit-any` 경고
- `import/no-relative-parent-imports` 에러

이 룰셋을 위반하는 코드는 즉시 수정되어야 하며, 지속적인 위반 시 개발 중단 후 아키텍처 재검토가 필요합니다.