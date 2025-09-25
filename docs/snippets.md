# mcp-pty 코드 스니펫 및 슈도코드

## 1. 프로젝트 구조 및 설정

### 1.1 루트 package.json (Bun Workspace)
```json
{
  "name": "mcp-pty-monorepo",
  "private": true,
  "workspaces": [
    "packages/mcp-server",
    "packages/pty-manager", 
    "packages/session-manager"
  ],
  "scripts": {
    "dev": "bun --filter '*' dev",
    "build": "bun --filter '*' build",
    "check": "bun --filter '*' check",
    "clean": "bun --filter '*' clean"
  }
}
```

### 1.2 루트 tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "baseUrl": ".",
    "paths": {
      "@app/mcp-server": ["./packages/mcp-server/src"],
      "@app/mcp-server/*": ["./packages/mcp-server/src/*"],
      "@app/pty-manager": ["./packages/pty-manager/src"],
      "@app/pty-manager/*": ["./packages/pty-manager/src/*"],
      "@app/session-manager": ["./packages/session-manager/src"],
      "@app/session-manager/*": ["./packages/session-manager/src/*"]
    }
  },
  "references": [
    { "path": "./packages/mcp-server" },
    { "path": "./packages/pty-manager" },
    { "path": "./packages/session-manager" }
  ]
}
```

## 2. Session Manager 패키지

### 2.1 세션 인터페이스 정의
```typescript
interface PTYSession {
  id: string;
  clientId: string;
  createdAt: Date;
  lastActivity: Date;
  status: 'active' | 'idle' | 'terminating' | 'terminated';
  ptyProcess?: Subprocess;
  outputBuffer: string[];
  metadata: SessionMetadata;
}

interface SessionMetadata {
  transport: 'stdio' | 'http';
  environment: Record<string, string>;
  workingDirectory: string;
  shell: string;
  cols: number;
  rows: number;
}
```

### 2.2 세션 매니저 구현
```typescript
export class SessionManager {
  private sessions = new Map<string, PTYSession>();
  private cleanupTimers = new Map<string, Timer>();

  async createSession(clientId: string, metadata: SessionMetadata): Promise<string> {
    const sessionId = crypto.randomUUID();
    const session: PTYSession = {
      id: sessionId,
      clientId,
      createdAt: new Date(),
      lastActivity: new Date(),
      status: 'active',
      outputBuffer: [],
      metadata
    };
    
    this.sessions.set(sessionId, session);
    this.scheduleCleanup(sessionId, 30 * 60 * 1000); // 30분 타임아웃
    
    return sessionId;
  }

  async terminateSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.status = 'terminating';
    
    // Graceful shutdown 프로시저
    if (session.ptyProcess) {
      await this.gracefulShutdown(session.ptyProcess);
    }
    
    this.clearCleanupTimer(sessionId);
    this.sessions.delete(sessionId);
  }

  private async gracefulShutdown(process: Subprocess): Promise<void> {
    try {
      process.kill('SIGTERM');
      
      // 3초 대기 후 강제 종료
      const timeout = setTimeout(() => {
        process.kill('SIGKILL');
      }, 3000);
      
      await process.exited;
      clearTimeout(timeout);
    } catch (error) {
      console.warn('Process shutdown error:', error);
    }
  }
}
```

## 3. PTY Manager 패키지

### 3.1 PTY 프로세스 래퍼
```typescript
export class PTYProcess {
  private process: Subprocess | null = null;
  private outputSubscribers: Set<(data: string) => void> = new Set();

  async spawn(sessionId: string, metadata: SessionMetadata): Promise<void> {
    const shell = this.detectShell();
    
    this.process = Bun.spawn({
      cmd: [shell],
      cwd: metadata.workingDirectory,
      env: {
        ...process.env,
        ...metadata.environment,
        TERM: 'xterm-256color',
        COLUMNS: metadata.cols.toString(),
        LINES: metadata.rows.toString()
      },
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe'
    });

    this.setupOutputHandling();
  }

  async writeInput(data: string): Promise<void> {
    if (!this.process?.stdin) throw new Error('Process not initialized');
    
    const writer = this.process.stdin.getWriter();
    await writer.write(new TextEncoder().encode(data));
    writer.releaseLock();
  }

  private async setupOutputHandling(): Promise<void> {
    if (!this.process?.stdout) return;

    const reader = this.process.stdout.getReader();
    const decoder = new TextDecoder();
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const text = decoder.decode(value);
        this.notifySubscribers(text);
      }
    } finally {
      reader.releaseLock();
    }
  }

  private detectShell(): string {
    const platform = process.platform;
    if (platform === 'win32') return 'cmd.exe';
    return process.env.SHELL || '/bin/bash';
  }
}
```

## 4. MCP Server 패키지

### 4.1 MCP 서버 메인 클래스
```typescript
export class MCPPTYServer {
  private sessionManager = new SessionManager();
  private resourcesEnabled = !process.env.MCP_PTY_DEACTIVATE_RESOURCES;

  async initialize(): Promise<void> {
    const server = new McpServer({
      name: "mcp-pty",
      version: "1.0.0"
    });

    if (this.resourcesEnabled) {
      this.setupResources(server);
    } else {
      this.setupTools(server);
    }

    await this.startTransport(server);
  }

  private setupResources(server: McpServer): void {
    // Resources 등록
    server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
        {
          uri: "pty://sessions/list",
          name: "Active PTY Sessions",
          description: "List all active PTY sessions"
        }
      ]
    }));

    server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const uri = new URL(request.params.uri);
      
      if (uri.pathname === '/sessions/list') {
        return this.handleSessionsList();
      }
      
      const sessionMatch = uri.pathname.match(/^\/session\/([^\/]+)\/(.+)$/);
      if (sessionMatch) {
        const [, sessionId, action] = sessionMatch;
        return this.handleSessionResource(sessionId, action);
      }
      
      throw new Error('Unknown resource');
    });
  }

  private setupTools(server: McpServer): void {
    // 동적 툴 활성화
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name === 'activate_pty_tools') {
        return this.activatePTYTools(server);
      }
      
      return this.handleToolCall(request.params.name, request.params.arguments);
    });
  }
}
```

### 4.2 전송 계층 설정
```typescript
async startTransport(server: McpServer): Promise<void> {
  const transport = process.env.MCP_TRANSPORT || 'stdio';
  
  if (transport === 'stdio') {
    await this.startStdioTransport(server);
  } else {
    await this.startHttpTransport(server);
  }
}

private async startStdioTransport(server: McpServer): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  // 부모 프로세스 종료 감지
  process.on('disconnect', () => {
    this.cleanup();
  });
}

private async startHttpTransport(server: McpServer): Promise<void> {
  const app = new Hono();
  const sessions = new Map<string, StreamableHTTPServerTransport>();

  app.post('/mcp', async (c) => {
    const sessionId = c.req.header('mcp-session-id');
    const body = await c.req.json();
    
    let transport: StreamableHTTPServerTransport;
    
    if (sessionId && sessions.has(sessionId)) {
      transport = sessions.get(sessionId)!;
    } else if (isInitializeRequest(body)) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => crypto.randomUUID(),
        onsessioninitialized: (id) => sessions.set(id, transport)
      });
      
      transport.onclose = () => {
        if (transport.sessionId) {
          sessions.delete(transport.sessionId);
          this.handleSessionDisconnect(transport.sessionId);
        }
      };
      
      await server.connect(transport);
    } else {
      return c.json({ error: 'Invalid session' }, 400);
    }
    
    return transport.handleRequest(c.req.raw, c.res);
  });

  Bun.serve({
    port: process.env.PORT || 3000,
    fetch: app.fetch
  });
}
```

## 5. 통합 및 실행

### 5.1 메인 진입점
```typescript
// packages/mcp-server/src/index.ts
import { MCPPTYServer } from '@app/mcp-server/server';

async function main() {
  const server = new MCPPTYServer();
  
  // Graceful shutdown 핸들러
  const cleanup = () => {
    console.log('Shutting down gracefully...');
    server.cleanup().then(() => {
      process.exit(0);
    });
  };
  
  process.on('SIGTERM', cleanup);
  process.on('SIGINT', cleanup);
  
  await server.initialize();
  console.log('mcp-pty server started');
}

main().catch(console.error);
```

### 5.2 빌드 및 실행 스크립트
```json
{
  "scripts": {
    "build": "bun build src/index.ts --outdir dist --target bun",
    "dev": "bun run --watch src/index.ts",
    "check": "bunx tsc --noEmit -p tsconfig.json",
    "start": "bun run dist/index.js",
    "start:http": "MCP_TRANSPORT=http bun run dist/index.js"
  }
}
```

## 6. 클라이언트 연동 예시

### 6.1 Claude Desktop 설정
```json
{
  "mcpServers": {
    "pty": {
      "command": "bun",
      "args": ["path/to/mcp-pty/dist/index.js"],
      "env": {
        "MCP_PTY_DEACTIVATE_RESOURCES": "false"
      }
    }
  }
}
```

### 6.2 HTTP 클라이언트 예시
```bash
# 세션 초기화
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{},"id":1}'

# PTY 명령 실행  
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "mcp-session-id: YOUR_SESSION_ID" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"exec_pty","arguments":{"command":"ls -la"}},"id":2}'
```

이 코드 스니펫들은 mcp-pty 프로젝트의 핵심 구현 부분을 다루며, abstract.md에서 설명한 아키텍처를 실제 TypeScript 코드로 구현하는 방법을 보여줍니다.