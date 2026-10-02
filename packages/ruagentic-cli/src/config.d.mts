export type ConnectPlan = {
  slug: string;
  name: string;
  kind: string;
  key: string;
  remote: { url: string; type: string } | null;
  package: { registryType: string; identifier: string; version: string } | null;
  requiredEnv: string[];
  requiredHeaders: string[];
};
export type ServerConfig = {
  url?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
};
export const CLIENTS: string[];
export function serverConfigFor(
  plan: Partial<ConnectPlan>,
): ServerConfig | null;
export function clientTarget(
  client: string,
  env: {
    platform: string;
    home: string;
    cwd: string;
    appData?: string;
    scope?: 'project' | 'user';
  },
): { kind: 'command' } | { kind: 'json' | 'toml'; path: string } | null;
export function mergeJsonConfig(
  text: string | null | undefined,
  key: string,
  server: ServerConfig,
): { text: string; replaced: boolean };
export function mergeTomlConfig(
  text: string | null | undefined,
  key: string,
  server: ServerConfig,
): { text: string; replaced: boolean };
export function claudeCodeCommand(
  key: string,
  server: ServerConfig,
  remoteType?: string,
): string;
