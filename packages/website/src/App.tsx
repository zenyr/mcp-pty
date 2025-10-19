import { type FC } from "react";

/**
 * Main landing page component for mcp-pty
 */
export const App: FC = () => {
	return (
		<div style={styles.container}>
			<header style={styles.header}>
				<h1 style={styles.title}>mcp-pty</h1>
				<p style={styles.subtitle}>
					MCP server for PTY process management with Bun
				</p>
			</header>

			<main style={styles.main}>
				<section style={styles.section}>
					<h2>Features</h2>
					<ul style={styles.featureList}>
						<li>🚀 PTY process management via MCP protocol</li>
						<li>⚡ Built with Bun for maximum performance</li>
						<li>🔒 Session-based isolation with secure defaults</li>
						<li>🌐 Dual transport support (stdio & HTTP)</li>
						<li>📝 Full terminal state capture (xterm.js headless)</li>
						<li>🎯 Interactive input support (CJK, Emoji, ANSI)</li>
					</ul>
				</section>

				<section style={styles.section}>
					<h2>Quick Start</h2>
					<pre style={styles.code}>
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

				<section style={styles.section}>
					<h2>Links</h2>
					<div style={styles.links}>
						<a
							href="https://github.com/zenyr/mcp-pty"
							style={styles.link}
							target="_blank"
							rel="noopener noreferrer"
						>
							GitHub Repository
						</a>
						<a
							href="https://github.com/zenyr/mcp-pty#readme"
							style={styles.link}
							target="_blank"
							rel="noopener noreferrer"
						>
							Documentation
						</a>
						<a
							href="https://www.npmjs.com/package/mcp-pty"
							style={styles.link}
							target="_blank"
							rel="noopener noreferrer"
						>
							NPM Package
						</a>
					</div>
				</section>
			</main>

			<footer style={styles.footer}>
				<p>
					Built with{" "}
					<a
						href="https://bun.sh"
						style={styles.bunLink}
						target="_blank"
						rel="noopener noreferrer"
					>
						Bun
					</a>{" "}
					&{" "}
					<a
						href="https://modelcontextprotocol.io"
						style={styles.bunLink}
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

const styles = {
	container: {
		fontFamily: "system-ui, -apple-system, sans-serif",
		maxWidth: "900px",
		margin: "0 auto",
		padding: "2rem",
		lineHeight: "1.6",
	},
	header: {
		textAlign: "center" as const,
		marginBottom: "3rem",
	},
	title: {
		fontSize: "3rem",
		margin: "0 0 0.5rem 0",
		color: "#111",
		fontWeight: "700",
	},
	subtitle: {
		fontSize: "1.25rem",
		color: "#666",
		margin: 0,
	},
	main: {
		marginBottom: "3rem",
	},
	section: {
		marginBottom: "2rem",
	},
	featureList: {
		listStyle: "none",
		padding: 0,
		fontSize: "1.1rem",
	},
	code: {
		background: "#f5f5f5",
		padding: "1rem",
		borderRadius: "8px",
		overflow: "auto",
		fontSize: "0.9rem",
	},
	links: {
		display: "flex",
		gap: "1rem",
		flexWrap: "wrap" as const,
	},
	link: {
		padding: "0.75rem 1.5rem",
		background: "#111",
		color: "#fff",
		textDecoration: "none",
		borderRadius: "6px",
		fontSize: "1rem",
		transition: "background 0.2s",
	},
	footer: {
		textAlign: "center" as const,
		color: "#666",
		fontSize: "0.9rem",
		paddingTop: "2rem",
		borderTop: "1px solid #e0e0e0",
	},
	bunLink: {
		color: "#111",
		textDecoration: "none",
		fontWeight: "600",
	},
};
