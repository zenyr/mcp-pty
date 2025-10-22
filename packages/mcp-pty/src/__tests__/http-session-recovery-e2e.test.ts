/**
 * HTTP Session Recovery E2E Test
 */

import { expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { McpServerFactory } from "../server/index.js";
import { startHttpServer } from "../transports/index.js";

const state = {
  client: undefined as Client | undefined,
  transport: undefined as StreamableHTTPClientTransport | undefined,
  server: undefined as ReturnType<typeof Bun.serve> | undefined,
  s1: undefined as string | undefined,
  s2: undefined as string | undefined,
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const startSrv = async (port: number): Promise<void> => {
  const f = new McpServerFactory({ name: "mcp-pty", version: "0.1.0" });
  state.server = await startHttpServer(() => f.createServer(), port);

  for (let i = 0; i < 15; i++) {
    try {
      await fetch(`http://localhost:${port}/mcp`, {
        signal: AbortSignal.timeout(50),
      });
      return;
    } catch {
      await sleep(30);
    }
  }
};

const killSrv = async (): Promise<void> => {
  if (state.server) {
    await state.server.stop();
    state.server = undefined;
  }
};

const connect = async (port: number): Promise<void> => {
  const tr = new StreamableHTTPClientTransport(
    new URL(`http://localhost:${port}/mcp`),
  );
  state.transport = tr;
  state.client = new Client({ name: "test", version: "1.0" });
  await state.client.connect(tr);
  state.s1 = tr.sessionId;
};

const call = async (label: string): Promise<boolean> => {
  if (!state.client) return false;
  try {
    await Promise.race([
      state.client.listTools(),
      new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error("t")), 2000),
      ),
    ]);
    console.log(`[${label}] OK`);
    return true;
  } catch (e) {
    const msg = String(e);
    if (msg.includes("404")) {
      state.s2 = state.transport?.sessionId;
      console.log(`[${label}] 404`);
    } else {
      console.log(`[${label}] FAIL`);
    }
    return false;
  }
};

const t = (msg: string) =>
  console.log(`[${new Date().toISOString().substring(12, 23)}] ${msg}`);

test("recovery E2E", async () => {
  try {
    // Phase 1: Normal
    t("start");
    await startSrv(6426);
    t("connect");
    await connect(6426);
    t("call 1");
    expect(await call("1")).toBe(true);

    // Phase 2: Server down
    t("kill");
    await killSrv();
    await sleep(500);

    // New client (old server is gone)
    t("reconnect");
    const tr2 = new StreamableHTTPClientTransport(
      new URL(`http://localhost:6426/mcp`),
    );
    state.transport = tr2;
    const c2 = new Client({ name: "test", version: "1.0" });
    state.client = c2;

    try {
      await Promise.race([
        c2.connect(tr2),
        new Promise<never>((_, rej) =>
          setTimeout(() => rej(new Error("timeout")), 2000),
        ),
      ]);
      console.log("[2] connected");
    } catch (e) {
      console.log("[2] fail - " + String(e).substring(0, 40));
    }

    // Phase 3: Restart
    t("restart");
    await sleep(300);
    await startSrv(6426);
    t("call 3");
    const result3 = await call("3");
    if (result3) {
      // Check if session ID changed
      const newId = state.transport?.sessionId;
      if (newId && newId !== state.s1) {
        state.s2 = newId;
        console.log(`[3] session changed`);
      }
    }

    // Phase 4: Final call
    t("wait & call 4");
    await sleep(200);
    expect(await call("4")).toBe(true);
    expect(state.s1).not.toBe(state.s2);
    t("done");
  } finally {
    await killSrv();
    if (state.client) await state.client.close().catch(() => {});
  }
}, 20000);
