import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');

// Twitter Guest Token State
let twitterGuestToken: string | null = null;
const BEARER_TOKEN = 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';

async function getTwitterGuestToken(): Promise<string | null> {
  if (twitterGuestToken) return twitterGuestToken;
  try {
    const res = await fetch('https://api.twitter.com/1.1/guest/activate.json', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${BEARER_TOKEN}`,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Origin': 'https://x.com',
        'Referer': 'https://x.com/'
      }
    });
    if (res.ok) {
      const data = await res.json() as { guest_token?: string };
      twitterGuestToken = data.guest_token || null;
      return twitterGuestToken;
    }
  } catch (err) {
    console.error('Failed to get Twitter guest token:', err);
  }
  return null;
}

export async function resolveTwitterProfile(screenName: string): Promise<{ rest_id: string | null, avatar_url: string | null } | null> {
  const clean = screenName.replace(/^@/, '').trim();
  if (!clean) return null;
  const token = await getTwitterGuestToken();
  if (!token) return null;

  try {
    const url = `https://x.com/i/api/graphql/sLVLhk0bGj3MVFEKTdax1w/UserByScreenName?variables=${encodeURIComponent(JSON.stringify({ screen_name: clean }))}`;
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${BEARER_TOKEN}`,
        'x-guest-token': token,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Origin': 'https://x.com',
        'Referer': 'https://x.com/'
      }
    });

    if (res.ok) {
      const data = await res.json() as any;
      const user = data?.data?.user?.result;
      if (user && user.rest_id) {
        let avatar = user.legacy?.profile_image_url_https || null;
        if (avatar) {
          avatar = avatar.replace('_normal.', '_400x400.');
        }
        return {
          rest_id: user.rest_id,
          avatar_url: avatar
        };
      }
    }
  } catch (err) {
    // Non-fatal
  }
  return null;
}

export async function resolveFacebookProfileId(fbUrlOrHandle: string): Promise<string | null> {
  let clean = fbUrlOrHandle.trim();
  const idMatch = clean.match(/profile\.php\?id=(\d+)/);
  if (idMatch) return idMatch[1];
  const directNum = clean.match(/^(\d+)$/);
  if (directNum) return directNum[1];

  let url = clean.startsWith('http') ? clean : `https://www.facebook.com/${clean.replace(/^@/, '')}`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'
      },
      redirect: 'follow'
    });
    if (res.ok) {
      const html = await res.text();
      const match = html.match(/fb:\/\/(?:profile|page)\/(\d+)/);
      if (match) return match[1];
    }
  } catch (err) {
    // Non-fatal
  }
  return null;
}

async function main() {
  console.log('--- Starting Profile ID & Avatar URL Resolver ---');

  const companies = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'companies.json'), 'utf-8'));
  const groups = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'groups.json'), 'utf-8'));
  const members = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'members.json'), 'utf-8'));

  let twitterResolved = 0;
  let facebookResolved = 0;

  // 1. Resolve for Companies
  for (const c of companies) {
    for (const s of c.sns) {
      if (s.platform === 'x' && !s.profile_id) {
        const info = await resolveTwitterProfile(s.current_handle);
        if (info?.rest_id) {
          s.profile_id = info.rest_id;
          if (info.avatar_url) s.avatar_url = info.avatar_url;
          twitterResolved++;
          console.log(` Resolved X for Company ${c.name}: @${s.current_handle} -> rest_id: ${info.rest_id}`);
        }
      }
      if (s.platform === 'facebook' && !s.profile_id) {
        const id = await resolveFacebookProfileId(s.current_handle);
        if (id) {
          s.profile_id = id;
          facebookResolved++;
          console.log(` Resolved FB for Company ${c.name}: ${s.current_handle} -> page_id: ${id}`);
        }
      }
    }
  }

  // 2. Resolve for Groups
  for (const g of groups) {
    for (const s of g.sns) {
      if (s.platform === 'x') {
        const info = await resolveTwitterProfile(s.current_handle);
        if (info) {
          if (!s.profile_id && info.rest_id) {
            s.profile_id = info.rest_id;
            twitterResolved++;
          }
          if (info.avatar_url) s.avatar_url = info.avatar_url;
          console.log(` Resolved X for Group ${g.name}: @${s.current_handle} -> rest_id: ${info.rest_id}`);
        }
      }
      if (s.platform === 'facebook' && !s.profile_id) {
        const id = await resolveFacebookProfileId(s.current_handle);
        if (id) {
          s.profile_id = id;
          facebookResolved++;
          console.log(` Resolved FB for Group ${g.name}: ${s.current_handle} -> page_id: ${id}`);
        }
      }
    }
  }

  // 3. Resolve for Members
  console.log(`Resolving for ${members.length} members...`);
  for (let i = 0; i < members.length; i++) {
    const m = members[i];
    for (const s of m.sns) {
      if (s.platform === 'x') {
        const info = await resolveTwitterProfile(s.current_handle);
        if (info) {
          if (!s.profile_id && info.rest_id) {
            s.profile_id = info.rest_id;
            twitterResolved++;
          }
          if (info.avatar_url) s.avatar_url = info.avatar_url;
          console.log(`[${i + 1}/${members.length}]  X ${m.stage_name} (@${s.current_handle}) -> rest_id: ${info.rest_id}`);
        }
      }
      if (s.platform === 'facebook' && !s.profile_id) {
        const id = await resolveFacebookProfileId(s.current_handle);
        if (id) {
          s.profile_id = id;
          facebookResolved++;
          console.log(`[${i + 1}/${members.length}]  FB ${m.stage_name} -> page_id: ${id}`);
        }
      }
    }
    // Small stagger to respect rate limits
    await new Promise(r => setTimeout(r, 100));
  }

  fs.writeFileSync(path.join(DATA_DIR, 'companies.json'), JSON.stringify(companies, null, 2));
  fs.writeFileSync(path.join(DATA_DIR, 'groups.json'), JSON.stringify(groups, null, 2));
  fs.writeFileSync(path.join(DATA_DIR, 'members.json'), JSON.stringify(members, null, 2));

  console.log(' Finished resolving Profile IDs:');
  console.log(`   - Twitter rest_ids resolved: ${twitterResolved}`);
  console.log(`   - Facebook page_ids resolved: ${facebookResolved}`);
}

main().catch(console.error);
