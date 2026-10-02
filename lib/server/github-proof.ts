import 'server-only';
import { adminClient } from '../supabase/server';
import { githubMembershipUrl, githubRepoOwner } from '../duplicates';

/** The GitHub login of an account that signed in with GitHub, or null. */
export async function githubLoginFor(userId: string): Promise<string | null> {
  try {
    const { data } = await adminClient().auth.admin.getUserById(userId);
    const user = data.user;
    if (!user) return null;
    const identity = user.identities?.find((i) => i.provider === 'github');
    const fromIdentity = identity?.identity_data as
      | { user_name?: string; preferred_username?: string }
      | undefined;
    const login =
      fromIdentity?.user_name ||
      fromIdentity?.preferred_username ||
      (user.app_metadata?.provider === 'github'
        ? (user.user_metadata as { user_name?: string })?.user_name
        : undefined);
    return typeof login === 'string' && /^[A-Za-z0-9-]{1,39}$/.test(login)
      ? login
      : null;
  } catch {
    return null;
  }
}
/** Whether a GitHub login controls a repository: it is the owner, or a
 *  public member of the organisation that owns it. Public data only; any
 *  failure counts as no proof. */
export async function controlsRepository(
  login: string,
  repositoryUrl: string | undefined,
): Promise<boolean> {
  const repo = githubRepoOwner(repositoryUrl);
  if (!repo) return false;
  if (repo.owner === login.toLowerCase()) return true;
  try {
    const res = await fetch(githubMembershipUrl(repo.owner, login), {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'RUAGENTIC-Directory/1.0 (+https://ruagentic.com/about)',
        ...(process.env.GITHUB_TOKEN
          ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
          : {}),
      },
      signal: AbortSignal.timeout(8000),
    });
    return res.status === 204;
  } catch {
    return false;
  }
}
