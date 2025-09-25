# Node.js Key Input Handling Insights

이 문서는 `gemini-use-keypress.tsx` 파일 분석을 통해 얻은 Node.js 터미널 키 입력 처리에 대한 인사이트를 정리한 것입니다. Kitty 프로토콜, readline 모듈, 그리고 multiline 입력 구현에 초점을 맞추었습니다.

## 1. Kitty 프로토콜 시퀀스 파싱 (`parseKittyPrefix` 함수)

### 배경

Kitty 프로토콜은 터미널에서 키보드 입력(특히 특수 키)을 인코딩하는 확장 프로토콜입니다. `parseKittyPrefix` 함수는 버퍼의 시작 부분에서 하나의 완전한 Kitty 시퀀스를 파싱하여 Key 객체와 소비된 문자 길이를 반환합니다.

### 주요 기능

- **배치 입력 처리**: 여러 시퀀스가 한 번에 도착할 때 버퍼 오버플로우를 방지하고, 완전한 시퀀스만 "벗겨내기" (peel off) 합니다.
- **지원하는 시퀀스 유형**:
  - Legacy reverse tab: `ESC [ Z`
  - Parameterized reverse tab: `ESC [ 1 ; <mods> Z`
  - Parameterized functional: `ESC [ 1 ; <mods> (A|B|C|D|H|F|P|Q|R|S)` (화살표, Home/End, F1-F4)
  - CSI-u form: `ESC [ <code> ; <mods> (u|~)` (기능 키, Ctrl+문자 등)
  - Legacy functional: `ESC [ (A|B|C|D|H|F)` (기본 화살표 + Home/End)

### 설계 이유

- 코드 재사용성과 모듈성을 위해 별도 함수로 분리되었습니다.
- while 루프에서 버퍼를 반복적으로 파싱하여 불완전한 시퀀스를 건너뛰고 다음 유효한 시퀀스를 찾습니다.
- Kitty 프로토콜의 복잡한 변형을 하나의 함수로 통합하여 처리합니다.

### 예시 코드

```typescript
const parseKittyPrefix = (buffer: string): { key: Key; length: number } | null => {
  // Regex 매칭 및 Key 생성 로직 (상세 코드는 gemini-use-keypress.tsx 참조)
  // 예: Shift+Tab 매핑
  if (revTabLegacy.test(buffer)) {
    return {
      key: { name: 'tab', ctrl: false, meta: false, shift: true, paste: false, sequence: ..., kittyProtocol: true },
      length: m[0].length,
    };
  }
  // ... 다른 패턴들
};
```

## 2. CSI 시퀀스 심볼 매핑 (`symbolToName`)

### 배경

CSI (Control Sequence Introducer) 시퀀스에서 특정 문자는 기능 키를 나타냅니다. `symbolToName` 객체는 `ESC [ 1 ; <mods> (심볼)` 패턴의 심볼을 키 이름으로 매핑합니다.

### 매핑 테이블

- **화살표 및 네비게이션**: A (up), B (down), C (right), D (left), H (home), F (end)
- **기능 키**: P (f1), Q (f2), R (f3), S (f4)

### 이유

- 이 매핑은 ANSI escape codes의 표준 초기 세트를 기반으로 하여, 가장 흔한 키 입력을 우선 처리합니다.
- Kitty 프로토콜의 파라미터화된 키에서 모디파이어(Shift, Alt, Ctrl)를 지원합니다.
- 추가 키(예: F5-F12, Insert/Delete)는 CSI-u 폼에서 별도로 처리됩니다.

### 예시 코드

```typescript
const symbolToName: { [k: string]: string } = {
  A: "up",
  B: "down",
  C: "right",
  D: "left",
  H: "home",
  F: "end",
  P: "f1",
  Q: "f2",
  R: "f3",
  S: "f4",
};
```

## 3. Readline과 Raw 데이터 처리

### 배경

Node.js 터미널 입력 처리는 `readline` 모듈을 사용하지만, paste 모드와 Kitty 프로토콜 지원을 위해 raw 데이터를 직접 처리합니다.

### 컴포넌트 역할

- **readline.Interface (rl)**: 키프레스 이벤트를 생성합니다. 일반 키 입력을 감지하고 `handleKeypress` 콜백으로 전달합니다.
- **stdin.on('data') 콜백**: Raw Buffer 데이터를 처리하여 paste 모드 마커(`ESC[200~`, `ESC[201~`)를 감지합니다.
- **usePassthrough 모드**: Node.js 버전(<20)이나 환경 변수(`PASTE_WORKAROUND`)에 따라 활성화됩니다.
  - `true`: `keypressStream`을 통해 raw 데이터를 필터링한 후 `readline`에 전달.
  - `false`: 직접 `stdin`을 `readline`에 연결.

### 설계 이유

- Node.js 버전 호환성을 위해 두 가지 방식을 조합합니다.
- Paste 모드는 raw 스캔이 필요하며, Kitty 시퀀스는 이벤트 기반 파싱이 효율적입니다.
- 데이터 흐름: Raw 데이터 → `handleRawKeypress` (paste 처리) → `keypressStream` → `readline` → `handleKeypress`.

### 예시 코드

```typescript
if (usePassthrough) {
  rl = readline.createInterface({
    input: keypressStream,
    escapeCodeTimeout: 0,
  });
  readline.emitKeypressEvents(keypressStream, rl);
  keypressStream.on("keypress", handleKeypress);
  stdin.on("data", handleRawKeypress);
} else {
  rl = readline.createInterface({ input: stdin, escapeCodeTimeout: 0 });
  readline.emitKeypressEvents(stdin, rl);
  stdin.on("keypress", handleKeypress);
}
```

## 4. Multiline-Text-Input 구현

### 배경

일반 Enter를 Submit으로, Shift+Enter/Alt+Enter/Meta+Enter를 newline 삽입으로 처리하여 multiline 입력을 지원합니다.

### 구현 방법

- `handleKeypress`에서 `key.name === 'return'`일 때 모디파이어를 확인:
  - `key.shift === true` 또는 `key.meta === true`: Newline (`\n`) 삽입, Submit 방지.
  - 그 외: Submit 처리.
- Kitty 프로토콜이 활성화되면 모디파이어가 정확히 파싱됩니다.
- `KeypressProvider`에 `onMultilineNewline`과 `onSubmit` 콜백을 추가하여 입력 컴포넌트를 제어.

### 예시 코드

```typescript
if (key.name === "return") {
  if (key.shift || key.meta) {
    // Newline 삽입
    onMultilineNewline?.();
    return;
  } else {
    // Submit
    onSubmit?.();
    return;
  }
}
```

### 주의점

- 타입 안전성: `Key` 인터페이스의 `shift`, `meta` 필드를 활용.
- 테스트: Bun에서 다양한 키 조합 검증.
- 성능: 불필요한 브로드캐스트 피함.

이 인사이트는 TypeScript 기반 터미널 애플리케이션 개발에 유용하며, 최신 Node.js 버전과의 호환성을 유지합니다.
