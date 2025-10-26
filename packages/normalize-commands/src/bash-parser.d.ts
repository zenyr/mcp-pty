import type { BashNode } from "./types";

declare module "bash-parser" {
  function parse(input: string): BashNode;
  export = parse;
}
