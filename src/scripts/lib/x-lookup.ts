/**
 * Look up an X (Twitter) account's current handle and avatar, for free.
 *
 * Source: the FxTwitter public API (api.fxtwitter.com), which needs no key.
 * It can only look accounts up by @handle, so if an idol changed their handle
 * we can't find the new one automatically. When we know the account's
 * profile ID, we check the result against it, so a recycled handle that now
 * belongs to someone else is never accepted.
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

// ---------- FxTwitter ----------
async function fxTwitter({ handle }: XLookupInput): Promise<XAccount | null> {
  if (!handle) return null;
  const { status, body } = await getJson(`https://api.fxtwitter.com/${handle}`, { 'User-Agent': 'thaidoru-core-avatar-bot' });
  if (status === 404) throw new Error(`@${handle} not found (handle changed, suspended or deleted?)`);
  if (status === 429 || status >= 500) throw new Error(`FxTwitter unavailable (HTTP ${status})`);
  const u = body?.user;
  if (!u?.avatar_url || !u?.screen_name) return null;
  return { id: u.id ? String(u.id) : null, handle: u.screen_name, avatarUrl: toLargeAvatar(u.avatar_url), source: 'fxtwitter' };
}

const PROVIDERS = [fxTwitter];

export interface XLookupResult {
  account: XAccount | null;
  notes: string[];
}

/** Find the account's current handle + avatar from the stored handle. */
export async function lookupXAccount(input: XLookupInput): Promise<XLookupResult> {
  const notes: string[] = [];
  const profileId = input.profileId || null;
  const handle = cleanHandle(input.handle);
  // Pass the profile ID along so a future ID-capable source can use it.
  const attempts: XLookupInput[] = handle ? [{ profileId, handle }] : [];
  if (!handle) notes.push('no X handle on record');

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
