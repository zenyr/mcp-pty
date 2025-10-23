# MCP SDK Server Patterns Reference

Analysis of `@modelcontextprotocol/typescript-sdk` v2+ server implementation patterns. All code excerpts are from the official SDK examples.

## Server Creation & Initialization

### McpServer Instance

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const server = new McpServer(
  {
    name: 'my-server',
    version: '1.0.0',
    icons: [{ src: './icon.svg', sizes: ['512x512'], mimeType: 'image/svg+xml' }],
    websiteUrl: 'https://example.com'
  },
  { capabilities: { logging: {} } }
);
```

**Arguments:**
- **arg1**: `Implementation` - Server metadata (name, version, icons, website)
- **arg2**: `ServerOptions` (optional) - Capabilities (logging, completions, resources, tools, prompts)

## Tool Registration API

### Pattern 1: Simple Tool with Config Object

```typescript
server.registerTool(
  'tool-name',
  {
    title: 'Display Name',
    description: 'What this tool does',
    inputSchema: {
      name: z.string().describe('Parameter description')
    }
  },
  async ({ name }): Promise<CallToolResult> => {
    return {
      content: [{
        type: 'text',
        text: `Result for ${name}`
      }]
    };
  }
);
```

**Signature:**
```typescript
registerTool<InputArgs extends ZodRawShape>(
  name: string,
  config: {
    title?: string;
    description?: string;
    inputSchema?: InputArgs;
    outputSchema?: OutputArgs;
    annotations?: ToolAnnotations;
    _meta?: Record<string, unknown>;
  },
  callback: ToolCallback<InputArgs>
): RegisteredTool
```

### Pattern 2: Tool with Fluent Shorthand

```typescript
server.tool(
  'multi-greet',
  'A tool that sends different greetings',
  { name: z.string().describe('Name to greet') },
  async ({ name }, extra): Promise<CallToolResult> => {
    await server.sendLoggingMessage(
      { level: 'info', data: `Greeting ${name}` },
      extra.sessionId
    );
    return {
      content: [{ type: 'text', text: `Hello, ${name}!` }]
    };
  }
);
```

**Overloads:**
```typescript
// No args
tool(name: string, callback: ToolCallback): RegisteredTool

// Description + callback
tool(name: string, description: string, callback: ToolCallback): RegisteredTool

// Schema or annotations (union disambiguated at runtime)
tool<Args extends ZodRawShape>(
  name: string,
  paramsSchemaOrAnnotations: Args | ToolAnnotations,
  callback: ToolCallback<Args>
): RegisteredTool

// Full form: description + schema + annotations
tool<Args extends ZodRawShape>(
  name: string,
  description: string,
  paramsSchema: Args,
  annotations: ToolAnnotations,
  callback: ToolCallback<Args>
): RegisteredTool
```

### Handler Signature

```typescript
type ToolCallback<Args extends ZodRawShape = undefined> =
  Args extends ZodRawShape
    ? (
        args: z.objectOutputType<Args, ZodTypeAny>,
        extra: RequestHandlerExtra<ServerRequest, ServerNotification>
      ) => CallToolResult | Promise<CallToolResult>
    : (
        extra: RequestHandlerExtra<ServerRequest, ServerNotification>
      ) => CallToolResult | Promise<CallToolResult>;
```

**Handler receives:**
- **args**: Parsed & validated Zod object (if inputSchema provided)
- **extra.sessionId**: Optional session identifier
- **extra.requestInfo**: Request headers (for OAuth, correlation IDs)
- **extra.authInfo**: Authentication context (if using OAuth)

### Tool Result Format

```typescript
interface CallToolResult {
  content: ContentBlock[];           // Required: text, image, audio, resource links
  structuredContent?: object;         // Present if outputSchema defined
  isError?: boolean;                  // Default false
}
```

### Tool Annotations

```typescript
interface ToolAnnotations {
  title?: string;                     // UI display name
  readOnlyHint?: boolean;             // Default: false
  destructiveHint?: boolean;          // Default: true (when not readOnly)
  idempotentHint?: boolean;           // Default: false (when not readOnly)
  openWorldHint?: boolean;            // Default: true
}
```

**Usage:**
```typescript
server.tool(
  'start-stream',
  'Sends periodic notifications',
  { interval: z.number(), count: z.number() },
  {
    title: 'Notification Stream',
    readOnlyHint: true,
    openWorldHint: false
  },
  async ({ interval, count }, extra) => {
    // Implementation
  }
);
```

## Resource Registration API

### Pattern 1: Static Resource at Fixed URI

```typescript
server.registerResource(
  'greeting-resource',
  'https://example.com/greetings/default',
  {
    title: 'Default Greeting',
    description: 'A simple greeting resource',
    mimeType: 'text/plain'
  },
  async (): Promise<ReadResourceResult> => {
    return {
      contents: [{
        uri: 'https://example.com/greetings/default',
        text: 'Hello, world!'
      }]
    };
  }
);
```

**Signature:**
```typescript
registerResource(
  name: string,
  uriOrTemplate: string,
  config: ResourceMetadata,
  readCallback: ReadResourceCallback
): RegisteredResource
```

### Pattern 2: Template-based Resource

```typescript
const template = new ResourceTemplate(
  'file:///{fileName}',
  {
    list: async (extra) => {
      return {
        resources: [
          { uri: 'file:///example/file1.txt', name: 'File 1', ... },
          { uri: 'file:///example/file2.txt', name: 'File 2', ... }
        ]
      };
    },
    complete: {
      'fileName': async (value, context) => {
        return ['file1.txt', 'file2.txt'].filter(f => f.startsWith(value));
      }
    }
  }
);

server.registerResource(
  'dynamic-files',
  template,
  { title: 'Dynamic Files', description: '...' },
  async (uri, variables, extra) => {
    return {
      contents: [{
        uri: uri.toString(),
        text: `Content of ${variables.fileName}`
      }]
    };
  }
);
```

### Handler Signature

```typescript
type ReadResourceCallback = (
  uri: URL,
  extra: RequestHandlerExtra<ServerRequest, ServerNotification>
) => ReadResourceResult | Promise<ReadResourceResult>

type ReadResourceTemplateCallback = (
  uri: URL,
  variables: Variables,           // Parsed URI template variables
  extra: RequestHandlerExtra<ServerRequest, ServerNotification>
) => ReadResourceResult | Promise<ReadResourceResult>
```

### Resource Result Format

```typescript
interface ReadResourceResult {
  contents: (TextResourceContents | BlobResourceContents)[];
}

interface TextResourceContents {
  uri: string;
  text: string;
  mimeType?: string;
  _meta?: object;
}

interface BlobResourceContents {
  uri: string;
  blob: string;  // Base64-encoded
  mimeType?: string;
  _meta?: object;
}
```

## Prompt Registration API

### Pattern 1: Simple Prompt with Config

```typescript
server.registerPrompt(
  'greeting-template',
  {
    title: 'Greeting Template',
    description: 'A simple greeting prompt template',
    argsSchema: {
      name: z.string().describe('Name to include in greeting')
    }
  },
  async ({ name }): Promise<GetPromptResult> => {
    return {
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `Please greet ${name} in a friendly manner.`
        }
      }]
    };
  }
);
```

**Signature:**
```typescript
registerPrompt<Args extends PromptArgsRawShape>(
  name: string,
  config: {
    title?: string;
    description?: string;
    argsSchema?: Args;
  },
  callback: PromptCallback<Args>
): RegisteredPrompt
```

### Pattern 2: Fluent Shorthand

```typescript
server.prompt(
  'greeting-template',
  'A simple greeting prompt',
  { name: z.string().describe('Name to greet') },
  async ({ name }, extra) => {
    return {
      messages: [{
        role: 'user',
        content: { type: 'text', text: `Greet ${name}` }
      }]
    };
  }
);
```

### Handler Signature

```typescript
type PromptCallback<Args extends PromptArgsRawShape = undefined> =
  Args extends PromptArgsRawShape
    ? (
        args: z.objectOutputType<Args, ZodTypeAny>,
        extra: RequestHandlerExtra<ServerRequest, ServerNotification>
      ) => GetPromptResult | Promise<GetPromptResult>
    : (
        extra: RequestHandlerExtra<ServerRequest, ServerNotification>
      ) => GetPromptResult | Promise<GetPromptResult>
```

### Prompt Result Format

```typescript
interface GetPromptResult {
  messages: PromptMessage[];
  description?: string;
}

interface PromptMessage {
  role: 'user' | 'assistant';
  content: ContentBlock;
}
```

## Advanced Patterns

### Elicitation (User Input Collection)

```typescript
async ({ infoType }) => {
  const result = await server.server.elicitInput({
    message: 'Please provide contact info',
    requestedSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', title: 'Name' },
        email: { type: 'string', title: 'Email', format: 'email' }
      },
      required: ['name', 'email']
    }
  });

  if (result.action === 'accept') {
    return {
      content: [{
        type: 'text',
        text: `Received: ${JSON.stringify(result.content)}`
      }]
    };
  }
  // Handle 'decline' or 'cancel' actions
}
```

### Logging During Tool Execution

```typescript
async (args, extra) => {
  await server.sendLoggingMessage(
    {
      level: 'debug',
      data: `Starting process for ${args.name}`
    },
    extra.sessionId
  );

  await sleep(1000);

  await server.sendLoggingMessage(
    {
      level: 'info',
      data: `Completed processing`
    },
    extra.sessionId
  );

  return { content: [{ type: 'text', text: 'Done' }] };
}
```

### Resource Links in Tool Results

```typescript
server.registerTool(
  'list-files',
  {
    title: 'List Files',
    description: 'Returns resource links without embedding content',
    inputSchema: {
      includeDescriptions: z.boolean().optional()
    }
  },
  async ({ includeDescriptions = true }) => {
    const links = [
      {
        type: 'resource_link',
        uri: 'https://example.com/file1.txt',
        name: 'File 1',
        mimeType: 'text/plain',
        ...(includeDescriptions && { description: 'First file' })
      },
      // More links...
    ];

    return {
      content: [
        { type: 'text', text: 'Available files:' },
        ...links,
        { type: 'text', text: 'Load any file as a resource' }
      ]
    };
  }
);
```

### Error Handling

```typescript
// SDK automatically catches errors and wraps in CallToolResult
async (args, extra) => {
  try {
    if (!args.name) throw new Error('Name is required');
    // Process...
  } catch (error) {
    // Returning error response (SDK will auto-wrap):
    return {
      content: [{
        type: 'text',
        text: error instanceof Error ? error.message : String(error)
      }],
      isError: true
    };
  }
}
```

## Type System & Validation

### Schema Definition with Zod

```typescript
import { z } from 'zod';

// Tool parameters
const toolSchema = {
  query: z.string().describe('Search query'),
  limit: z.number().int().min(1).max(100).default(10),
  tags: z.array(z.string()).optional()
};

// Prompt arguments
const promptSchema = {
  style: z.enum(['formal', 'casual', 'technical']).describe('Writing style'),
  length: z.number().min(100).max(2000).default(500)
};

server.registerTool('search', { inputSchema: toolSchema }, async (args) => {
  // args is strongly typed:
  // args.query: string
  // args.limit: number
  // args.tags?: string[]
});
```

### Type Inference

```typescript
// Zod infers types automatically:
type ToolInput = z.infer<typeof z.object(toolSchema)>;
// Equivalent to:
// { query: string; limit: number; tags?: string[] }

// Handler receives strongly-typed args:
async (args: ToolInput) => {
  // Full IDE autocompletion & type safety
}
```

### Conditional Handler Signature

```typescript
// No schema → handler receives only `extra`
server.registerTool('ping', {}, async (extra) => {
  // extra.sessionId, extra.requestInfo, extra.authInfo available
});

// With schema → handler receives `args` + `extra`
server.registerTool(
  'search',
  { inputSchema: { q: z.string() } },
  async (args, extra) => {
    // args.q available
    // extra available
  }
);
```

## Transport & Connection

### Express HTTP Server Integration

```typescript
import express from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

const app = express();
const transports = new Map<string, StreamableHTTPServerTransport>();

app.post('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'];

  if (!sessionId || !transports.has(sessionId)) {
    if (isInitializeRequest(req.body)) {
      // New session
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        eventStore: new InMemoryEventStore() // For resumability
      });

      transport.onclose = () => {
        transports.delete(transport.sessionId);
      };

      const server = createServer();
      await server.connect(transport);
      transports.set(transport.sessionId, transport);

      await transport.handleRequest(req, res, req.body);
    }
  } else {
    // Existing session
    const transport = transports.get(sessionId)!;
    await transport.handleRequest(req, res, req.body);
  }
});

app.listen(3000);
```

### SSE Streaming (GET for clients)

```typescript
app.get('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'];
  const lastEventId = req.headers['last-event-id'];

  if (!sessionId || !transports.has(sessionId)) {
    res.status(400).send('Invalid session');
    return;
  }

  const transport = transports.get(sessionId)!;
  // Resumability: client provides Last-Event-ID to resume from last event
  await transport.handleRequest(req, res);
});
```

## Capability Registration

### Server Capabilities

```typescript
const server = new McpServer(
  { name: 'my-server', version: '1.0.0' },
  {
    capabilities: {
      logging: {},           // Server can send log messages
      completions: {},       // Server supports autocomplete
      resources: {
        listChanged: true    // Server sends resource list updates
      },
      tools: {
        listChanged: true    // Server sends tool list updates
      },
      prompts: {
        listChanged: true    // Server sends prompt list updates
      }
    }
  }
);
```

### Dynamic List Updates

```typescript
// After registering new tool
server.sendToolListChanged();

// After registering new resource
server.sendResourceListChanged();

// After registering new prompt
server.sendPromptListChanged();
```

## Request Handler Extra Context

```typescript
interface RequestHandlerExtra<R, N> {
  sessionId?: string;                 // Session identifier (for logging)
  requestInfo?: {
    headers: Record<string, string>;  // HTTP headers
  };
  authInfo?: {
    token: string;                    // OAuth access token
    clientId: string;                 // Client identifier
    scopes: string[];                 // Granted scopes
    expiresAt?: number;               // Token expiry
  };
}
```

## Registered Resource Object API

```typescript
interface RegisteredResource {
  name: string;
  title?: string;
  metadata?: ResourceMetadata;
  readCallback: ReadResourceCallback;
  enabled: boolean;
  enable(): void;
  disable(): void;
  remove(): void;
  update(updates: {
    name?: string;
    title?: string;
    uri?: string | null;
    metadata?: ResourceMetadata;
    callback?: ReadResourceCallback;
    enabled?: boolean;
  }): void;
}
```

## Registered Tool Object API

```typescript
interface RegisteredTool {
  title?: string;
  description?: string;
  inputSchema?: AnyZodObject;
  outputSchema?: AnyZodObject;
  annotations?: ToolAnnotations;
  _meta?: Record<string, unknown>;
  callback: ToolCallback<ZodRawShape | undefined>;
  enabled: boolean;
  enable(): void;
  disable(): void;
  remove(): void;
  update(updates: {
    name?: string | null;
    title?: string;
    description?: string;
    paramsSchema?: ZodRawShape;
    outputSchema?: ZodRawShape;
    annotations?: ToolAnnotations;
    _meta?: Record<string, unknown>;
    callback?: ToolCallback<ZodRawShape>;
    enabled?: boolean;
  }): void;
}
```

## Best Practices

### 1. Input Validation

```typescript
// SDK validates via Zod before handler invoked
server.registerTool('process', {
  inputSchema: {
    email: z.string().email('Invalid email'),
    age: z.number().int().min(0).max(150),
    tags: z.array(z.string()).max(10)
  }
}, async (args) => {
  // args guaranteed valid per schema
});
```

### 2. Session Tracking

```typescript
async (args, extra) => {
  const id = extra.sessionId || 'anonymous';
  console.log(`Tool called in session: ${id}`);
  // Use for correlation logging, rate limiting, etc.
}
```

### 3. Async Patterns

```typescript
// All handlers can be async
async (args, extra) => {
  const data = await fetchData(args.id);
  const processed = await processData(data);
  return { content: [{ type: 'text', text: processed }] };
}
```

### 4. Resource Content Types

```typescript
// Text resources
{ uri: 'file:///path/to/file.txt', text: 'content', mimeType: 'text/plain' }

// Binary resources (base64-encoded)
{
  uri: 'file:///path/to/image.png',
  blob: btoa(binaryData),
  mimeType: 'image/png'
}
```

### 5. Error Wrapping

```typescript
// ❌ Don't throw from handlers
async (args) => {
  throw new Error('Something failed');  // Will be caught & wrapped
}

// ✅ Return error in result
async (args) => {
  try {
    // Process
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true
    };
  }
}
```

## Testing Considerations

### Unit Testing Handlers

```typescript
import { test, expect } from 'bun:test';

test('tool returns correct greeting', async () => {
  const server = new McpServer(...);
  
  // Get registered tool handler
  const tool = server._registeredTools['greet'];
  
  // Call handler directly
  const result = await tool.callback(
    { name: 'Alice' },
    { sessionId: 'test-session' }
  );
  
  expect(result.content[0].type).toBe('text');
  expect(result.content[0].text).toContain('Alice');
});
```

### Integration Testing

```typescript
test('server responds to tool/call', async () => {
  // Start HTTP server with transport
  const response = await fetch('http://localhost:3000/mcp', {
    method: 'POST',
    headers: { 'mcp-session-id': 'test-session-1' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'greet', arguments: { name: 'Alice' } }
    })
  });

  const result = await response.json();
  expect(result.result.content[0].text).toContain('Hello, Alice');
});
```

## Key Patterns Summary

| Pattern | API | Use Case |
|---------|-----|----------|
| Fixed URI resource | `registerResource(name, uri, metadata, callback)` | Static files, APIs, constants |
| Template resource | `registerResource(name, template, metadata, callback)` | Dynamic collections, pattern-based URIs |
| Simple tool | `registerTool(name, config, callback)` | Most tools with full control |
| Fluent tool | `tool(name, description, schema, callback)` | Quick registration |
| Config prompt | `registerPrompt(name, config, callback)` | Template-based prompts |
| Session tracking | `extra.sessionId` | Logging, rate limiting, resumability |
| Async logging | `sendLoggingMessage(params, sessionId)` | Real-time feedback during execution |
| Resource links | Content block with `type: 'resource_link'` | Lazy-load resources without embedding |
| Error handling | Return `{ content: [...], isError: true }` | User-facing error messages |

## References

- MCP Protocol: https://modelcontextprotocol.io/
- TypeScript SDK: https://github.com/modelcontextprotocol/typescript-sdk
- Example: `src/examples/server/simpleStreamableHttp.ts`
