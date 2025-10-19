#!/usr/bin/env bun

/**
 * Build script for GitHub Pages static site
 * Uses Bun native build chain (Bun.build API)
 */

import { rmSync } from "node:fs";
import { resolve } from "node:path";

const distDir = resolve(import.meta.dir, "dist");
const publicDir = resolve(import.meta.dir, "public");

// Clean dist directory
try {
  rmSync(distDir, { recursive: true, force: true });
} catch {
  // Ignore if dist doesn't exist
}

// Build with Bun
const result = await Bun.build({
  entrypoints: [resolve(import.meta.dir, "src/index.tsx")],
  outdir: distDir,
  target: "browser",
  format: "esm",
  splitting: true,
  minify: { identifiers: true, syntax: true, whitespace: true },
  sourcemap: "none",
  naming: {
    entry: "[dir]/[name].[ext]",
    chunk: "[name]-[hash].[ext]",
    asset: "assets/[name]-[hash].[ext]",
  },
});

if (!result.success) {
  console.error("Build failed:");
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

// Copy public assets (including dotfiles like .nojekyll)
try {
  const { readdirSync } = await import("node:fs");
  const { join } = await import("node:path");

  const copyRecursive = (src: string, dest: string) => {
    const entries = readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = join(src, entry.name);
      const destPath = join(dest, entry.name);

      if (entry.isDirectory()) {
        copyRecursive(srcPath, destPath);
      } else {
        Bun.write(destPath, Bun.file(srcPath));
      }
    }
  };

  copyRecursive(publicDir, distDir);
} catch {
  // Ignore if public doesn't exist
}

// Generate index.html with base path for GitHub Pages
const html = `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta name="description" content="mcp-pty - MCP server for PTY process management with Bun">
	<title>mcp-pty - PTY Management for MCP</title>
	<style>
		* { margin: 0; padding: 0; box-sizing: border-box; }
		body { font-family: system-ui, -apple-system, sans-serif; }
	</style>
</head>
<body>
	<div id="root"></div>
	<script type="module" src="/mcp-pty/index.js"></script>
</body>
</html>`;

await Bun.write(resolve(distDir, "index.html"), html);

console.log(`✅ Build complete: ${distDir}`);
console.log(`   Outputs: ${result.outputs.length} files`);
