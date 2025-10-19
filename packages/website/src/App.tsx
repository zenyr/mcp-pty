import "./index.css";

export const App = () => {
	return (
		<div className="app">
			<header className="header">
				<h1>mcp-pty</h1>
				<p className="subtitle">
					MCP server for PTY process management with Bun
				</p>
				<p className="notice">
					⚠️ <strong>Bun Runtime Required:</strong> Currently Bun-only due to{" "}
					<code>bun:ffi</code> dependency. Node.js support planned for future
					releases.{" "}
					<a
						href="https://bun.sh/docs/installation"
						target="_blank"
						rel="noopener noreferrer"
						className="install-link"
					>
						Install Bun →
					</a>
				</p>
			</header>

			<main className="main">
			<section className="section">
				<h2>Features</h2>
				<ul className="feature-list">
					<li>🚀 PTY process management via MCP protocol</li>
					<li>⚡ Built with Bun for maximum performance</li>
					<li>🔒 Session-based isolation with secure defaults</li>
					<li>🌐 Dual transport support (stdio & HTTP)</li>
					<li>📝 Full terminal state capture (xterm.js headless)</li>
					<li>🎯 Interactive input support (CJK, Emoji, ANSI)</li>
				</ul>
			</section>

			<section className="section">
				<h2>Technical Stack</h2>
				<ul className="feature-list">
					<li>
						<strong>PTY Backend:</strong>{" "}
						<a
							href="https://www.npmjs.com/package/@zenyr/bun-pty"
							className="tech-link"
							target="_blank"
							rel="noopener noreferrer"
						>
							@zenyr/bun-pty
						</a>{" "}
						(fork of bun-pty with exit code handling, ARM64 support, and FFI
						fixes)
					</li>
					<li>
						<strong>Terminal Emulation:</strong> xterm.js headless mode for full
						state capture
					</li>
					<li>
						<strong>Transport:</strong> MCP SDK with stdio/HTTP dual support
					</li>
					<li>
						<strong>Runtime:</strong> Bun 1.0+ with native FFI and optimized I/O
					</li>
				</ul>
			</section>

			<section className="section">
				<h2>Quick Start</h2>
				<pre className="code">
					<code>
						{`# Install globally
bunx mcp-pty

# Stdio mode (recommended for MCP clients)
{
  "mcpServers": {
    "mcp-pty": {
      "command": "bunx",
      "args": ["mcp-pty"]
    }
  }
}

# HTTP mode (for remote access, default port: 6420)
bunx mcp-pty --transport http

# Or specify custom port
bunx mcp-pty --transport http --port 8080

# Then connect with MCP client
{
  "mcpServers": {
    "mcp-pty": {
      "url": "http://localhost:6420/mcp"
    }
  }
}`}
					</code>
				</pre>
			</section>

				<section className="section">
					<h2>Links</h2>
					<div className="links">
						<a
							href="https://github.com/zenyr/mcp-pty"
							className="link"
							target="_blank"
							rel="noopener noreferrer"
						>
							GitHub Repository
						</a>
						<a
							href="https://github.com/zenyr/mcp-pty#readme"
							className="link"
							target="_blank"
							rel="noopener noreferrer"
						>
							Documentation
						</a>
						<a
							href="https://www.npmjs.com/package/mcp-pty"
							className="link"
							target="_blank"
							rel="noopener noreferrer"
						>
							NPM Package
						</a>
					</div>
				</section>
			</main>

			<footer className="footer">
				<p>
					Built with{" "}
					<a
						href="https://bun.sh"
						className="bun-link"
						target="_blank"
						rel="noopener noreferrer"
					>
						Bun
					</a>{" "}
					&{" "}
					<a
						href="https://modelcontextprotocol.io"
						className="bun-link"
						target="_blank"
						rel="noopener noreferrer"
					>
						MCP
					</a>
				</p>
			</footer>
		</div>
	);
};

export default App;
