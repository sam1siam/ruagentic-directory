# ruagentic

Add any MCP server listed on [RUAGENTIC](https://ruagentic.com) to your client with one command.

```sh
npx ruagentic add github-mcp --client cursor
npx ruagentic add github-mcp --client claude-code
npx ruagentic add github-mcp --client claude-desktop
npx ruagentic add github-mcp --client codex
npx ruagentic add github-mcp --client windsurf
```

Without `--client` it asks. `--user` writes the client's user-level file instead of the project one (Cursor). `--dry-run` shows the change and stops. `--yes` skips the confirmation. `--no-ping` skips the anonymous install count the listing's maker sees on their dashboard.

```sh
npx ruagentic search postgres        # find listings
npx ruagentic show github-mcp        # the published connection facts
```

## What it writes

The entry comes from the listing's published facts only: a hosted server becomes `{ "url": ... }`; a published npm, PyPI, OCI or NuGet package becomes the command that runs it (`npx -y`, `uvx`, `docker run -i --rm`, `dnx`). Required variables are written as `<value>` placeholders for you to fill in. Nothing is downloaded or executed by this tool; Claude Code's own `claude mcp add` is run only after you confirm.

| Client         | File                                                         |
| -------------- | ------------------------------------------------------------ |
| Claude Code    | runs `claude mcp add …`                                      |
| Cursor         | `./.cursor/mcp.json` (or `~/.cursor/mcp.json` with `--user`) |
| Claude Desktop | `claude_desktop_config.json` in the app's config folder      |
| Codex          | `~/.codex/config.toml`, a `[mcp_servers.<key>]` table        |
| Windsurf       | `~/.codeium/windsurf/mcp_config.json`                        |

Existing entries with the same key are replaced; everything else in the file is kept.

## API

The CLI reads `https://ruagentic.com/api/v1/listings/<slug>/connect`, a public, read-only endpoint. Point it elsewhere with `RUAGENTIC_API=https://…`.

MIT © RUAGENTIC
