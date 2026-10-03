/** Where each MCP client keeps its configuration and how a listing's
 *  published connection facts become an entry in it. Pure; shared by the
 *  MCP finder and mirrored by the `ruagentic` CLI. */
export const CLIENTS = [
  'claude-code',
  'cursor',
  'claude-desktop',
  'codex',
  'windsurf',
] as const;
export type Client = (typeof CLIENTS)[number];
export type ServerConfig = {
  url?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
};
/** A URL entry for a hosted server, or the command that runs a published
 *  package locally. Required variables become placeholders; nothing is
 *  guessed. */
export function serverConfigFor(plan: {
  remote: { url: string; type: string } | null;
  package: { registryType: string; identifier: string; version: string } | null;
  requiredEnv: string[];
}): ServerConfig | null {
  if (plan.remote?.url) return { url: plan.remote.url };
  const pkg = plan.package;
  if (!pkg?.identifier) return null;
  const run =
    pkg.registryType === 'npm'
      ? { command: 'npx', args: ['-y', pkg.identifier] }
      : pkg.registryType === 'pypi'
        ? { command: 'uvx', args: [pkg.identifier] }
        : pkg.registryType === 'oci'
          ? { command: 'docker', args: ['run', '-i', '--rm', pkg.identifier] }
          : pkg.registryType === 'nuget'
            ? { command: 'dnx', args: [pkg.identifier, '--yes'] }
            : null;
  if (!run) return null;
  const env = Object.fromEntries(plan.requiredEnv.map((e) => [e, '<value>']));
  return Object.keys(env).length ? { ...run, env } : run;
}
/** Where a client reads its configuration, in words a person can follow. */
export function clientTarget(client: Client): {
  kind: 'command' | 'json' | 'toml';
  where: string;
} {
  switch (client) {
    case 'claude-code':
      return { kind: 'command', where: 'the terminal' };
    case 'cursor':
      return {
        kind: 'json',
        where: '.cursor/mcp.json in the project (or ~/.cursor/mcp.json)',
      };
    case 'windsurf':
      return { kind: 'json', where: '~/.codeium/windsurf/mcp_config.json' };
    case 'claude-desktop':
      return {
        kind: 'json',
        where:
          'claude_desktop_config.json (Claude Desktop → Settings → Developer → Edit Config)',
      };
    case 'codex':
      return { kind: 'toml', where: '~/.codex/config.toml' };
  }
}
/** The `claude mcp add` command for Claude Code. */
export function claudeCodeCommand(
  key: string,
  server: ServerConfig,
  remoteType?: string,
): string {
  if (server.url) {
    const transport = remoteType === 'sse' ? 'sse' : 'http';
    return `claude mcp add --transport ${transport} ${key} ${server.url}`;
  }
  const env = Object.keys(server.env ?? {})
    .map((e) => ` -e ${e}=<value>`)
    .join('');
  return `claude mcp add ${key}${env} -- ${server.command} ${(server.args ?? []).join(' ')}`;
}
