/**
 * Weekly X avatar refresh.
 *
 * For every member with at least one *active* membership:
 *   1. Check their X avatar_url. If it still loads, leave them alone.
 *   2. If it is dead (4xx) or empty, look the account up again (by profile ID
 *      first, so a changed @handle is followed), then
 *   3. save the new avatar_url (and new handle if it changed), and
 *   4. regenerate assets/avatars/{id}.webp. The old webp is moved to
 *      assets/avatars/history/{id}/{date}.webp and listed in avatar_history,
 *      so the site can show older avatars.
 *
 * Usage:
 *   npm run refresh:avatars                 # real run
 *   npm run refresh:avatars -- --dry-run    # report only, write nothing
 *   npm run refresh:avatars -- --only=ame,yiwha
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

  const targets = members.filter((m: any) => activeIds.has(m.id) && (!ONLY || ONLY.includes(m.id)));
  console.log(`Checking X avatars for ${targets.length} active members${DRY_RUN ? ' (dry run)' : ''}...`);
  if (!process.env.X_BEARER_TOKEN) {
    console.log('  Note: X_BEARER_TOKEN not set, so handle changes can only be followed via the stored handle.');
  }

  for (const m of targets) {
    const x = m.sns?.find((s: any) => s.platform === 'x');
    if (!x || (!x.profile_id && !x.current_handle)) {
      rows.push({ member: m.id, result: 'skipped', detail: 'no X account on record' });
      continue;
    }

    const cachedRel: string | null = m.avatar_cached_path && m.avatar_cached_path !== DEFAULT_AVATAR ? m.avatar_cached_path : null;
    const cachedAbs = cachedRel ? path.join(ROOT_DIR, cachedRel) : null;
    const hasCachedFile = Boolean(cachedAbs && fs.existsSync(cachedAbs));

    // Step 1-2: is the current URL fine?
    if (x.avatar_url) {
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

    // Step 3: find the current avatar
    const { account, notes } = await lookupXAccount({ profileId: x.profile_id, handle: x.current_handle });
    if (!account) {
      rows.push({ member: m.id, result: 'failed', detail: `could not look up @${x.current_handle ?? '?'}${notes.length ? ' — ' + notes.join('; ') : ''}` });
      continue;
    }

    const webp = await fetchAsWebp(account.avatarUrl);
    if (!webp) {
      // Leave the record untouched so next week's run tries again.
      rows.push({ member: m.id, result: 'failed', detail: `found ${account.avatarUrl} but could not download it` });
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
    `## X avatar refresh ${TODAY}${DRY_RUN ? ' (dry run)' : ''}`,
    '',
    `Checked **${targets.length}** active members: ${fine} fine, ${count('updated')} updated, ${count('failed')} failed, ${count('unsure')} unsure, ${count('skipped')} skipped.`,
    '',
    ...(rows.length ? ['| Member | Result | Detail |', '|---|---|---|', ...rows.map(r => `| ${r.member} | ${r.result} | ${r.detail.replace(/\|/g, '\\|')} |`)] : [])
  ].join('\n');
  console.log('\n' + summary);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + '\n');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
