/**
 * Look up an X (Twitter) account's current handle and avatar.
 *
 * Sources, tried in order:
 *
 *   1. Official X API v2 (needs the X_BEARER_TOKEN secret). Most reliable, and
 *      the only source that can look an account up by its profile ID, which is
 *      how we follow an idol who changed their @handle.
 *   2. FxTwitter public API (free, no secret, handle lookup only). Best effort:
 *      it is a third-party service and can be down or rate limited.
 *
 * Every result is checked against the stored profile ID when we have one, so a
 * recycled handle that now belongs to someone else is never accepted.
 */

export interface XAccount {
  id: string | null;
  handle: string;
  avatarUrl: string;
  source: string;
}

export interface XLookupInput {
  profileId?: string | null;
  handle?: string | null;
}

const TIMEOUT_MS = 15_000;

/** Ask X for the 400x400 version of an avatar URL (they serve _normal by default). */
export function toLargeAvatar(url: string): string {
  return url.replace(/_(normal|bigger|mini|reasonably_small|x96|200x200|400x400)(\.[a-zA-Z0-9]+)$/, '_400x400$2');
}

export function cleanHandle(h: string | null | undefined): string | null {
  if (!h) return null;
  const m = h.trim().match(/^(?:https?:\/\/(?:www\.)?(?:x|twitter)\.com\/)?@?([A-Za-z0-9_]{1,15})\/?$/);
  return m ? m[1] : null;
}

async function getJson(url: string, headers: Record<string, string>): Promise<{ status: number; body: any }> {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
  let body: any = null;
  try { body = await res.json(); } catch { /* not JSON */ }
  return { status: res.status, body };
}

// ---------- 1. Official X API v2 ----------
async function officialApi({ profileId, handle }: XLookupInput): Promise<XAccount | null> {
  const token = process.env.X_BEARER_TOKEN;
  if (!token) return null;
  const path = profileId ? `users/${profileId}` : handle ? `users/by/username/${handle}` : null;
  if (!path) return null;
  const { status, body } = await getJson(
    `https://api.x.com/2/${path}?user.fields=profile_image_url`,
    { Authorization: `Bearer ${token}` }
  );
  if (status === 401 || status === 403) throw new Error(`X API rejected X_BEARER_TOKEN (HTTP ${status})`);
  if (status === 402 || status === 429) throw new Error(`X API quota/credits problem (HTTP ${status})`);
  const u = body?.data;
  if (!u?.profile_image_url) return null;
  return { id: u.id, handle: u.username, avatarUrl: toLargeAvatar(u.profile_image_url), source: 'x-api-v2' };
}

// ---------- 2. FxTwitter ----------
async function fxTwitter({ handle }: XLookupInput): Promise<XAccount | null> {
  if (!handle) return null;
  const { body } = await getJson(`https://api.fxtwitter.com/${handle}`, { 'User-Agent': 'thaidoru-core-avatar-bot' });
  const u = body?.user;
  if (!u?.avatar_url || !u?.screen_name) return null;
  return { id: u.id ? String(u.id) : null, handle: u.screen_name, avatarUrl: toLargeAvatar(u.avatar_url), source: 'fxtwitter' };
}

const PROVIDERS = [officialApi, fxTwitter];

export interface XLookupResult {
  account: XAccount | null;
  notes: string[];
}

/**
 * Find the account's current handle + avatar. Tries a profile-ID lookup first
 * (survives handle changes), then the stored handle.
 */
export async function lookupXAccount(input: XLookupInput): Promise<XLookupResult> {
  const notes: string[] = [];
  const profileId = input.profileId || null;
  const handle = cleanHandle(input.handle);
  const attempts: XLookupInput[] = [];
  if (profileId) attempts.push({ profileId });
  if (handle) attempts.push({ handle });

  for (const attempt of attempts) {
    for (const provider of PROVIDERS) {
      try {
        const acc = await provider(attempt);
        if (!acc) continue;
        if (profileId && acc.id && acc.id !== profileId) {
          notes.push(`${acc.source}: @${acc.handle} now belongs to a different account (id ${acc.id}), ignored`);
          continue;
        }
        if (profileId && !acc.id) {
          notes.push(`${acc.source}: could not confirm profile ID for @${acc.handle}, ignored`);
          continue;
        }
        return { account: acc, notes };
      } catch (err: any) {
        notes.push(`${provider.name}: ${err.message}`);
      }
    }
  }
  return { account: null, notes };
}
