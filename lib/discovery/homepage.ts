import { load } from 'cheerio';
import { apiJson, readPage } from './http.ts';
import {
  companyDomain,
  publicUrl,
  repositoryKey,
  type Candidate,
} from './policy.ts';
import { object } from './contracts.ts';

/** Finds the project's own website when the source gave only a registry
 *  entry, a package or a repository: the registry's websiteUrl, the npm
 *  package's homepage, the GitHub repository's homepage field, or an
 *  endpoint origin whose title names the project. Never guesses. */
export async function resolveHomepage(
  item: Candidate,
  deadline: number,
): Promise<Candidate> {
  if (companyDomain(item.homepage)) return item;
  // A GitHub search result already carries the repository's own homepage.
  if (item.source === 'github') return item;
  if (item.registryUrl) {
    const u = new URL(item.registryUrl);
    if (
      u.hostname === 'registry.modelcontextprotocol.io' &&
      u.pathname.startsWith('/servers/')
    ) {
      const id = decodeURIComponent(u.pathname.slice('/servers/'.length));
      const result = JSON.parse(
        (
          await readPage(
            `https://registry.modelcontextprotocol.io/v0.1/servers/${encodeURIComponent(id)}/versions/latest`,
            deadline,
            false,
          )
        ).text,
      );
      const server = result.server;
      if (server)
        item = {
          ...item,
          homepage: publicUrl(server.websiteUrl),
          repository: item.repository || publicUrl(server.repository?.url),
        };
    }
  }
  if (item.npmPackage && !item.repository && !companyDomain(item.homepage)) {
    const result = JSON.parse(
      (
        await readPage(
          `https://registry.npmjs.org/${encodeURIComponent(item.npmPackage)}/latest`,
          deadline,
          false,
        )
      ).text,
    );
    const repo =
      typeof result.repository === 'string'
        ? result.repository
        : result.repository?.url;
    item = {
      ...item,
      homepage: publicUrl(result.homepage),
      repository: publicUrl(repo?.replace(/^git\+/, '')),
    };
  }
  if (companyDomain(item.homepage)) return item;
  const repo = repositoryKey(item.repository);
  if (repo?.startsWith('github.com/')) {
    const path = repo.slice('github.com/'.length);
    const metadata = await apiJson(
      'https://api.github.com/repos/' + path,
      {
        headers: process.env.GITHUB_TOKEN
          ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
          : {},
      },
      deadline,
    );
    const homepage = publicUrl(object(metadata).homepage);
    if (homepage && companyDomain(homepage)) return { ...item, homepage };
  }
  if (companyDomain(item.endpoint)) {
    const origin = new URL(item.endpoint!).origin;
    try {
      const page = await readPage(origin, deadline, true, 500_000),
        $ = load(page.text);
      const identity = $('title,h1')
          .text()
          .toLowerCase()
          .replace(/[^a-z0-9]/g, ''),
        name = item.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (name.length >= 4 && identity.includes(name))
        return { ...item, homepage: origin };
    } catch {
      /* Unproven endpoint ownership stays out of contact enrichment. */
    }
  }
  return item;
}
