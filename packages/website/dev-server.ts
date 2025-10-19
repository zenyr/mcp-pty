#!/usr/bin/env bun

/**
 * Development server for website
 * Serves static HTML with hot-reloading React bundle
 */

import { resolve } from "node:path";

const srcDir = resolve(import.meta.dir, "src");
const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 3000;

Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url);

    // Serve index.html for root
    if (url.pathname === "/" || url.pathname === "/index.html") {
      return new Response(
        `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>mcp-pty - Development</title>
	<style>
		* { margin: 0; padding: 0; box-sizing: border-box; }
		body { font-family: system-ui, -apple-system, sans-serif; }
	</style>
</head>
<body>
	<div id="root"></div>
	<script type="module" src="/src/index.tsx"></script>
</body>
</html>`,
        { headers: { "Content-Type": "text/html" } },
      );
    }

    // Serve source files
    if (url.pathname.startsWith("/src/")) {
      const filePath = resolve(import.meta.dir, url.pathname.slice(1));
      const file = Bun.file(filePath);

      if (await file.exists()) {
        return new Response(file);
      }
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`🚀 Dev server running at http://localhost:${port}`);
console.log(`   Source: ${srcDir}`);
