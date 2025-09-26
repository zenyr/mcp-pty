import { test, expect } from "bun:test";
import {
  generateNanoLID,
  generateULID,
  generateAndSortNanoLIDs,
} from "../index";

/**
 * NanoLID 테스트: 정렬 가능성, 길이, 고유성 확인
 */
test("generateNanoLID produces sortable IDs", async () => {
  const ids = await generateAndSortNanoLIDs(3, 50);
  expect(ids.length).toBe(3);
  expect(ids[0].length).toBe(24); // 10 + 14
  expect(ids[0]).not.toBe(ids[1]);
  expect(ids[0]).not.toBe(ids[2]);
  // 정렬 확인: 첫 ID < 둘째 < 셋째
  expect(ids[0] < ids[1]).toBe(true);
  expect(ids[1] < ids[2]).toBe(true);
});

test("generateNanoLID length is consistent", () => {
  const id = generateNanoLID();
  expect(id.length).toBe(24);
  expect(typeof id).toBe("string");
  expect(id).toMatch(/^[0-7][0-9A-HJKMNP-TV-Z]{9}[0-9A-Za-z]{14}$/); // 대략 패턴
});

test("generateULID compatibility", () => {
  const id = generateULID();
  expect(id.length).toBe(26);
  expect(typeof id).toBe("string");
});

test("generateNanoID works", () => {
  const id = generateNanoID();
  expect(id.length).toBe(21);
  expect(typeof id).toBe("string");
});
