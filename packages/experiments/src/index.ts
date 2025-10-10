import { setTimeout as sleep } from "node:timers/promises";
import { stripVTControlCharacters } from "node:util";
import { isNumber } from "@sindresorhus/is";
import { SerializeAddon } from "@xterm/addon-serialize";
import { Terminal } from "@xterm/headless";
import { $ } from "bun";
import { type IPtyForkOptions, spawn as ptySpawn } from "bun-pty";

const XTERM_DEFAULT_OPTIONS = {
  allowProposedApi: true,
  cursorBlink: false,
} as const;
interface Params {
  command: string;
  args?: string[];
  ptyOptions: Partial<IPtyForkOptions> & { cols: number; rows: number };
}
const spawn = async (params: Params) => {
  const { command, args = [], ptyOptions } = params;
  const { name = "xterm-256color", cols, rows } = ptyOptions;

  let exitCode: number | undefined;
  const pty = ptySpawn(command, args, { ...ptyOptions, name });
  const term = new Terminal({ ...XTERM_DEFAULT_OPTIONS, cols, rows });
  const serializeAddon = new SerializeAddon();
  term.loadAddon(serializeAddon);

  pty.onData(term.write.bind(term));
  pty.onExit((e) => {
    exitCode = e.exitCode;
    term.dispose();
  });

  const getStatus = () => {
    if (isNumber(exitCode)) {
      return { exitCode };
    }
    return { exitCode, pid: pty.pid };
  };
  const getScreen = (stripAnsi = false) => {
    if (isNumber(exitCode)) {
      return "";
    }
    const screen = serializeAddon.serialize({ excludeModes: true });
    return stripAnsi ? stripVTControlCharacters(screen) : screen;
  };
  const kill = (signal?: string) => {
    if (isNumber(exitCode)) {
      return;
    }
    pty.kill(signal);
  };
  const sendSequence = (seq: string) => {
    if (isNumber(exitCode)) {
      return;
    }
    pty.write(seq);
  };
  return { getStatus, getScreen, sendSequence, kill };
};

const detectTerminalSize = async (): Promise<{
  cols?: number;
  rows?: number;
}> => {
  try {
    const result =
      await $`stty size 2>/dev/null || (mode con 2>/dev/null | awk '/Lines:/{lines=$2} /Columns:/{cols=$2} END{if(lines && cols) print lines, cols; else print "N/A"}')`.text();
    const [rows, cols] = result.split(" ").map(Number);
    if (!(isNumber(rows) && isNumber(cols))) {
      throw new Error("Failed to detect terminal size");
    }
    return { cols, rows };
  } catch {
    return { cols: undefined, rows: undefined };
  }
};

export const main = async () => {
  const { cols = 80, rows = 24 } = await detectTerminalSize();
  const term = await spawn({
    command: "vim",
    args: ["/dev/null"],
    ptyOptions: { cols, rows },
  });
  await sleep(1000);
  console.info(`${term.getScreen()}\\033[0m`);
  await sleep(1000);
  term.kill("SIGINT");
};

if (import.meta.main) {
  main().catch(console.error);
}
