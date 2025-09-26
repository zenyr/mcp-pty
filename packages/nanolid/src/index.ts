import {
  ulid,
  encode as ulidEncode,
  decode as ulidDecode,
} from "@ulid/javascript";
import { customAlphabet } from "nanoid";

/**
 * Base62 알파벳 (NanoID 스타일: A-Z, a-z, 0-9 – URL-safe and efficient)
 */
const BASE62_ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const BASE62_LENGTH = BASE62_ALPHABET.length; // 62

/**
 * 80비트 랜덤 바이트를 Base62 문자열로 인코딩 (약 13-14자)
 * - ULID의 엔트로피를 유지하면서 길이 단축
 * @param randomBytes ULID의 랜덤 부분 (Uint8Array, 10바이트 = 80비트)
 * @returns Base62 인코딩된 랜덤 문자열 (고정 길이로 패딩하여 정렬 안정화)
 */
const encodeRandomToBase62 = (randomBytes: Uint8Array): string => {
  // Uint8Array를 BigInt로 변환 (전체 엔트로피 보존)
  let bigInt = 0n;
  for (const byte of randomBytes) {
    bigInt = (bigInt << 8n) + BigInt(byte);
  }

  // BigInt를 Base62로 변환
  if (bigInt === 0n) return BASE62_ALPHABET[0];
  let result = "";
  while (bigInt > 0n) {
    result = BASE62_ALPHABET[Number(bigInt % BigInt(BASE62_LENGTH))] + result;
    bigInt = bigInt / BigInt(BASE62_LENGTH);
  }

  // 고정 길이 14자로 패딩 (Base62로 80비트 ≈ 13.7자, 정렬/비교 안정화)
  return result.padStart(14, BASE62_ALPHABET[0]);
};

/**
 * 하이브리드 NanoLID 생성: 시간 부분 (Base32, 10자) + 랜덤 부분 (Base62, 14자)
 * - 정렬 가능성: 시간 prefix 덕분에 생성 순서대로 문자열 정렬됨
 * - 효율성: 표준 ULID(26자) 대비 약 24자로 단축
 * - 충돌 확률: ULID와 동일 (80비트 랜덤 엔트로피)
 * - 사용 사례: MCP 세션 ID처럼 시간 기반 추적이 필요한 ID
 * @returns 하이브리드 ID 문자열 (예: "01J8X7K9ZABcdefGHIjklmNop")
 */
export const generateNanoLID = (): string => {
  const fullULID = ulid(); // 표준 ULID 생성 (128비트)

  // ULID 디코딩: 시간(48비트)과 랜덤(80비트) 분리
  const decoded = ulidDecode(fullULID);
  const timePart = ulidEncode(decoded.timestamp, "base32crockford"); // 시간 부분 Base32 재인코딩 (10자, Crockford 스타일)
  const randomPartBytes = new Uint8Array(decoded.random); // 랜덤 80비트 바이트 (10바이트)

  const encodedRandom = encodeRandomToBase62(randomPartBytes);

  return `${timePart}${encodedRandom}`;
};

/**
 * 표준 ULID 생성 (기존 코드와의 호환성을 위해 export)
 * @returns 표준 ULID 문자열 (26자)
 */
export const generateULID = ulid;

/**
 * NanoID 생성 (NanoID 유틸 제공, 선택적 사용)
 * @param size - ID 길이 (기본 21자)
 * @returns NanoID 문자열
 */
export const generateNanoID = customAlphabet(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
  21
);

/**
 * 여러 ID 생성 및 정렬 테스트 유틸 (개발/테스트용)
 * @param count - 생성할 ID 개수
 * @param delayMs - 각 ID 간 지연 (시간 차이 유발, 기본 100ms)
 * @returns 정렬된 ID 배열
 */
export const generateAndSortNanoLIDs = async (
  count: number = 5,
  delayMs: number = 100
): Promise<string[]> => {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    ids.push(generateNanoLID());
    if (i < count - 1) await Bun.sleep(delayMs);
  }
  return ids.sort(); // 시간 순 정렬 확인
};

// 모듈 export (Bun/TypeScript 호환)
export type NanoLID = string;
export type ULID = string;

// 사용 예시 (main 모드에서 테스트)
if (import.meta.main) {
  Bun.serve({
    port: 0, // 테스트용, 실제 사용 시 제거
    fetch() {
      return new Response("NanoLID package ready!", { status: 200 });
    },
  });

  console.log("NanoLID v0.1.0 initialized");
  console.log("Example ID:", generateNanoLID());
}
