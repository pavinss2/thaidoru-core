/**
 * Weekly X avatar refresh.
 *
 * For every member with at least one *active* membership:
 *   1. Check their X avatar_url. If it still loads, leave them alone.
 *   2. If it is dead (4xx) or empty, look the account up again by @handle
 *      (free FxTwitter API, result checked against the stored profile ID), then
 *   3. save the new avatar_url (and new handle if it changed), and
 *   4. regenerate assets/avatars/{id}.webp. The old webp is moved to
 *      assets/avatars/history/{id}/{date}.webp and listed in avatar_history,
 *      so the site can show older avatars.
 *
 * Members the bot can't fix (e.g. the idol changed their @handle) are listed in
 * the file named by NEEDS_ATTENTION_FILE, which the workflow turns into an issue.
 *
 * Usage:
 *   npm run refresh:avatars                 # real run
 *   npm run refresh:avatars -- --dry-run    # report only, write nothing
 *   npm run refresh:avatars -- --only=ame,yiwha
 *
 * WebP-only mode (no X lookups at all): build each member's webp straight from
 * the avatar_url already saved, for members that have no webp file yet.
 * Covers every member with an X avatar URL, graduated ones included.
 *   npm run refresh:avatars -- --webp-only           # only missing webps
 *   npm run refresh:avatars -- --webp-only --force   # rebuild them all
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { BROWSER_UA, fetchAsWebp, looksSame } from './lib/avatar-image.js';
import { lookupXAccount } from './lib/x-lookup.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '../..');
const DATA_DIR = path.join(ROOT_DIR, 'src/data');
const MEMBERS_FILE = path.join(DATA_DIR, 'members.json');
const MEMBERSHIPS_FILE = path.join(DATA_DIR, 'memberships.json');
const DEFAULT_AVATAR = 'assets/avatars/default_avatar.webp';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const WEBP_ONLY = args.includes('--webp-only');
const FORCE = args.includes('--force');
const ONLY = args.find(a => a.startsWith('--only='))?.slice('--only='.length).split(',').filter(Boolean);
const TODAY = new Date().toISOString().slice(0, 10);

type UrlState = 'alive' | 'dead' | 'unknown';

/** Is the stored avatar URL still serving an image? */
async function checkAvatarUrl(url: string): Promise<{ state: UrlState; detail: string }> {
  try {
    let res = await fetch(url, { method: 'HEAD', headers: { 'User-Agent': BROWSER_UA }, signal: AbortSignal.timeout(15_000) });
    if (res.status === 405) {
      res = await fetch(url, { headers: { 'User-Agent': BROWSER_UA }, signal: AbortSignal.timeout(15_000) });
    }
    if (res.ok) {
      const type = res.headers.get('content-type') || '';
      return type.startsWith('image/') || !type
        ? { state: 'alive', detail: `HTTP ${res.status}` }
        : { state: 'dead', detail: `HTTP ${res.status} but content-type ${type}` };
    }
    // 429 = rate limited, 5xx = X having a bad day: don't treat as "changed".
    if (res.status === 429 || res.status >= 500) return { state: 'unknown', detail: `HTTP ${res.status}` };
    return { state: 'dead', detail: `HTTP ${res.status}` };
  } catch (err: any) {
    return { state: 'unknown', detail: err.message };
  }
}

function historyPathFor(memberId: string): string {
  let rel = `assets/avatars/history/${memberId}/${TODAY}.webp`;
  for (let n = 2; fs.existsSync(path.join(ROOT_DIR, rel)); n++) {
    rel = `assets/avatars/history/${memberId}/${TODAY}-${n}.webp`;
  }
  return rel;
}

interface Row { member: string; result: string; detail: string }

async function main() {
  const members = JSON.parse(fs.readFileSync(MEMBERS_FILE, 'utf-8'));
  const memberships = JSON.parse(fs.readFileSync(MEMBERSHIPS_FILE, 'utf-8'));
  const activeIds = new Set<string>(memberships.filter((ms: any) => ms.status === 'active').map((ms: any) => ms.member_id));

  const rows: Row[] = [];
  let changed = false;

  const targets = members.filter((m: any) => (WEBP_ONLY || activeIds.has(m.id)) && (!ONLY || ONLY.includes(m.id)));
  console.log(WEBP_ONLY
    ? `Building ${FORCE ? 'all' : 'missing'} webps from saved X avatar URLs for ${targets.length} members${DRY_RUN ? ' (dry run)' : ''}...`
    : `Checking X avatars for ${targets.length} active members${DRY_RUN ? ' (dry run)' : ''}...`);

  for (const m of targets) {
    const x = m.sns?.find((s: any) => s.platform === 'x');
    if (WEBP_ONLY ? !x?.avatar_url : (!x || (!x.profile_id && !x.current_handle))) {
      if (WEBP_ONLY && !ONLY) continue; // nothing to build from; not worth a row
      rows.push({ member: m.id, result: 'skipped', detail: WEBP_ONLY ? 'no X avatar URL saved' : 'no X account on record' });
      continue;
    }

    const cachedRel: string | null = m.avatar_cached_path && m.avatar_cached_path !== DEFAULT_AVATAR ? m.avatar_cached_path : null;
    const cachedAbs = cachedRel ? path.join(ROOT_DIR, cachedRel) : null;
    const hasCachedFile = Boolean(cachedAbs && fs.existsSync(cachedAbs));
    if (WEBP_ONLY && hasCachedFile && !FORCE) continue; // already has a webp

    // Step 1-2: is the current URL fine? (skipped in webp-only mode)
    if (WEBP_ONLY) {
      // use the saved URL as-is
    } else if (x.avatar_url) {
      const check = await checkAvatarUrl(x.avatar_url);
      if (check.state === 'alive' && hasCachedFile) continue; // all good, ignore this record
      if (check.state === 'unknown') {
        rows.push({ member: m.id, result: 'unsure', detail: `could not check avatar URL (${check.detail}), will retry next week` });
        continue;
      }
      console.log(`  ${m.id}: avatar URL ${check.state === 'dead' ? 'is dead' : 'is fine but webp is missing'} (${check.detail})`);
    } else {
      console.log(`  ${m.id}: avatar URL is empty`);
    }

    // Step 3: find the current avatar (webp-only mode just uses the saved URL)
    const { account, notes } = WEBP_ONLY
      ? { account: { id: x.profile_id ?? null, handle: x.current_handle, avatarUrl: x.avatar_url, source: 'saved avatar URL' }, notes: [] as string[] }
      : await lookupXAccount({ profileId: x.profile_id, handle: x.current_handle });
    if (!account) {
      rows.push({ member: m.id, result: 'failed', detail: `could not look up @${x.current_handle ?? '?'}${notes.length ? ' — ' + notes.join('; ') : ''}` });
      continue;
    }

    const webp = await fetchAsWebp(account.avatarUrl);
    if (!webp) {
      // Leave the record untouched so next week's run tries again.
      rows.push({ member: m.id, result: 'failed', detail: `${WEBP_ONLY ? 'saved URL' : 'found'} ${account.avatarUrl} but could not download it` });
      continue;
    }

    const changes: string[] = [];
    const oldHandle = x.current_handle;
    if (account.handle && account.handle !== oldHandle) {
      changes.push(`handle @${oldHandle} → @${account.handle}`);
    }
    if (account.id && !x.profile_id) changes.push(`profile ID filled (${account.id})`);

    // Step 4: archive the old webp if the picture really changed, then write the new one.
    const finalRel = cachedRel ?? `assets/avatars/${m.id}.webp`;
    const finalAbs = path.join(ROOT_DIR, finalRel);
    let archivedRel: string | null = null;
    const sameAsCached = hasCachedFile && (await looksSame(webp, cachedAbs!));
    if (hasCachedFile && !sameAsCached) archivedRel = historyPathFor(m.id);
    if (!sameAsCached) changes.push(archivedRel ? `new avatar (old one kept in ${archivedRel})` : 'new avatar');
    else changes.push('URL refreshed, picture unchanged');

    if (!DRY_RUN) {
      if (archivedRel) {
        fs.mkdirSync(path.dirname(path.join(ROOT_DIR, archivedRel)), { recursive: true });
        fs.renameSync(cachedAbs!, path.join(ROOT_DIR, archivedRel));
        m.avatar_history = [
          { path: archivedRel, source_url: x.avatar_url ?? null, archived_at: TODAY },
          ...(m.avatar_history ?? [])
        ];
      }
      if (!sameAsCached) fs.writeFileSync(finalAbs, webp);
      m.avatar_cached_path = finalRel;
      x.avatar_url = account.avatarUrl;
      if (account.handle) {
        x.current_handle = account.handle;
        x.url = `https://x.com/${account.handle}`;
      }
      if (account.id && !x.profile_id) x.profile_id = account.id;
      changed = true;
    }
    rows.push({ member: m.id, result: 'updated', detail: `${changes.join(', ')} [via ${account.source}]` });
    await new Promise(r => setTimeout(r, 300)); // be gentle
  }

  if (changed) fs.writeFileSync(MEMBERS_FILE, JSON.stringify(members, null, 2) + '\n');

  // Report
  const count = (r: string) => rows.filter(x => x.result === r).length;
  const fine = targets.length - rows.length;
  const summary = [
    `## ${WEBP_ONLY ? 'Build avatar webps from saved URLs' : 'X avatar refresh'} ${TODAY}${DRY_RUN ? ' (dry run)' : ''}`,
    '',
    `Checked **${targets.length}** ${WEBP_ONLY ? '' : 'active '}members: ${fine} ${WEBP_ONLY ? 'already had a webp or no URL' : 'fine'}, ${count('updated')} updated, ${count('failed')} failed, ${count('unsure')} unsure, ${count('skipped')} skipped.`,
    '',
    ...(rows.length ? ['| Member | Result | Detail |', '|---|---|---|', ...rows.map(r => `| ${r.member} | ${r.result} | ${r.detail.replace(/\|/g, '\\|')} |`)] : [])
  ].join('\n');
  console.log('\n' + summary);
  const failed = rows.filter(r => r.result === 'failed');
  if (process.env.NEEDS_ATTENTION_FILE && failed.length && !DRY_RUN && !WEBP_ONLY) {
    const byId = new Map(members.map((m: any) => [m.id, m]));
    fs.writeFileSync(process.env.NEEDS_ATTENTION_FILE, [
      `The weekly avatar refresh (${TODAY}) couldn't update these idols automatically.`,
      'Most likely they changed their X @handle. Find their new handle on X (the profile ID below never changes),',
      'then update it on the site or in src/data/members.json. The next run will pick up the new avatar.',
      '',
      '| Member | Stored handle | Profile ID | Problem |',
      '|---|---|---|---|',
      ...failed.map(r => {
        const x = (byId.get(r.member) as any)?.sns?.find((s: any) => s.platform === 'x') ?? {};
        return `| ${r.member} | @${x.current_handle ?? '?'} | ${x.profile_id ?? '—'} | ${r.detail.replace(/\|/g, '\\|')} |`;
      })
    ].join('\n') + '\n');
  }
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + '\n');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
