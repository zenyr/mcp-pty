import { expect, test } from "bun:test";
import { createLogger, Logger, logger } from "../index";

test("Logger > creates logger instance", () => {
  const log = new Logger();
  expect(log).toBeInstanceOf(Logger);
});

test("Logger > creates scoped logger", () => {
  const log = createLogger("test");
  expect(log).toBeInstanceOf(Logger);
});

test("Logger > default logger instance", () => {
  expect(logger).toBeInstanceOf(Logger);
});
