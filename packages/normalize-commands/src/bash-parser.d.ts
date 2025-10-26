import type { BashNode } from "./types";

declare module "bash-parser" {
  export default function parse(input: string): BashNode;
}
