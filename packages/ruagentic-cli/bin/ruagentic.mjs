#!/usr/bin/env node
// ruagentic: add an MCP server from the RUAGENTIC directory to your client.
// Reads the listing's published connection facts from the public API, shows
// exactly what it will write, asks, then writes. Nothing is installed or run.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline/promises';
import { spawnSync } from 'node:child_process';
import {
  CLIENTS,
  claudeCodeCommand,
  clientTarget,
  mergeJsonConfig,
  mergeTomlConfig,
  serverConfigFor,
} from '../src/config.mjs';

const API = (process.env.RUAGENTIC_API || 'https://ruagentic.com').replace(
  /\/$/,
  '',
);
const VERSION = '0.1.0';
const HELP = `ruagentic ${VERSION}

  ruagentic add <slug> [--client <name>] [--user] [--yes] [--dry-run] [--no-ping]
      Add a listed MCP server to a client. Clients: ${CLIENTS.join(', ')}.
      --user writes the client's user-level config instead of the project one.
  ruagentic search <words>        Search the directory.
  ruagentic show <slug>           Show a listing's connection facts.

Listings: https://ruagentic.com   API: ${API}/api/v1/listings
`;

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const flagValue = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const positional = args.filter(
  (a, i) => !a.startsWith('--') && args[i - 1] !== '--client',
);
const [command, ...rest] = positional;

async function getJson(url) {
  const res = await fetch(url, {
    headers: {
      accept: 'application/json',
      'user-agent': 'ruagentic-cli/' + VERSION,
    },
  });
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return res.json();
}
async function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}
const fail = (message) => {
  console.error('ruagentic: ' + message);
  process.exit(1);
};

async function search(words) {
  const q = words.join(' ');
  if (!q) fail('give me something to search for');
  const data = await getJson(
    `${API}/api/v1/listings?limit=12&q=${encodeURIComponent(q)}`,
  );
  if (!data.listings.length) return console.log('No matches.');
  for (const l of data.listings)
    console.log(
      `${l.slug.padEnd(32)} ${l.kind.padEnd(8)} ${l.name} — ${l.summary}`,
    );
  console.log(`\n${data.total} total. Add one with: ruagentic add <slug>`);
}
async function show(slug) {
  if (!slug) fail('which listing? ruagentic show <slug>');
  const plan = await getJson(
    `${API}/api/v1/listings/${encodeURIComponent(slug)}/connect`,
  );
  console.log(JSON.stringify(plan, null, 2));
}
async function add(slug) {
  if (!slug) fail('which listing? ruagentic add <slug>');
  const plan = await getJson(
    `${API}/api/v1/listings/${encodeURIComponent(slug)}/connect`,
  );
  if (plan.kind !== 'server')
    fail(
      `${plan.name} is ${plan.kind === 'product' ? 'an AI agent' : 'a ' + plan.kind}, not an MCP server; see ${plan.url}`,
    );
  const server = serverConfigFor(plan);
  if (!server)
    fail(
      `${plan.name} has no published endpoint or package to add automatically. Its README covers the setup: ${plan.repository || plan.documentation || plan.homepage}`,
    );
  let client = flagValue('--client');
  if (!client) {
    console.log(`Add ${plan.name} to which client?`);
    CLIENTS.forEach((c, i) => console.log(`  ${i + 1}. ${c}`));
    const pick = Number(await ask('> '));
    client = CLIENTS[pick - 1];
  }
  if (!CLIENTS.includes(client))
    fail(`unknown client "${client}". Use one of: ${CLIENTS.join(', ')}`);
  const target = clientTarget(client, {
    platform: process.platform,
    home: os.homedir(),
    cwd: process.cwd(),
    appData: process.env.APPDATA,
    scope: flags.has('--user') ? 'user' : 'project',
  });
  const dry = flags.has('--dry-run');
  const note = plan.requiredEnv?.length
    ? `\nFill in: ${plan.requiredEnv.join(', ')} (the publisher documents where to get them).`
    : plan.requiredHeaders?.length
      ? `\nThe server expects the header(s) ${plan.requiredHeaders.join(', ')}; add the credential the publisher documents.`
      : '';
  if (target.kind === 'command') {
    const cmd = claudeCodeCommand(plan.key, server, plan.remote?.type);
    console.log(`\n${cmd}${note}`);
    if (dry) return;
    if (
      !flags.has('--yes') &&
      !/^y(es)?$/i.test(await ask('Run it now? [y/N] '))
    )
      return;
    const run = spawnSync(cmd, { shell: true, stdio: 'inherit' });
    if (run.status !== 0)
      fail(
        'claude mcp add did not finish; is Claude Code installed and on your PATH?',
      );
  } else {
    const existing = fs.existsSync(target.path)
      ? fs.readFileSync(target.path, 'utf8')
      : '';
    const merged =
      target.kind === 'json'
        ? mergeJsonConfig(existing, plan.key, server)
        : mergeTomlConfig(existing, plan.key, server);
    console.log(
      `\n${merged.replaced ? 'Replacing' : 'Adding'} "${plan.key}" in ${target.path}:\n`,
    );
    console.log(JSON.stringify(server, null, 2) + note);
    if (dry) return;
    if (!flags.has('--yes') && !/^y(es)?$/i.test(await ask('Write it? [y/N] ')))
      return;
    fs.mkdirSync(path.dirname(target.path), { recursive: true });
    fs.writeFileSync(target.path, merged.text);
    console.log(`Done. Restart ${client} to load it.`);
  }
  if (!flags.has('--no-ping'))
    fetch(`${API}/api/v1/installs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug: plan.slug, client }),
    }).catch(() => {});
  console.log(`Listing: ${plan.url}`);
}

try {
  if (!command || flags.has('--help') || command === 'help') console.log(HELP);
  else if (flags.has('--version')) console.log(VERSION);
  else if (command === 'add') await add(rest[0]);
  else if (command === 'search') await search(rest);
  else if (command === 'show') await show(rest[0]);
  else fail(`unknown command "${command}". Try: ruagentic --help`);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
