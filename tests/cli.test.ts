import test from 'node:test';
import assert from 'node:assert/strict';
import {
  claudeCodeCommand,
  clientTarget,
  mergeJsonConfig,
  mergeTomlConfig,
  serverConfigFor,
} from '../packages/ruagentic-cli/src/config.mjs';

const where = (target: ReturnType<typeof clientTarget>) =>
  target && 'path' in target ? target.path.split('\\').join('/') : null;

void test('A listing becomes a URL entry or the command that runs its package', () => {
  assert.deepEqual(
    serverConfigFor({
      remote: { url: 'https://api.example.com/mcp', type: 'streamable-http' },
      package: null,
      requiredEnv: [],
    }),
    { url: 'https://api.example.com/mcp' },
  );
  assert.deepEqual(
    serverConfigFor({
      remote: null,
      package: { registryType: 'npm', identifier: '@acme/mcp', version: '1.0' },
      requiredEnv: ['ACME_TOKEN'],
    }),
    {
      command: 'npx',
      args: ['-y', '@acme/mcp'],
      env: { ACME_TOKEN: '<value>' },
    },
  );
  assert.deepEqual(
    serverConfigFor({
      remote: null,
      package: {
        registryType: 'oci',
        identifier: 'ghcr.io/acme/mcp:1',
        version: '1',
      },
      requiredEnv: [],
    }),
    { command: 'docker', args: ['run', '-i', '--rm', 'ghcr.io/acme/mcp:1'] },
  );
  assert.equal(
    serverConfigFor({
      remote: null,
      package: { registryType: 'mystery', identifier: 'x', version: '1' },
      requiredEnv: [],
    }),
    null,
  );
  assert.equal(
    serverConfigFor({ remote: null, package: null, requiredEnv: [] }),
    null,
  );
});
void test('Each client has a known config location', () => {
  const env = { platform: 'linux', home: '/home/sam', cwd: '/work/app' };
  assert.deepEqual(clientTarget('claude-code', env), { kind: 'command' });
  assert.equal(
    where(clientTarget('cursor', env)),
    '/work/app/.cursor/mcp.json',
  );
  assert.equal(
    where(clientTarget('cursor', { ...env, scope: 'user' })),
    '/home/sam/.cursor/mcp.json',
  );
  assert.equal(
    where(clientTarget('claude-desktop', { ...env, platform: 'darwin' })),
    '/home/sam/Library/Application Support/Claude/claude_desktop_config.json',
  );
  assert.equal(
    where(
      clientTarget('claude-desktop', {
        ...env,
        platform: 'win32',
        appData: 'C:/Users/sam/AppData/Roaming',
      }),
    ),
    'C:/Users/sam/AppData/Roaming/Claude/claude_desktop_config.json',
  );
  assert.equal(
    where(clientTarget('codex', env)),
    '/home/sam/.codex/config.toml',
  );
  assert.equal(clientTarget('nope', env), null);
});
void test('JSON configs are merged, never clobbered', () => {
  const existing = JSON.stringify({
    theme: 'dark',
    mcpServers: { other: { url: 'https://o.example' } },
  });
  const merged = mergeJsonConfig(existing, 'acme', {
    url: 'https://a.example/mcp',
  });
  assert.equal(merged.replaced, false);
  assert.deepEqual(JSON.parse(merged.text), {
    theme: 'dark',
    mcpServers: {
      other: { url: 'https://o.example' },
      acme: { url: 'https://a.example/mcp' },
    },
  });
  const again = mergeJsonConfig(merged.text, 'acme', {
    url: 'https://b.example/mcp',
  });
  assert.equal(again.replaced, true);
  assert.equal(
    JSON.parse(again.text).mcpServers.acme.url,
    'https://b.example/mcp',
  );
  assert.deepEqual(JSON.parse(mergeJsonConfig('', 'acme', { url: 'u' }).text), {
    mcpServers: { acme: { url: 'u' } },
  });
  assert.throws(
    () => mergeJsonConfig('{not json', 'acme', { url: 'u' }),
    /not valid JSON/,
  );
});
void test('Codex TOML tables are added once and replaced in place', () => {
  const first = mergeTomlConfig(
    'model = "o3"\n\n[mcp_servers.other]\nurl = "https://o.example"\n',
    'acme',
    {
      command: 'npx',
      args: ['-y', '@acme/mcp'],
      env: { ACME_TOKEN: '<value>' },
    },
  );
  assert.equal(first.replaced, false);
  assert.equal(
    first.text,
    'model = "o3"\n\n[mcp_servers.other]\nurl = "https://o.example"\n\n[mcp_servers.acme]\ncommand = "npx"\nargs = ["-y", "@acme/mcp"]\n\n[mcp_servers.acme.env]\nACME_TOKEN = "<value>"\n',
  );
  const second = mergeTomlConfig(first.text, 'acme', {
    url: 'https://a.example/mcp',
  });
  assert.equal(second.replaced, true);
  assert.equal((second.text.match(/\[mcp_servers\.acme\]/g) ?? []).length, 1);
  assert.equal(second.text.includes('ACME_TOKEN'), false);
  assert.match(
    second.text,
    /\[mcp_servers\.other\]\nurl = "https:\/\/o\.example"/,
  );
});
void test('Claude Code gets the matching claude mcp add command', () => {
  assert.equal(
    claudeCodeCommand('acme', { url: 'https://a.example/mcp' }, 'sse'),
    'claude mcp add --transport sse acme https://a.example/mcp',
  );
  assert.equal(
    claudeCodeCommand('acme', {
      command: 'npx',
      args: ['-y', '@acme/mcp'],
      env: { ACME_TOKEN: '<value>' },
    }),
    'claude mcp add acme -e ACME_TOKEN=<value> -- npx -y @acme/mcp',
  );
});
