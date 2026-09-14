import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  CompaniesSchema,
  GroupsSchema,
  MembersSchema,
  GroupMembershipsSchema,
  Company,
  Group,
  Member,
  GroupMembership,
  SNSChannel
} from '../schemas/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');

// Color mapping to Hex
const COLOR_HEX_MAP: Record<string, string> = {
  'Red': '#e74c3c',
  'Yellow': '#f1c40f',
  'Purple': '#9b59b6',
  'White': '#ffffff',
  'Orange': '#e67e22',
  'Blue': '#3498db',
  'Pink': '#ff69b4',
  'Green': '#27ae60',
  'Black': '#555555',
  'N/A': '#7f8c8d'
};

const MONTH_MAP: Record<string, number> = {
  'january': 1, 'february': 2, 'march': 3, 'april': 4,
  'may': 5, 'june': 6, 'july': 7, 'august': 8,
  'september': 9, 'october': 10, 'november': 11, 'december': 12
};

function parseBirthday(bdayStr: string | null) {
  if (!bdayStr) {
    return { month: null, day: null, year: null, raw_text: null };
  }
  const parts = bdayStr.trim().split(/\s+/);
  if (parts.length >= 2) {
    const month = MONTH_MAP[parts[0].toLowerCase()] || null;
    const day = parseInt(parts[1], 10) || null;
    return {
      month,
      day,
      year: null,
      raw_text: bdayStr
    };
  }
  return { month: null, day: null, year: null, raw_text: bdayStr };
}

function extractFacebookProfileId(fbStr: string | null): string | null {
  if (!fbStr) return null;
  const match = fbStr.match(/profile\.php\?id=(\d+)/);
  if (match) return match[1];
  const numMatch = fbStr.match(/^(\d+)$/);
  if (numMatch) return numMatch[1];
  return null;
}

function cleanHandle(handle: string | null): string {
  if (!handle) return '';
  return handle.replace(/^@/, '').trim();
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[!:._\s]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// 1. Define Canonical Companies
const companies: Company[] = [
  {
    id: 'catsolute',
    name: 'Catsolute',
    country: '🇹🇭 TH',
    status: 'active',
    sns: [
      {
        platform: 'facebook',
        profile_id: '100064875932821',
        current_handle: 'catsolute',
        url: 'https://www.facebook.com/catsolute'
      },
      {
        platform: 'x',
        profile_id: '1465241088492810240',
        current_handle: 'Catsolute',
        url: 'https://x.com/Catsolute'
      }
    ]
  },
  {
    id: 'a-lot-of-tone',
    name: 'A lot of Tone',
    country: '🇹🇭 TH',
    status: 'active',
    sns: [
      {
        platform: 'facebook',
        profile_id: null,
        current_handle: 'alotoftone',
        url: 'https://www.facebook.com/alotoftone'
      }
    ]
  },
  {
    id: 'ic45',
    name: 'IC45',
    country: '🇹🇭 TH',
    status: 'active',
    sns: [
      {
        platform: 'facebook',
        profile_id: null,
        current_handle: 'IC45Entertainment',
        url: 'https://www.facebook.com/IC45Entertainment'
      }
    ]
  }
];

// 2. Read Catsolute scraped json
const rawCatsolutePath = '/Users/pavin/.gemini/antigravity/brain/0e6751c1-4d52-46b8-abce-43678048c453/.system_generated/steps/5/content.md';
const rawContent = fs.readFileSync(rawCatsolutePath, 'utf-8');
const rawItems = JSON.parse(rawContent.substring(rawContent.indexOf('[')));

const rawGroups = rawItems.filter((it: any) => it.type === 'group');
const rawMembers = rawItems.filter((it: any) => it.type === 'member');

// 3. Define Groups
const groups: Group[] = [];
for (const rg of rawGroups) {
  const gId = slugify(rg.group);
  const colorName = rg.color || 'Blue';
  const groupSns: SNSChannel[] = [];

  if (rg.x_handle) {
    groupSns.push({
      platform: 'x',
      profile_id: null,
      current_handle: cleanHandle(rg.x_handle),
      url: `https://x.com/${cleanHandle(rg.x_handle)}`,
      avatar_url: rg.x_avatar_url || null
    });
  }
  if (rg.facebook_page) {
    const fbId = extractFacebookProfileId(rg.facebook_page);
    groupSns.push({
      platform: 'facebook',
      profile_id: fbId,
      current_handle: cleanHandle(rg.facebook_page),
      url: fbId ? `https://www.facebook.com/profile.php?id=${fbId}` : `https://www.facebook.com/${cleanHandle(rg.facebook_page)}`
    });
  }
  if (rg.instagram_handle) {
    groupSns.push({
      platform: 'instagram',
      profile_id: null,
      current_handle: cleanHandle(rg.instagram_handle),
      url: `https://www.instagram.com/${cleanHandle(rg.instagram_handle)}`
    });
  }
  if (rg.tiktok_handle) {
    groupSns.push({
      platform: 'tiktok',
      profile_id: null,
      current_handle: cleanHandle(rg.tiktok_handle),
      url: `https://www.tiktok.com/@${cleanHandle(rg.tiktok_handle)}`
    });
  }

  const musicLinks: Record<string, string> = {};
  if (rg.spotify_handle) {
    musicLinks.spotify = rg.spotify_handle;
  }

  groups.push({
    id: gId,
    company_id: 'catsolute',
    name: rg.name,
    status: 'active',
    country: '🇹🇭 TH',
    debut_date: rg.debut_date || null,
    theme_color: {
      name: colorName,
      hex: COLOR_HEX_MAP[colorName] || '#3498db'
    },
    music_links: musicLinks,
    sns: groupSns
  });
}

// Add A lot of Tone and IC45 Groups
groups.push({
  id: 'angevil',
  company_id: 'a-lot-of-tone',
  name: 'Angevil',
  status: 'active',
  country: '🇹🇭 TH',
  debut_date: null,
  theme_color: {
    name: 'Red',
    hex: '#e74c3c'
  },
  music_links: {},
  sns: [
    {
      platform: 'facebook',
      profile_id: null,
      current_handle: 'angevil.official',
      url: 'https://www.facebook.com/angevil.official'
    }
  ]
});

groups.push({
  id: 'castella',
  company_id: 'a-lot-of-tone',
  name: 'Castella',
  status: 'active',
  country: '🇹🇭 TH',
  debut_date: null,
  theme_color: {
    name: 'Yellow',
    hex: '#f1c40f'
  },
  music_links: {},
  sns: [
    {
      platform: 'facebook',
      profile_id: null,
      current_handle: 'castella.official',
      url: 'https://www.facebook.com/castella.official'
    }
  ]
});

groups.push({
  id: 'tgg',
  company_id: 'ic45',
  name: 'TGG',
  status: 'active',
  country: '🇹🇭 TH',
  debut_date: null,
  theme_color: {
    name: 'N/A',
    hex: '#7f8c8d'
  },
  music_links: {},
  sns: [
    {
      platform: 'facebook',
      profile_id: null,
      current_handle: 'tgg.idol',
      url: 'https://www.facebook.com/tgg.idol'
    }
  ]
});

// 4. Define Members and Memberships
const members: Member[] = [];
const memberships: GroupMembership[] = [];

// Track member ID map to prevent duplicates
const memberMap = new Map<string, Member>();

for (const rm of rawMembers) {
  const mId = slugify(rm.name);
  const gId = slugify(rm.group);
  const colorName = rm.color || 'N/A';
  const colorHex = COLOR_HEX_MAP[colorName] || '#7f8c8d';

  const memberSns: SNSChannel[] = [];
  if (rm.x_handle) {
    memberSns.push({
      platform: 'x',
      profile_id: null,
      current_handle: cleanHandle(rm.x_handle),
      url: `https://x.com/${cleanHandle(rm.x_handle)}`,
      avatar_url: rm.x_avatar_url || null
    });
  }
  if (rm.facebook_page) {
    const fbId = extractFacebookProfileId(rm.facebook_page);
    memberSns.push({
      platform: 'facebook',
      profile_id: fbId,
      current_handle: cleanHandle(rm.facebook_page),
      url: fbId ? `https://www.facebook.com/profile.php?id=${fbId}` : `https://www.facebook.com/${cleanHandle(rm.facebook_page)}`
    });
  }
  if (rm.instagram_handle) {
    memberSns.push({
      platform: 'instagram',
      profile_id: null,
      current_handle: cleanHandle(rm.instagram_handle),
      url: `https://www.instagram.com/${cleanHandle(rm.instagram_handle)}`
    });
  }
  if (rm.tiktok_handle) {
    memberSns.push({
      platform: 'tiktok',
      profile_id: null,
      current_handle: cleanHandle(rm.tiktok_handle),
      url: `https://www.tiktok.com/@${cleanHandle(rm.tiktok_handle)}`
    });
  }

  if (!memberMap.has(mId)) {
    const newMember: Member = {
      id: mId,
      stage_name: rm.name,
      real_name: {},
      birthday: parseBirthday(rm.birthday),
      sns: memberSns
    };
    memberMap.set(mId, newMember);
    members.push(newMember);
  }

  // Add Group Membership
  memberships.push({
    id: `${gId}_${mId}`,
    group_id: gId,
    member_id: mId,
    status: 'active',
    is_active: true,
    role: 'member',
    color: {
      name: colorName,
      hex: colorHex
    },
    joined_date: null,
    graduated_date: null
  });
}

// Handle Yiwha historical membership in Sora! Sora!
// Yiwha graduated from Sora Sora on 2026-01-10 with Black color, then joined Nox:0ff with White color!
memberships.push({
  id: 'sora-sora_yiwha',
  group_id: 'sora-sora',
  member_id: 'yiwha',
  status: 'graduated',
  is_active: false,
  role: 'member',
  color: {
    name: 'Black',
    hex: COLOR_HEX_MAP['Black']
  },
  joined_date: '2021-11-23',
  graduated_date: '2026-01-10',
  graduated_reason: 'Graduation / Transfer to Nox:0ff'
});

// Add Angevil Members
const angevilMembers = [
  { name: 'Ice', color: 'Red', x_profile: 'icezu_angevil', avatar: 'https://pbs.twimg.com/profile_images/2067238795553210369/Ddy6LTXL_400x400.jpg' },
  { name: 'Misaka', color: 'Pink', x_profile: 'misakx_da_re', avatar: 'https://pbs.twimg.com/profile_images/2064349938235191296/ljkLSIW9_400x400.jpg' },
  { name: 'Miu', color: 'White', x_profile: 'MiuLUMINUS', avatar: 'https://pbs.twimg.com/profile_images/2090412968307757056/4RwTyfIm_400x400.jpg' },
  { name: 'Nene', color: 'Yellow', x_profile: 'NeneLUMINUS', avatar: 'https://pbs.twimg.com/profile_images/2090415283659997184/yKUvlNHt_400x400.jpg' }
];

for (const am of angevilMembers) {
  const mId = slugify(am.name);
  if (!memberMap.has(mId)) {
    const newMember: Member = {
      id: mId,
      stage_name: am.name,
      real_name: {},
      birthday: { month: null, day: null, year: null, raw_text: null },
      sns: [
        {
          platform: 'x',
          profile_id: null,
          current_handle: am.x_profile,
          url: `https://x.com/${am.x_profile}`,
          avatar_url: am.avatar
        }
      ]
    };
    memberMap.set(mId, newMember);
    members.push(newMember);
  }
  memberships.push({
    id: `angevil_${mId}`,
    group_id: 'angevil',
    member_id: mId,
    status: 'active',
    is_active: true,
    role: 'member',
    color: {
      name: am.color,
      hex: COLOR_HEX_MAP[am.color] || '#7f8c8d'
    },
    joined_date: null,
    graduated_date: null
  });
}

// Add Castella Member (Nadear)
const nadearMember: Member = {
  id: 'nadear',
  stage_name: 'Nadear',
  real_name: {},
  birthday: { month: null, day: null, year: null, raw_text: null },
  sns: [
    {
      platform: 'x',
      profile_id: null,
      current_handle: 'Nadear_CMJ',
      url: 'https://x.com/Nadear_CMJ',
      avatar_url: 'https://pbs.twimg.com/profile_images/2069787143346458624/WklSxpAH_400x400.jpg'
    }
  ]
};
memberMap.set('nadear', nadearMember);
members.push(nadearMember);

memberships.push({
  id: 'castella_nadear',
  group_id: 'castella',
  member_id: 'nadear',
  status: 'active',
  is_active: true,
  role: 'member',
  color: {
    name: 'Red',
    hex: COLOR_HEX_MAP['Red']
  },
  joined_date: null,
  graduated_date: null
});

// Add TGG Member (Pim)
const pimMember: Member = {
  id: 'pim',
  stage_name: 'Pim',
  real_name: {},
  birthday: { month: null, day: null, year: null, raw_text: null },
  sns: [
    {
      platform: 'x',
      profile_id: null,
      current_handle: 'pimgalet',
      url: 'https://x.com/pimgalet',
      avatar_url: 'https://pbs.twimg.com/profile_images/2072657220052090881/KO0B-fbi_400x400.jpg'
    }
  ]
};
memberMap.set('pim', pimMember);
members.push(pimMember);

memberships.push({
  id: 'tgg_pim',
  group_id: 'tgg',
  member_id: 'pim',
  status: 'active',
  is_active: true,
  role: 'member',
  color: {
    name: 'N/A',
    hex: COLOR_HEX_MAP['N/A']
  },
  joined_date: null,
  graduated_date: null
});

// 5. Validate All Data Against Zod Schemas
console.log('Validating parsed data against Zod schemas...');
const validCompanies = CompaniesSchema.parse(companies);
const validGroups = GroupsSchema.parse(groups);
const validMembers = MembersSchema.parse(members);
const validMemberships = GroupMembershipsSchema.parse(memberships);

// 6. Check Referential Integrity
console.log('Checking referential integrity...');
const companyIds = new Set(validCompanies.map(c => c.id));
const groupIds = new Set(validGroups.map(g => g.id));
const memberIds = new Set(validMembers.map(m => m.id));

for (const g of validGroups) {
  if (!companyIds.has(g.company_id)) {
    throw new Error(`Referential integrity error: Group ${g.id} references non-existent company ${g.company_id}`);
  }
}

for (const m of validMemberships) {
  if (!groupIds.has(m.group_id)) {
    throw new Error(`Referential integrity error: Membership ${m.id} references non-existent group ${m.group_id}`);
  }
  if (!memberIds.has(m.member_id)) {
    throw new Error(`Referential integrity error: Membership ${m.id} references non-existent member ${m.member_id}`);
  }
}

// 7. Write to src/data/
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.writeFileSync(path.join(DATA_DIR, 'companies.json'), JSON.stringify(validCompanies, null, 2));
fs.writeFileSync(path.join(DATA_DIR, 'groups.json'), JSON.stringify(validGroups, null, 2));
fs.writeFileSync(path.join(DATA_DIR, 'members.json'), JSON.stringify(validMembers, null, 2));
fs.writeFileSync(path.join(DATA_DIR, 'memberships.json'), JSON.stringify(validMemberships, null, 2));

console.log(` Migration successful!`);
console.log(` Companies: ${validCompanies.length}`);
console.log(` Groups: ${validGroups.length}`);
console.log(` Members: ${validMembers.length}`);
console.log(` Memberships: ${validMemberships.length}`);
