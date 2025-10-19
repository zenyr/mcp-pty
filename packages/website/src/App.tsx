import "./index.css";

export const App = () => {
	return (
		<div className="app">
			<header className="header">
				<h1>mcp-pty</h1>
				<p className="subtitle">
					MCP server for PTY process management with Bun
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
					<h2>Quick Start</h2>
					<pre className="code">
						<code>
							{`# Install globally
bunx mcp-pty

# Or use with MCP client (stdio mode)
{
  "mcpServers": {
    "mcp-pty": {
      "command": "bunx",
      "args": ["mcp-pty"]
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
