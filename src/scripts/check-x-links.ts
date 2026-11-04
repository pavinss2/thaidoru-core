/**
 * Weekly X link check for the admin "X link check" panel on the site.
 *
 * Browsers can't check x.com links themselves (CORS), so this script does it
 * on GitHub Actions and writes the result to src/data/x-link-status.json.
 * The build copies that file to dist/v1/x-link-status.json and the site's
 * admin panel reads it.
 *
 * For every member with at least one *active* membership it checks:
 *   - profile: does the stored X handle still exist, and is it still the same
 *     account (same profile ID)? Uses the free FxTwitter API, no key needed.
 *   - avatar:  does the stored X avatar_url still load?
 *
 * Usage:
 *   npm run check:x-links
 *   npm run check:x-links -- --only=ame,yiwha
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '../..');
const DATA_DIR = path.join(ROOT_DIR, 'src/data');
const STATUS_FILE = path.join(DATA_DIR, 'x-link-status.json');

const ONLY = process.argv.slice(2).find(a => a.startsWith('--only='))?.slice('--only='.length).split(',').filter(Boolean);
const TIMEOUT_MS = 15_000;
const BROWSER_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

type ProfileState = 'ok' | 'missing' | 'bad_url' | 'not_found' | 'other_account' | 'unknown';
type AvatarState = 'ok' | 'missing' | 'broken' | 'unknown';

interface MemberLinkStatus {
  handle: string | null;
  profile: ProfileState;
  profile_detail?: string;
  avatar: AvatarState;
  avatar_url: string | null;
  avatar_detail?: string;
}

/** Pull a valid X handle out of a handle or a profile URL. */
function extractHandle(value: string | null | undefined): string | null {
  if (!value) return null;
  const m = value.trim().match(/^(?:https?:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/)?@?([A-Za-z0-9_]{1,15})\/?(?:[?#].*)?$/);
  return m ? m[1] : null;
}

async function checkProfile(handle: string, profileId: string | null): Promise<{ state: ProfileState; detail?: string }> {
  try {
    const res = await fetch(`https://api.fxtwitter.com/${handle}`, {
      headers: { 'User-Agent': 'thaidoru-core-link-check' },
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
    let body: any = null;
    try { body = await res.json(); } catch { /* not JSON */ }
    const code = typeof body?.code === 'number' ? body.code : res.status;
    if (code === 404) return { state: 'not_found', detail: `@${handle} not found (changed handle, suspended or deleted?)` };
    if (code === 429 || code >= 500) return { state: 'unknown', detail: `FxTwitter unavailable (HTTP ${code})` };
    const user = body?.user;
    if (!user?.screen_name) return { state: 'unknown', detail: `unexpected FxTwitter reply (HTTP ${res.status})` };
    if (profileId && user.id && String(user.id) !== profileId) {
      return { state: 'other_account', detail: `@${handle} now belongs to a different account (id ${user.id}, expected ${profileId})` };
    }
    return { state: 'ok' };
  } catch (err: any) {
    return { state: 'unknown', detail: err.message };
  }
}

async function checkAvatar(url: string): Promise<{ state: AvatarState; detail?: string }> {
  try {
    let res = await fetch(url, { method: 'HEAD', headers: { 'User-Agent': BROWSER_UA }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (res.status === 405) res = await fetch(url, { headers: { 'User-Agent': BROWSER_UA }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (res.status === 429 || res.status >= 500) return { state: 'unknown', detail: `HTTP ${res.status}` };
    if (!res.ok) return { state: 'broken', detail: `HTTP ${res.status}` };
    const type = res.headers.get('content-type') || '';
    if (type && !type.startsWith('image/')) return { state: 'broken', detail: `not an image (${type})` };
    return { state: 'ok' };
  } catch (err: any) {
    return { state: 'unknown', detail: err.message };
  }
}

async function main() {
  const members = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'members.json'), 'utf-8'));
  const memberships = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'memberships.json'), 'utf-8'));
  const activeIds = new Set<string>(memberships.filter((ms: any) => ms.status === 'active').map((ms: any) => ms.member_id));
  const targets = members.filter((m: any) => activeIds.has(m.id) && (!ONLY || ONLY.includes(m.id)));

  // With --only, keep everyone else's previous result.
  const previous = ONLY && fs.existsSync(STATUS_FILE) ? JSON.parse(fs.readFileSync(STATUS_FILE, 'utf-8')) : null;
  const results: Record<string, MemberLinkStatus> = ONLY ? { ...(previous?.members ?? {}) } : {};

  console.log(`Checking X links for ${targets.length} active members...`);
  for (const m of targets) {
    const x = m.sns?.find((s: any) => s.platform === 'x');
    const raw = x?.current_handle || x?.url || null;
    const handle = extractHandle(x?.current_handle) ?? extractHandle(x?.url);
    const row: MemberLinkStatus = { handle, profile: 'ok', avatar: 'ok', avatar_url: x?.avatar_url ?? null };

    if (!raw) {
      row.profile = 'missing';
      row.profile_detail = 'no X link on record';
    } else if (!handle) {
      row.profile = 'bad_url';
      row.profile_detail = `"${raw}" is not a valid X profile link`;
    } else {
      const p = await checkProfile(handle, x?.profile_id || null);
      row.profile = p.state;
      if (p.detail) row.profile_detail = p.detail;
      await new Promise(r => setTimeout(r, 300)); // be gentle with FxTwitter
    }

    if (!x?.avatar_url) {
      row.avatar = 'missing';
    } else {
      const a = await checkAvatar(x.avatar_url);
      row.avatar = a.state;
      if (a.detail) row.avatar_detail = a.detail;
    }

    if (row.profile !== 'ok' || row.avatar !== 'ok') {
      console.log(`  ${m.id}: profile=${row.profile} avatar=${row.avatar}${row.profile_detail ? ' — ' + row.profile_detail : ''}`);
    }
    results[m.id] = row;
  }

  const sorted = Object.fromEntries(Object.entries(results).sort(([a], [b]) => a.localeCompare(b)));
  const status = { checked_at: new Date().toISOString(), source: 'fxtwitter', members: sorted };
  fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2) + '\n');

  const rows = Object.values(sorted);
  const count = (f: (r: MemberLinkStatus) => boolean) => rows.filter(f).length;
  const summary = [
    `## X link check ${status.checked_at.slice(0, 10)}`,
    '',
    `Active members: **${rows.length}**`,
    `- Missing X link: ${count(r => r.profile === 'missing' || r.profile === 'bad_url')}`,
    `- X profile not reachable: ${count(r => r.profile === 'not_found' || r.profile === 'other_account')}`,
    `- Avatar missing or broken: ${count(r => r.avatar === 'missing' || r.avatar === 'broken')}`,
    `- Couldn't check (try again next week): ${count(r => r.profile === 'unknown' || r.avatar === 'unknown')}`
  ].join('\n');
  console.log('\n' + summary);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + '\n');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
