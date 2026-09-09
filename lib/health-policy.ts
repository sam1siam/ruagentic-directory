/** Turns raw check results into a status and a list of issues. Pure so it
 *  can be unit tested; the network work lives in lib/server/health.ts. */
export type LinkResult = { url: string; status: number };
export type RepoResult = {
  found: boolean;
  archived?: boolean;
  pushedAt?: string | null;
  renamedTo?: string | null;
};
export type RegistryResult = {
  name: string;
  found: boolean;
  version?: string | null;
};
export type Issue = { code: string; detail: string };
export type Health = { status: 'ok' | 'warn' | 'broken'; issues: Issue[] };
export const STALE_DAYS = 540;
/** 403 and 429 mean a bot wall, not a dead page; 405/406/401 on an MCP
 *  endpoint mean it exists but wants a session or POST. */
const dead = (status: number) =>
  status === 0 || status === 404 || status === 410 || status >= 500;
export function classify(input: {
  links: Partial<
    Record<'homepage' | 'documentation' | 'repository' | 'endpoint', LinkResult>
  >;
  repo?: RepoResult | null;
  registry?: RegistryResult | null;
  knownVersion?: string;
  now?: number;
}): Health {
  const issues: Issue[] = [];
  let broken = false;
  const { homepage, documentation, repository, endpoint } = input.links;
  if (homepage && dead(homepage.status)) {
    issues.push({
      code: 'homepage',
      detail: `Homepage answered ${homepage.status || 'no response'}: ${homepage.url}`,
    });
    broken = true;
  }
  if (repository && dead(repository.status)) {
    issues.push({
      code: 'repository',
      detail: `Repository answered ${repository.status || 'no response'}: ${repository.url}`,
    });
    broken = true;
  }
  if (documentation && dead(documentation.status))
    issues.push({
      code: 'documentation',
      detail: `Documentation answered ${documentation.status || 'no response'}: ${documentation.url}`,
    });
  if (endpoint && dead(endpoint.status))
    issues.push({
      code: 'endpoint',
      detail: `MCP endpoint answered ${endpoint.status || 'no response'}: ${endpoint.url}`,
    });
  if (input.repo) {
    if (!input.repo.found) {
      issues.push({
        code: 'repo-missing',
        detail: 'Repository no longer exists on GitHub.',
      });
      broken = true;
    } else {
      if (input.repo.archived)
        issues.push({
          code: 'repo-archived',
          detail: 'Repository is archived.',
        });
      if (input.repo.renamedTo)
        issues.push({
          code: 'repo-renamed',
          detail: 'Repository moved to ' + input.repo.renamedTo,
        });
      if (input.repo.pushedAt) {
        const age =
          ((input.now ?? Date.now()) - Date.parse(input.repo.pushedAt)) /
          86400000;
        if (age > STALE_DAYS)
          issues.push({
            code: 'repo-stale',
            detail: `No commits for ${Math.round(age)} days.`,
          });
      }
    }
  }
  if (input.registry) {
    if (!input.registry.found)
      issues.push({
        code: 'registry-missing',
        detail: `Registry record ${input.registry.name} is gone.`,
      });
    else if (
      input.knownVersion &&
      input.registry.version &&
      input.registry.version !== input.knownVersion
    )
      issues.push({
        code: 'registry-updated',
        detail: `Registry version is ${input.registry.version}; listing shows ${input.knownVersion}.`,
      });
  }
  return { status: broken ? 'broken' : issues.length ? 'warn' : 'ok', issues };
}
