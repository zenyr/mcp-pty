# Package Interaction Diagrams

## System Architecture Overview

```mermaid
graph TB
    Client[MCP Client] --> Transport[Transport Layer]
    
    subgraph "mcp-pty Server"
        Transport --> Server[MCP Server]
        Server --> Resources[Resources]
        Server --> Tools[Tools]
        Server --> Config[Configuration]
    end
    
    Server --> SessionMgr[Session Manager]
    SessionMgr --> PtyMgr[PTY Manager]
    PtyMgr --> Process[PTY Process]
    
    Process --> Normalize[Normalize Commands]
    Normalize --> Security[Security Validation]
    
    SessionMgr --> Logger[Logger]
    PtyMgr --> Logger
    Server --> Logger
    
    style Client fill:#e1f5fe
    style Transport fill:#f3e5f5
    style Server fill:#e8f5e8
    style SessionMgr fill:#fff3e0
    style PtyMgr fill:#fce4ec
    style Normalize fill:#f1f8e9
```

## Request Flow Diagram

```mermaid
sequenceDiagram
    participant C as MCP Client
    participant T as Transport Layer
    participant S as MCP Server
    participant SM as Session Manager
    participant PM as PTY Manager
    participant NC as Normalize Commands
    participant P as PTY Process
    
    C->>T: start_pty(command, pwd)
    T->>S: Forward request
    S->>SM: Get/create session
    SM->>PM: Get PTY manager
    PM->>NC: Validate command
    NC->>NC: Parse & security check
    NC-->>PM: Validated command
    PM->>P: Spawn PTY process
    P-->>PM: Process ID & output
    PM-->>SM: PTY bound to session
    SM-->>S: Session updated
    S-->>T: Response with PTY ID
    T-->>C: PTY process ready
```

## Session Lifecycle Diagram

```mermaid
stateDiagram-v2
    [*] --> Created: createSession()
    Created --> Initializing: PTY Manager bound
    Initializing --> Active: First PTY created
    Active --> Idle: No activity (5min)
    Idle --> Active: New PTY activity
    Active --> Terminating: disposeSession()
    Idle --> Terminating: Idle timeout
    Terminating --> [*]: Session cleaned up
    
    note right of Active
        Session handles
        multiple PTY processes
        with persistent state
    end note
```

## PTY Process Lifecycle Diagram

```mermaid
stateDiagram-v2
    [*] --> Created: PtyManager.createPty()
    Created --> Starting: Command validated
    Starting --> Running: Process spawned
    Running --> Finished: Process exits
    Finished --> Disposed: Cleanup completed
    Disposed --> [*]: Resources freed
    
    Running --> Disposed: kill_pty() called
    Starting --> Disposed: Spawn failure
    
    note right of Running
        - Real-time output capture
        - Exit code tracking
        - Signal handling
    end note
```

## Package Dependencies Diagram

```mermaid
graph LR
    subgraph "Core Packages"
        MCP[mcp-pty]
        SM[session-manager]
        PM[pty-manager]
        NC[normalize-commands]
        LOG[logger]
    end
    
    subgraph "Support Packages"
        EXP[experiments]
    end
    
    MCP --> SM
    MCP --> PM
    MCP --> NC
    MCP --> LOG
    
    SM --> PM
    SM --> LOG
    
    PM --> NC
    PM --> LOG
    
    EXP --> PM
    EXP --> SM
    
    style MCP fill:#ffeb3b
    style SM fill:#4caf50
    style PM fill:#2196f3
    style NC fill:#ff9800
    style LOG fill:#9c27b0
```

## Transport Layer Architecture

```mermaid
graph TB
    subgraph "stdio Transport"
        STDIO[stdio] --> MCP1[MCP Server]
        MCP1 --> Client1[Single Client]
    end
    
    subgraph "HTTP Transport"
        HTTP[HTTP Server] --> Hono[Hono Framework]
        Hono --> MCP2[MCP Server]
        MCP2 --> SSE[Server-Sent Events]
        SSE --> Client2[Multiple Clients]
    end
    
    subgraph "Configuration"
        Config[Config Layer] --> STDIO
        Config --> HTTP
    end
    
    style STDIO fill:#e3f2fd
    style HTTP fill:#f3e5f5
    style Config fill:#e8f5e8
```

## Security Validation Flow

```mermaid
flowchart TD
    Start[Command Input] --> Parse[bash-parser AST]
    Parse --> Validate{Security Check}
    
    Validate -->|Dangerous| Block[Block Command]
    Validate -->|Safe| Normalize[Normalize Command]
    
    Normalize --> ShellCheck{Requires Shell?}
    ShellCheck -->|Yes| Shell[sh -c command]
    ShellCheck -->|No| Direct[Direct execution]
    
    Block --> Error[Security Error]
    Direct --> Execute[Execute PTY]
    Shell --> Execute
    
    Execute --> Success[Command Running]
    Error --> End[Request Failed]
    Success --> End
    
    style Block fill:#ffebee
    style Error fill:#ffebee
    style Success fill:#e8f5e8
```

## Resource Management Diagram

```mermaid
graph TB
    subgraph "Session Resources"
        Session[Session] --> PTYs[PTY Processes]
        PTYs --> Buffers[Output Buffers]
        PTYs --> Processes[OS Processes]
    end
    
    subgraph "Cleanup Triggers"
        Idle[Idle Timeout]
        Manual[Manual Dispose]
        Error[Error Conditions]
    end
    
    subgraph "Cleanup Actions"
        SIGTERM[SIGTERM Signal]
        SIGKILL[SIGKILL Signal]
        Memory[Memory Cleanup]
    end
    
    Idle --> SIGTERM
    Manual --> SIGTERM
    Error --> SIGKILL
    
    SIGTERM --> Memory
    SIGKILL --> Memory
    
    Memory --> Session
    
    style Idle fill:#fff3e0
    style Manual fill:#e3f2fd
    style Error fill:#ffebee
```

## Configuration System Diagram

```mermaid
flowchart TD
    Start[Configuration Request] --> CLI{CLI Args?}
    CLI -->|Yes| CLIValue[Use CLI Value]
    CLI -->|No| XDG{XDG Config?}
    
    XDG -->|Yes| XDGValue[Use XDG Config]
    XDG -->|No| ENV{Environment?}
    
    ENV -->|Yes| ENVValue[Use Environment]
    ENV -->|No| Default[Use Default]
    
    CLIValue --> Merge[Merge Configuration]
    XDGValue --> Merge
    ENVValue --> Merge
    Default --> Merge
    
    Merge --> Result[Final Config]
    
    style CLIValue fill:#e8f5e8
    style XDGValue fill:#e3f2fd
    style ENVValue fill:#fff3e0
    style Default fill:#f5f5f5
```

## Error Handling Flow

```mermaid
flowchart TD
    Operation[Operation] --> Success{Success?}
    Success -->|Yes| Result[Return Result]
    Success -->|No| Error{Error Type?}
    
    Error -->|Validation| ValidationError[Security Error]
    Error -->|Process| ProcessError[PTY Error]
    Error -->|Session| SessionError[Session Error]
    Error -->|Transport| TransportError[Communication Error]
    
    ValidationError --> Log[Log Error]
    ProcessError --> Log
    SessionError --> Log
    TransportError --> Log
    
    Log --> Response[MCP Error Response]
    Response --> Client[Return to Client]
    
    style ValidationError fill:#ffebee
    style ProcessError fill:#fff3e0
    style SessionError fill:#e3f2fd
    style TransportError fill:#f3e5f5
```

## Testing Architecture Diagram

```mermaid
graph TB
    subgraph "Test Categories"
        Unit[Unit Tests]
        Integration[Integration Tests]
        Security[Security Tests]
        E2E[End-to-End Tests]
    end
    
    subgraph "Test Utilities"
        Mocks[Mock Factories]
        Helpers[Test Helpers]
        Fixtures[Test Fixtures]
    end
    
    subgraph "Coverage Areas"
        PtyTests[PTY Management]
        SessionTests[Session Management]
        CommandTests[Command Processing]
        TransportTests[Transport Layer]
    end
    
    Unit --> Mocks
    Integration --> Helpers
    Security --> Fixtures
    E2E --> Helpers
    
    Unit --> PtyTests
    Unit --> SessionTests
    Security --> CommandTests
    Integration --> TransportTests
    
    style Unit fill:#e8f5e8
    style Integration fill:#e3f2fd
    style Security fill:#fff3e0
    style E2E fill:#f3e5f5
```