import { cleanUrl, emptyListing, type ListingInput } from '../listing';
import { readPublic } from './public-reader';
const plain = (s: string) =>
  s
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
function meta(html: string, name: string) {
  for (const tag of html.match(/<meta\b[^>]{0,4000}>/gi) ?? []) {
    const attrs = Object.fromEntries(
      [...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map((m) => [
        m[1].toLowerCase(),
        m[2] ?? m[3],
      ]),
    );
    if (attrs.name === name || attrs.property === name)
      return plain(attrs.content ?? '');
  }
  return '';
}
export async function importProject(
  value: string,
  kind: ListingInput['kind'],
  sourceType: 'homepage' | 'repository' | 'endpoint',
) {
  const url = new URL(cleanUrl(value));
  const listing = { ...emptyListing, kind, homepage: url.href };
  if (sourceType === 'endpoint')
    return {
      listing: { ...listing, homepage: '', endpoint: url.href },
      notice:
        'Endpoint saved. Add the project homepage and describe its capabilities. The importer does not invoke remote tools.',
    };
  if (url.hostname === 'github.com') {
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length !== 2 || !parts.every((p) => /^[\w.-]+$/.test(p)))
      throw new Error(
        'Enter the repository root, such as https://github.com/owner/repository.',
      );
    const result = await readPublic(
      'https://api.github.com/repos/' + parts.join('/'),
    );
    if (result.status !== 200)
      throw new Error(
        'The public repository could not be read. Check its URL or enter the details manually.',
      );
    const data = JSON.parse(result.text);
    if (data.private) throw new Error('Use a public repository.');
    let homepage = url.href;
    try {
      if (data.homepage) homepage = cleanUrl(data.homepage);
    } catch {}
    return {
      listing: {
        ...listing,
        name: String(data.name ?? '').slice(0, 100),
        homepage,
        repository: url.href,
        summary: String(data.description ?? '').slice(0, 240),
        description: String(data.description ?? '').slice(0, 6000),
        tags: (data.topics ?? [])
          .filter((t: unknown) => typeof t === 'string')
          .slice(0, 8)
          .map((t: string) => t.slice(0, 30)),
        license: String(data.license?.spdx_id ?? '').replace('NOASSERTION', ''),
      },
      notice:
        'Repository details imported. Review the copy and add connection instructions; imports are not a capability or ownership verification.',
    };
  }
  const result = await readPublic(url.href);
  if (result.status < 200 || result.status >= 300)
    throw new Error(
      'This page could not be read. Enter the details manually or use another public URL.',
    );
  const name = (
    meta(result.text, 'og:site_name') ||
    meta(result.text, 'og:title') ||
    plain(result.text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '')
  ).slice(0, 100);
  const summary = (
    meta(result.text, 'description') || meta(result.text, 'og:description')
  ).slice(0, 240);
  return {
    listing: { ...listing, name, summary, description: summary },
    notice:
      'Page title and description imported. Confirm the details and add the capabilities your project actually supports.',
  };
}
