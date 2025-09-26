import { ulid } from "ulid";

/**
 * 새로운 세션 ID를 생성합니다.
 * ULID 기반으로 시간 정렬이 가능합니다.
 */
export const generateSessionId = (): string => ulid();
