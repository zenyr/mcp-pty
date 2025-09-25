# $ Shell

Bun Shell은 JavaScript와 TypeScript로 셸 스크립팅을 재미있게 만들어줍니다. 원활한 JavaScript 상호 운용성을 제공하는 크로스 플랫폼 bash 스타일 셸입니다.

빠른 시작:

```
import { $ } from "bun";

const response = await fetch("https://example.com");

// Response를 stdin으로 사용
await $`cat < ${response} | wc -c`; // 1256
```

## 기능:

- **크로스 플랫폼**: Windows, Linux, macOS에서 작동합니다. `rimraf`나 `cross-env` 대신 추가 의존성 설치 없이 Bun Shell을 사용할 수 있습니다. `ls`, `cd`, `rm`과 같은 일반적인 셸 명령어들이 네이티브로 구현되어 있습니다.
- **친숙함**: Bun Shell은 bash 스타일 셸로, 리다이렉션, 파이프, 환경 변수 등을 지원합니다.
- **글로브**: `**`, `*`, `{expansion}` 등을 포함한 글로브 패턴을 네이티브로 지원합니다.
- **템플릿 리터럴**: 템플릿 리터럴을 사용하여 셸 명령어를 실행합니다. 이를 통해 변수와 표현식을 쉽게 삽입할 수 있습니다.
- **안전성**: Bun Shell은 기본적으로 모든 문자열을 이스케이프하여 셸 인젝션 공격을 방지합니다.
- **JavaScript 상호 운용성**: `Response`, `ArrayBuffer`, `Blob`, `Bun.file(path)` 및 기타 JavaScript 객체를 stdin, stdout, stderr로 사용할 수 있습니다.
- **셸 스크립팅**: Bun Shell은 셸 스크립트(`.bun.sh` 파일)를 실행하는 데 사용할 수 있습니다.
- **커스텀 인터프리터**: Bun Shell은 렉서, 파서, 인터프리터와 함께 Zig로 작성되었습니다. Bun Shell은 작은 프로그래밍 언어입니다.

## 시작하기

가장 간단한 셸 명령어는 `echo`입니다. 실행하려면 `$` 템플릿 리터럴 태그를 사용하세요:

```
import { $ } from "bun";

await $`echo "Hello World!"`; // Hello World!
```

기본적으로 셸 명령어는 stdout에 출력됩니다. 출력을 숨기려면 `.quiet()`를 호출하세요:

```
import { $ } from "bun";

await $`echo "Hello World!"`.quiet(); // 출력 없음
```

명령어의 출력을 텍스트로 접근하고 싶다면? `.text()`를 사용하세요:

```
import { $ } from "bun";

// .text()는 자동으로 .quiet()를 호출합니다
const welcome = await $`echo "Hello World!"`.text();

console.log(welcome); // Hello World!\n
```

기본적으로 `await`를 사용하면 stdout과 stderr를 `Buffer`로 반환합니다.

```
import { $ } from "bun";

const { stdout, stderr } = await $`echo "Hello!"`.quiet();

console.log(stdout); // Buffer(7) [ 72, 101, 108, 108, 111, 33, 10 ]
console.log(stderr); // Buffer(0) []
```

## 에러 처리

기본적으로 0이 아닌 종료 코드는 에러를 발생시킵니다. 이 `ShellError`는 실행된 명령어에 대한 정보를 포함합니다.

```
import { $ } from "bun";

try {
  const output = await $`something-that-may-fail`.text();
  console.log(output);
} catch (err) {
  console.log(`코드 ${err.exitCode}로 실패했습니다`);
  console.log(err.stdout.toString());
  console.log(err.stderr.toString());
}
```

`.nothrow()`로 예외 발생을 비활성화할 수 있습니다. 결과의 `exitCode`를 수동으로 확인해야 합니다.

```
import { $ } from "bun";

const { stdout, stderr, exitCode } = await $`something-that-may-fail`
  .nothrow()
  .quiet();

if (exitCode !== 0) {
  console.log(`0이 아닌 종료 코드 ${exitCode}`);
}

console.log(stdout);
console.log(stderr);
```

0이 아닌 종료 코드의 기본 처리는 `$` 함수 자체에서 `.nothrow()` 또는 `.throws(boolean)`를 호출하여 구성할 수 있습니다.

```
import { $ } from "bun";
// 셸 프로미스는 예외를 발생시키지 않으므로
// 모든 셸 명령어에서 `exitCode`를 수동으로 확인해야 합니다.
$.nothrow(); // $.throws(false)와 동일

// 기본 동작, 0이 아닌 종료 코드는 에러를 발생시킵니다
$.throws(true);

// $.nothrow()의 별칭
$.throws(false);

await $`something-that-may-fail`; // 예외가 발생하지 않음
```

## 리다이렉션

명령어의 _입력_ 또는 _출력_은 일반적인 Bash 연산자를 사용하여 _리다이렉션_할 수 있습니다:

- `<` stdin 리다이렉션
- `>` 또는 `1>` stdout 리다이렉션
- `2>` stderr 리다이렉션
- `&>` stdout과 stderr 모두 리다이렉션
- `>>` 또는 `1>>` stdout 리다이렉션, 덮어쓰기 대신 대상에 _추가_
- `2>>` stderr 리다이렉션, 덮어쓰기 대신 대상에 _추가_
- `&>>` stdout과 stderr 모두 리다이렉션, 덮어쓰기 대신 대상에 _추가_
- `1>&2` stdout을 stderr로 리다이렉션 (stdout에 대한 모든 쓰기가 stderr로 이동)
- `2>&1` stderr를 stdout으로 리다이렉션 (stderr에 대한 모든 쓰기가 stdout으로 이동)

Bun Shell은 JavaScript 객체로부터/로의 리다이렉션도 지원합니다.

### 예제: JavaScript 객체로 출력 리다이렉션 (`>`)

stdout을 JavaScript 객체로 리다이렉션하려면 `>` 연산자를 사용하세요:

```
import { $ } from "bun";

const buffer = Buffer.alloc(100);
await $`echo "Hello World!" > ${buffer}`;

console.log(buffer.toString()); // Hello World!\n
```

다음 JavaScript 객체들이 리다이렉션 대상으로 지원됩니다:

- `Buffer`, `Uint8Array`, `Uint16Array`, `Uint32Array`, `Int8Array`, `Int16Array`, `Int32Array`, `Float32Array`, `Float64Array`, `ArrayBuffer`, `SharedArrayBuffer` (기본 버퍼에 쓰기)
- `Bun.file(path)`, `Bun.file(fd)` (파일에 쓰기)

### 예제: JavaScript 객체에서 입력 리다이렉션 (`<`)

JavaScript 객체의 출력을 stdin으로 리다이렉션하려면 `<` 연산자를 사용하세요:

```
import { $ } from "bun";

const response = new Response("hello i am a response body");

const result = await $`cat < ${response}`.text();

console.log(result); // hello i am a response body
```

다음 JavaScript 객체들이 리다이렉션 소스로 지원됩니다:

- `Buffer`, `Uint8Array`, `Uint16Array`, `Uint32Array`, `Int8Array`, `Int16Array`, `Int32Array`, `Float32Array`, `Float64Array`, `ArrayBuffer`, `SharedArrayBuffer` (기본 버퍼에서 읽기)
- `Bun.file(path)`, `Bun.file(fd)` (파일에서 읽기)
- `Response` (본문에서 읽기)

### 예제: stdin -> 파일 리다이렉션

```
import { $ } from "bun";

await $`cat < myfile.txt`;
```

### 예제: stdout -> 파일 리다이렉션

```
import { $ } from "bun";

await $`echo bun! > greeting.txt`;
```

### 예제: stderr -> 파일 리다이렉션

```
import { $ } from "bun";

await $`bun run index.ts 2> errors.txt`;
```

### 예제: stderr -> stdout 리다이렉션

```
import { $ } from "bun";

// stderr를 stdout으로 리다이렉션하므로 모든 출력이
// stdout에서 사용 가능합니다
await $`bun run ./index.ts 2>&1`;
```

### 예제: stdout -> stderr 리다이렉션

```
import { $ } from "bun";

// stdout을 stderr로 리다이렉션하므로 모든 출력이
// stderr에서 사용 가능합니다
await $`bun run ./index.ts 1>&2`;
```

## 파이핑 (`|`)

bash에서와 같이 한 명령어의 출력을 다른 명령어로 파이프할 수 있습니다:

```
import { $ } from "bun";

const result = await $`echo "Hello World!" | wc -w`.text();

console.log(result); // 2\n
```

JavaScript 객체와도 파이프할 수 있습니다:

```
import { $ } from "bun";

const response = new Response("hello i am a response body");

const result = await $`cat < ${response} | wc -w`.text();

console.log(result); // 6\n
```

## 명령어 치환 (`$(...)`)

명령어 치환을 사용하면 다른 스크립트의 출력을 현재 스크립트에 치환할 수 있습니다:

```
import { $ } from "bun";

// 현재 커밋의 해시를 출력합니다
await $`echo Hash of current commit: $(git rev-parse HEAD)`;
```

이는 명령어 출력의 텍스트 삽입이며, 예를 들어 셸 변수를 선언하는 데 사용할 수 있습니다:

```
import { $ } from "bun";

await $`
  REV=$(git rev-parse HEAD)
  docker built -t myapp:$REV
  echo Done building docker image "myapp:$REV"
`;
```

**참고**: Bun이 내부적으로 입력 템플릿 리터럴의 특별한 [`raw`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#raw_strings) 속성을 사용하기 때문에 명령어 치환에 백틱 구문을 사용하면 작동하지 않습니다:

```
import { $ } from "bun";

await $`echo \`echo hi\``;
```

다음을 출력하는 대신:

```
hi
```

위 코드는 다음을 출력합니다:

```
echo hi
```

대신 `$(...)` 구문을 사용하는 것을 권장합니다.

## 환경 변수

환경 변수는 bash에서와 같이 설정할 수 있습니다:

```
import { $ } from "bun";

await $`FOO=foo bun -e 'console.log(process.env.FOO)'`; // foo\n
```

문자열 보간을 사용하여 환경 변수를 설정할 수 있습니다:

```
import { $ } from "bun";

const foo = "bar123";

await $`FOO=${foo + "456"} bun -e 'console.log(process.env.FOO)'`; // bar123456\n
```

입력은 기본적으로 이스케이프되어 셸 인젝션 공격을 방지합니다:

```
import { $ } from "bun";

const foo = "bar123; rm -rf /tmp";

await $`FOO=${foo} bun -e 'console.log(process.env.FOO)'`; // bar123; rm -rf /tmp\n
```

### 환경 변수 변경

기본적으로 `process.env`가 모든 명령어의 환경 변수로 사용됩니다.

`.env()`를 호출하여 단일 명령어의 환경 변수를 변경할 수 있습니다:

```
import { $ } from "bun";

await $`echo $FOO`.env({ ...process.env, FOO: "bar" }); // bar
```

`$.env`를 호출하여 모든 명령어의 기본 환경 변수를 변경할 수 있습니다:

```
import { $ } from "bun";

$.env({ FOO: "bar" });

// 전역으로 설정된 $FOO
await $`echo $FOO`; // bar

// 로컬로 설정된 $FOO
await $`echo $FOO`.env({ FOO: "baz" }); // baz
```

인수 없이 `$.env()`를 호출하여 환경 변수를 기본값으로 재설정할 수 있습니다:

```
import { $ } from "bun";

$.env({ FOO: "bar" });

// 전역으로 설정된 $FOO
await $`echo $FOO`; // bar

// 로컬로 설정된 $FOO
await $`echo $FOO`.env(undefined); // ""
```

### 작업 디렉토리 변경

`.cwd()`에 문자열을 전달하여 명령어의 작업 디렉토리를 변경할 수 있습니다:

```
import { $ } from "bun";

await $`pwd`.cwd("/tmp"); // /tmp
```

`$.cwd`를 호출하여 모든 명령어의 기본 작업 디렉토리를 변경할 수 있습니다:

```
import { $ } from "bun";

$.cwd("/tmp");

// 전역으로 설정된 작업 디렉토리
await $`pwd`; // /tmp

// 로컬로 설정된 작업 디렉토리
await $`pwd`.cwd("/"); // /
```

## 출력 읽기

명령어의 출력을 문자열로 읽으려면 `.text()`를 사용하세요:

```
import { $ } from "bun";

const result = await $`echo "Hello World!"`.text();

console.log(result); // Hello World!\n
```

### JSON으로 출력 읽기

명령어의 출력을 JSON으로 읽으려면 `.json()`을 사용하세요:

```
import { $ } from "bun";

const result = await $`echo '{"foo": "bar"}'`.json();

console.log(result); // { foo: "bar" }
```

### 줄별로 출력 읽기

명령어의 출력을 줄별로 읽으려면 `.lines()`를 사용하세요:

```
import { $ } from "bun";

for await (let line of $`echo "Hello World!"`.lines()) {
  console.log(line); // Hello World!
}
```

완료된 명령어에서도 `.lines()`를 사용할 수 있습니다:

```
import { $ } from "bun";

const search = "bun";

for await (let line of $`cat list.txt | grep ${search}`.lines()) {
  console.log(line);
}
```

### Blob으로 출력 읽기

명령어의 출력을 Blob으로 읽으려면 `.blob()`을 사용하세요:

```
import { $ } from "bun";

const result = await $`echo "Hello World!"`.blob();

console.log(result); // Blob(13) { size: 13, type: "text/plain" }
```

## 내장 명령어

크로스 플랫폼 호환성을 위해 Bun Shell은 PATH 환경 변수에서 명령어를 읽는 것 외에도 내장 명령어 세트를 구현합니다.

- `cd`: 작업 디렉토리 변경
- `ls`: 디렉토리의 파일 목록 표시
- `rm`: 파일 및 디렉토리 제거
- `echo`: 텍스트 출력
- `pwd`: 작업 디렉토리 출력
- `bun`: bun에서 bun 실행
- `cat`
- `touch`
- `mkdir`
- `which`
- `mv`
- `exit`
- `true`
- `false`
- `yes`
- `seq`
- `dirname`
- `basename`

**부분적으로** 구현됨:

- `mv`: 파일 및 디렉토리 이동 (크로스 디바이스 지원 누락)

아직 구현되지 **않았지만** 계획됨:

- 전체 목록은 [Issue #9716](https://github.com/oven-sh/bun/issues/9716)을 참조하세요.

## 유틸리티

Bun Shell은 셸 작업을 위한 유틸리티 세트도 구현합니다.

### `$.braces` (중괄호 확장)

이 함수는 셸 명령어를 위한 간단한 [중괄호 확장](https://www.gnu.org/software/bash/manual/html_node/Brace-Expansion.html)을 구현합니다:

```
import { $ } from "bun";

await $.braces(`echo {1,2,3}`);
// => ["echo 1", "echo 2", "echo 3"]
```

### `$.escape` (문자열 이스케이프)

Bun Shell의 이스케이프 로직을 함수로 노출합니다:

```
import { $ } from "bun";

console.log($.escape('$(foo) `bar` "baz"'));
// => \$(foo) \`bar\` \"baz\"
```

문자열이 이스케이프되지 않기를 원한다면 `{ raw: 'str' }` 객체로 감싸세요:

```
import { $ } from "bun";

await $`echo ${{ raw: 'Hello "World"' }}`;
// => Hello "World"
```

### `$.which` (명령어 찾기)

PATH에서 명령어를 찾습니다:

```
import { $ } from "bun";

console.log($.which("bun")); // /path/to/bun
```

### `$.pwd` (현재 디렉토리)

현재 작업 디렉토리를 반환합니다:

```
import { $ } from "bun";

console.log($.pwd()); // /current/working/directory
```

## 셸 스크립트 파일

Bun Shell은 `.bun.sh` 확장자를 가진 셸 스크립트 파일을 실행할 수 있습니다:

```bash
#!/usr/bin/env bun

import { $ } from "bun";

const name = "World";
await $`echo Hello ${name}!`;
```

이 파일을 실행하려면:

```bash
bun script.bun.sh
```

## 고급 사용법

### 조건부 실행

`&&` 및 `||` 연산자를 사용하여 조건부 실행을 할 수 있습니다:

```
import { $ } from "bun";

await $`test -f package.json && echo "package.json exists"`;
await $`test -f missing.txt || echo "missing.txt does not exist"`;
```

### 백그라운드 프로세스

`&`를 사용하여 백그라운드에서 프로세스를 실행할 수 있습니다:

```
import { $ } from "bun";

await $`sleep 10 &`;
console.log("This runs immediately");
```

### 여러 명령어

`;`를 사용하여 여러 명령어를 순차적으로 실행할 수 있습니다:

```
import { $ } from "bun";

await $`echo "First command"; echo "Second command"`;
```

## 성능 고려사항

- Bun Shell은 네이티브 성능을 위해 Zig로 작성되었습니다
- 내장 명령어는 외부 프로세스를 생성하지 않으므로 더 빠릅니다
- JavaScript 객체와의 직접 상호 운용성으로 불필요한 직렬화를 방지합니다

## 제한사항

- 일부 고급 bash 기능은 아직 구현되지 않았습니다
- Windows에서 일부 POSIX 특정 동작이 다를 수 있습니다
- 복잡한 셸 스크립트는 추가 테스트가 필요할 수 있습니다

## 마이그레이션 가이드

### bash에서 마이그레이션

기존 bash 스크립트를 Bun Shell로 마이그레이션하려면:

1. `#!/bin/bash`를 `#!/usr/bin/env bun`으로 변경
2. 스크립트 상단에 `import { $ } from "bun";` 추가
3. 명령어를 `$\`...\`` 템플릿 리터럴로 감싸기
4. JavaScript 변수 및 표현식 활용

### Node.js에서 마이그레이션

Node.js의 `child_process`에서 마이그레이션하려면:

```javascript
// Node.js
const { execSync } = require('child_process');
const output = execSync('echo "Hello"', { encoding: 'utf8' });

// Bun Shell
import { $ } from "bun";
const output = await $`echo "Hello"`.text();
```

이 문서는 Bun Shell의 주요 기능과 사용법을 다룹니다. 더 자세한 정보는 [Bun 공식 문서](https://bun.sh/docs)를 참조하세요.