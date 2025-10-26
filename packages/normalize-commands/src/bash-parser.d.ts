declare module "bash-parser" {
  import type { BashNode } from "./types";

  function parse(input: string): BashNode;
  export = parse;
}
