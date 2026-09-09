/** Builds the "How to connect" guide for a listing from stored facts only.
 *  Every answer is derived from fields the publisher or registry supplied;
 *  when a field is empty the guide says so instead of guessing. Pure so it
 *  can be unit tested. */
import type { PublicListing } from './listing';

export type Remote = {
  type?: string;
  url?: string;
  headers?: { name: string; description?: string; isRequired?: boolean }[];
};
export type Package = {
  registryType?: string;
  identifier?: string;
  version?: string;
  transport?: { type?: string };
  environmentVariables?: {
    name: string;
    description?: string;
    isRequired?: boolean;
  }[];
};
export type Snippet = {
  label: string;
  language: 'bash' | 'json';
  code: string;
};
export type ConnectPlan = {
  /** Short identifier used as the server name in client configs. */
  key: string;
  remote: { url: string; type: string } | null;
  pkg: { registryType: string; identifier: string; version: string } | null;
  transportAnswer: string;
  authAnswer: string;
  pricingAnswer: string;
  snippets: Snippet[];
  requiredHeaders: string[];
  requiredEnv: string[];
};
const AUTH: Record<string, string> = {
  none: 'No credentials are required, according to the published details.',
  'api-key': 'An API key issued by the publisher is required.',
  oauth: 'You sign in with the publisher through OAuth.',
  account: 'An account with the publisher is required.',
  other: 'The publisher documents its own access method.',
  unknown: 'Not specified by the publisher. Check the documentation.',
  'not-applicable': 'Not applicable.',
};
const PRICING: Record<string, string> = {
  free: 'Free to use, according to the published details.',
  'open-source': 'Open source; free to run yourself.',
  freemium: 'Free tier with paid plans.',
  paid: 'Paid.',
  contact: 'Pricing on request from the publisher.',
  unknown: 'Not specified by the publisher. Check the documentation.',
};
export const keyFor = (name: string) =>
  name
    .toLowerCase()
    .replace(/\bmcp\b|\bserver\b/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'server';
const json = (value: unknown) => JSON.stringify(value, null, 2);
function packageCommand(pkg: { registryType: string; identifier: string }) {
  switch (pkg.registryType) {
    case 'npm':
      return { command: 'npx', args: ['-y', pkg.identifier] };
    case 'pypi':
      return { command: 'uvx', args: [pkg.identifier] };
    case 'oci':
      return { command: 'docker', args: ['run', '-i', '--rm', pkg.identifier] };
    case 'nuget':
      return { command: 'dnx', args: [pkg.identifier, '--yes'] };
    default:
      return null;
  }
}
export function connectPlan(
  item: Pick<
    PublicListing,
    | 'kind'
    | 'name'
    | 'endpoint'
    | 'transport'
    | 'authentication'
    | 'pricing'
    | 'remotes'
    | 'packages'
  >,
): ConnectPlan {
  const key = keyFor(item.name);
  const remotes = ((item.remotes ?? []) as Remote[]).filter((r) => r.url);
  const packages = ((item.packages ?? []) as Package[]).filter(
    (p) => p.identifier && p.registryType,
  );
  const first =
    remotes.find((r) => r.type === 'streamable-http') ?? remotes[0] ?? null;
  const remote = first
    ? { url: first.url!, type: first.type ?? item.transport }
    : item.endpoint
      ? {
          url: item.endpoint,
          type:
            item.transport === 'sse' || item.transport === 'streamable-http'
              ? item.transport
              : 'streamable-http',
        }
      : null;
  const pkg = packages[0]
    ? {
        registryType: packages[0].registryType!,
        identifier: packages[0].identifier!,
        version: packages[0].version ?? '',
      }
    : null;
  const requiredHeaders = remotes.flatMap((r) =>
    (r.headers ?? []).filter((h) => h.isRequired !== false).map((h) => h.name),
  );
  const requiredEnv = packages.flatMap((p) =>
    (p.environmentVariables ?? [])
      .filter((e) => e.isRequired !== false)
      .map((e) => e.name),
  );
  const snippets: Snippet[] = [];
  if (remote) {
    const transport = remote.type === 'sse' ? 'sse' : 'http';
    snippets.push({
      label: 'Claude Code',
      language: 'bash',
      code: `claude mcp add --transport ${transport} ${key} ${remote.url}`,
    });
    snippets.push({
      label: 'Cursor, Windsurf and other clients that accept a URL (mcp.json)',
      language: 'json',
      code: json({ mcpServers: { [key]: { url: remote.url } } }),
    });
    snippets.push({
      label:
        'Claude Desktop (claude_desktop_config.json, via the mcp-remote bridge)',
      language: 'json',
      code: json({
        mcpServers: {
          [key]: { command: 'npx', args: ['-y', 'mcp-remote', remote.url] },
        },
      }),
    });
  } else if (pkg) {
    const run = packageCommand(pkg);
    if (run) {
      const env =
        requiredEnv.length > 0
          ? Object.fromEntries(requiredEnv.map((e) => [e, '<value>']))
          : undefined;
      snippets.push({
        label: 'Claude Code',
        language: 'bash',
        code:
          `claude mcp add ${key}` +
          (requiredEnv.length
            ? ' ' + requiredEnv.map((e) => `-e ${e}=<value>`).join(' ')
            : '') +
          ` -- ${run.command} ${run.args.join(' ')}`,
      });
      snippets.push({
        label: 'Cursor, Claude Desktop and other clients (JSON config)',
        language: 'json',
        code: json({
          mcpServers: {
            [key]: {
              command: run.command,
              args: run.args,
              ...(env ? { env } : {}),
            },
          },
        }),
      });
    }
  }
  const transportAnswer = remote
    ? `Hosted remote server over ${remote.type === 'sse' ? 'SSE' : 'Streamable HTTP'} at ${remote.url}.`
    : pkg
      ? `Runs locally from the ${pkg.registryType} package ${pkg.identifier}${pkg.version ? ' (version ' + pkg.version + ')' : ''}${item.transport && item.transport !== 'unknown' ? ' over ' + item.transport : ''}.`
      : item.kind === 'server'
        ? 'The publisher has not listed a hosted endpoint or a package. Check the documentation for how it is run.'
        : '';
  return {
    key,
    remote,
    pkg,
    transportAnswer,
    authAnswer: AUTH[item.authentication] ?? AUTH.unknown,
    pricingAnswer: PRICING[item.pricing] ?? PRICING.unknown,
    snippets,
    requiredHeaders,
    requiredEnv,
  };
}
