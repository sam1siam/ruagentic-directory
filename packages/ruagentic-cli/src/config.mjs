// Pure helpers: where each client keeps its MCP configuration and how a
// listing's published connection facts become an entry in it. No I/O here,
// so every branch is unit-tested from the directory's test suite.
import path from 'node:path';

export const CLIENTS = [
  'claude-code',
  'cursor',
  'claude-desktop',
  'codex',
  'windsurf',
];

/** The entry a client needs: a URL for a hosted server, or the command that
 *  runs a published package locally. Required variables become placeholders
 *  the person fills in; nothing is guessed. */
export function serverConfigFor(plan) {
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
  const env = Object.fromEntries(
    (plan.requiredEnv ?? []).map((e) => [e, '<value>']),
  );
  return Object.keys(env).length ? { ...run, env } : run;
}

/** Where a client reads its MCP configuration. `scope` is "project" for the
 *  current folder or "user" for the home directory where the client allows it. */
export function clientTarget(
  client,
  { platform, home, cwd, appData, scope = 'project' },
) {
  switch (client) {
    case 'claude-code':
      return { kind: 'command' };
    case 'cursor':
      return {
        kind: 'json',
        path:
          scope === 'user'
            ? path.join(home, '.cursor', 'mcp.json')
            : path.join(cwd, '.cursor', 'mcp.json'),
      };
    case 'windsurf':
      return {
        kind: 'json',
        path: path.join(home, '.codeium', 'windsurf', 'mcp_config.json'),
      };
    case 'claude-desktop':
      return {
        kind: 'json',
        path:
          platform === 'darwin'
            ? path.join(
                home,
                'Library',
                'Application Support',
                'Claude',
                'claude_desktop_config.json',
              )
            : platform === 'win32'
              ? path.join(
                  appData || path.join(home, 'AppData', 'Roaming'),
                  'Claude',
                  'claude_desktop_config.json',
                )
              : path.join(
                  home,
                  '.config',
                  'Claude',
                  'claude_desktop_config.json',
                ),
      };
    case 'codex':
      return { kind: 'toml', path: path.join(home, '.codex', 'config.toml') };
    default:
      return null;
  }
}

/** Adds or replaces `mcpServers[key]` in a JSON config, keeping everything else. */
export function mergeJsonConfig(text, key, server) {
  let data = {};
  if (text && text.trim()) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('The existing config is not valid JSON; fix it first.');
    }
    if (!data || typeof data !== 'object' || Array.isArray(data))
      throw new Error('The existing config is not a JSON object.');
  }
  const servers =
    data.mcpServers && typeof data.mcpServers === 'object'
      ? data.mcpServers
      : {};
  const replaced = key in servers;
  data.mcpServers = { ...servers, [key]: server };
  return { text: JSON.stringify(data, null, 2) + '\n', replaced };
}

const tomlString = (value) => JSON.stringify(String(value));
/** Codex keeps servers as `[mcp_servers.<key>]` tables in config.toml. The
 *  section (and its `.env` table) is replaced when it already exists. */
export function mergeTomlConfig(text, key, server) {
  const lines = [`[mcp_servers.${key}]`];
  if (server.url) lines.push(`url = ${tomlString(server.url)}`);
  if (server.command) {
    lines.push(`command = ${tomlString(server.command)}`);
    lines.push(`args = [${(server.args ?? []).map(tomlString).join(', ')}]`);
  }
  if (server.env && Object.keys(server.env).length) {
    lines.push('', `[mcp_servers.${key}.env]`);
    for (const [name, value] of Object.entries(server.env))
      lines.push(`${name} = ${tomlString(value)}`);
  }
  const block = lines.join('\n') + '\n';
  const existing = text ?? '';
  const header = new RegExp(
    `^\\[mcp_servers\\.${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\.[^\\]]+)?\\]\\s*$`,
  );
  const out = [];
  let skipping = false,
    replaced = false;
  for (const line of existing.split('\n')) {
    if (/^\s*\[/.test(line)) skipping = header.test(line.trim());
    if (skipping) {
      replaced = true;
      continue;
    }
    out.push(line);
  }
  let base = out.join('\n').replace(/\s+$/, '');
  if (base) base += '\n\n';
  return { text: base + block, replaced };
}

/** The `claude mcp add` command for Claude Code. */
export function claudeCodeCommand(key, server, remoteType) {
  if (server.url) {
    const transport = remoteType === 'sse' ? 'sse' : 'http';
    return `claude mcp add --transport ${transport} ${key} ${server.url}`;
  }
  const env = Object.keys(server.env ?? {})
    .map((e) => ` -e ${e}=<value>`)
    .join('');
  return `claude mcp add ${key}${env} -- ${server.command} ${(server.args ?? []).join(' ')}`;
}
