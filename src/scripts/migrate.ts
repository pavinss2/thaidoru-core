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
  'SkyBlue': '#87ceeb',
  'Navy': '#000080',
  'Cream': '#fdeadb',
  'N/A': '#7f8c8d'
};

const MONTH_MAP: Record<string, number> = {
  'january': 1, 'february': 2, 'march': 3, 'april': 4,
  'may': 5, 'june': 6, 'july': 7, 'august': 8,
  'september': 9, 'october': 10, 'november': 11, 'december': 12
};

function parseBirthday(bdayStr: string | null) {
  if (!bdayStr) {
    return { month: null, day: null, year: null };
  }
  const parts = bdayStr.trim().split(/\s+/);
  if (parts.length >= 2) {
    const month = MONTH_MAP[parts[0].toLowerCase()] || null;
    const day = parseInt(parts[1], 10) || null;
    return {
      month,
      day,
      year: null
    };
  }
  return { month: null, day: null, year: null };
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
    .replace(/[!:._\s✟]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// 1. Define Canonical Companies
const companies: Company[] = [
  {
    id: 'catsolute',
    name: 'Catsolute',
    country: 'Thailand',
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
    country: 'Thailand',
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
    country: 'Thailand',
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
    country: 'Thailand',
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
  name: 'ANGeVIL✟',
  status: 'active',
  country: 'Thailand',
  debut_date: '2024-07-12',
  theme_color: {
    name: 'Red',
    hex: '#e74c3c'
  },
  music_links: {},
  sns: [
    {
      platform: 'facebook',
      profile_id: '348301511700002',
      current_handle: 'angevil.official',
      url: 'https://www.facebook.com/348301511700002'
    },
    {
      platform: 'x',
      profile_id: null,
      current_handle: 'angevil_idol',
      url: 'https://x.com/angevil_idol'
    },
    {
      platform: 'instagram',
      profile_id: null,
      current_handle: 'angevil_idol',
      url: 'https://www.instagram.com/angevil_idol/'
    },
    {
      platform: 'tiktok',
      profile_id: null,
      current_handle: 'angevilofficial',
      url: 'https://www.tiktok.com/@angevilofficial'
    },
    {
      platform: 'youtube',
      profile_id: null,
      current_handle: 'angevil_idol',
      url: 'https://www.youtube.com/@angevil_idol'
    }
  ]
});

groups.push({
  id: 'castella',
  company_id: 'a-lot-of-tone',
  name: 'Castella',
  status: 'active',
  country: 'Thailand',
  debut_date: '2021-07-16',
  theme_color: {
    name: 'Yellow',
    hex: '#f1c40f'
  },
  music_links: {},
  sns: [
    {
      platform: 'facebook',
      profile_id: null,
      current_handle: 'Castella.idol',
      url: 'https://www.facebook.com/Castella.idol'
    },
    {
      platform: 'x',
      profile_id: null,
      current_handle: 'Castella_CMJ',
      url: 'https://x.com/Castella_CMJ'
    },
    {
      platform: 'instagram',
      profile_id: null,
      current_handle: 'castella.official',
      url: 'https://www.instagram.com/castella.official'
    },
    {
      platform: 'tiktok',
      profile_id: null,
      current_handle: 'castella.cmj',
      url: 'https://www.tiktok.com/@castella.cmj'
    }
  ]
});

groups.push({
  id: 'tgg',
  company_id: 'ic45',
  name: 'The Glass Girls',
  native_name: 'เดอะกลาสเกิร์ล',
  status: 'active',
  country: 'Thailand',
  debut_date: '2019-12-05',
  theme_color: {
    name: 'N/A',
    hex: '#7f8c8d'
  },
  music_links: {},
  sns: [
    {
      platform: 'facebook',
      profile_id: null,
      current_handle: 'Theglassgirlsband',
      url: 'https://www.facebook.com/Theglassgirlsband'
    },
    {
      platform: 'x',
      profile_id: null,
      current_handle: 'TheglassgirlsTH',
      url: 'https://x.com/TheglassgirlsTH'
    },
    {
      platform: 'instagram',
      profile_id: null,
      current_handle: 'theglassgirls.official',
      url: 'https://www.instagram.com/theglassgirls.official'
    },
    {
      platform: 'tiktok',
      profile_id: null,
      current_handle: 'theglassgirlsofficial',
      url: 'https://www.tiktok.com/@theglassgirlsofficial'
    },
    {
      platform: 'youtube',
      profile_id: null,
      current_handle: 'TheGlassGirlsOfficial',
      url: 'https://www.youtube.com/@TheGlassGirlsOfficial'
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
  graduated_date: '2026-01-10'
});

// Helper to add a member and membership
function registerMember(
  id: string,
  stageName: string,
  stageNameTh: string | null,
  xHandle: string,
  avatarUrl: string | null,
  groupId: string,
  colorName: string,
  colorHex: string,
  status: 'active' | 'graduated' | 'hiatus' = 'active',
  role: 'member' | 'leader' | 'sub-leader' = 'member',
  gradDate: string | null = null
) {
  if (!memberMap.has(id)) {
    const newMember: Member = {
      id,
      stage_name: stageName,
      stage_name_th: stageNameTh,
      real_name: {},
      birthday: { month: null, day: null, year: null },
      sns: [
        {
          platform: 'x',
          profile_id: null,
          current_handle: xHandle,
          url: `https://x.com/${xHandle}`,
          avatar_url: avatarUrl
        }
      ]
    };
    memberMap.set(id, newMember);
    members.push(newMember);
  }

  memberships.push({
    id: `${groupId}_${id}`,
    group_id: groupId,
    member_id: id,
    status,
    is_active: status === 'active',
    role,
    color: {
      name: colorName,
      hex: colorHex
    },
    joined_date: null,
    graduated_date: gradDate
  });
}

// 5. Add ANGeVIL Members
registerMember('icezu', 'Icezu', 'ไอซ์สึ', 'icezu_angevil', 'https://pbs.twimg.com/profile_images/2067238795553210369/Ddy6LTXL_400x400.jpg', 'angevil', 'Red', '#e74c3c');
registerMember('momo', 'Momo', 'โมโม่', 'Momo_Angevil', null, 'angevil', 'SkyBlue', '#87ceeb');
registerMember('hani', 'Hani', 'ฮานิ', 'Hani_Angevil', null, 'angevil', 'Purple', '#9b59b6');
registerMember('yogurt', 'Yogurt', 'โยเกิร์ต', 'Yogurt_Angevil', null, 'angevil', 'Pink', '#ff69b4');
registerMember('claire', 'Claire', 'แคลร์', 'Claire_Angevil', null, 'angevil', 'Orange', '#e67e22');
registerMember('bew', 'Bew', 'บิว', 'Bew_Angevil', null, 'angevil', 'Yellow', '#f1c40f');
registerMember('bebam', 'Bebam', 'บีแบม', 'Bebam_Angevil', null, 'angevil', 'Black', '#555555');
// Former ANGeVIL
registerMember('misaka', 'Misaka', 'มิซากะ', 'misakx_da_re', 'https://pbs.twimg.com/profile_images/2064349938235191296/ljkLSIW9_400x400.jpg', 'angevil', 'Pink', '#ff69b4', 'graduated', 'member', '2026-04-01');
registerMember('miu', 'Miu', 'มิอุ', 'MiuLUMINUS', 'https://pbs.twimg.com/profile_images/2090412968307757056/4RwTyfIm_400x400.jpg', 'angevil', 'White', '#ffffff', 'graduated', 'member', '2026-04-01');
registerMember('nene', 'Nene', 'เนเน่', 'NeneLUMINUS', 'https://pbs.twimg.com/profile_images/2090415283659997184/yKUvlNHt_400x400.jpg', 'angevil', 'Yellow', '#f1c40f', 'graduated', 'member', '2026-04-01');

// 6. Add Castella Members
registerMember('nadear', 'Nadear', 'นาเดีย', 'Nadear_CMJ', 'https://pbs.twimg.com/profile_images/2069787143346458624/WklSxpAH_400x400.jpg', 'castella', 'Red', '#ee0142');
registerMember('vasa', 'Vasa', 'วสา', 'Vasa_CMJ', null, 'castella', 'Yellow', '#f8e8ac');
registerMember('praeploy', 'Praeploy', 'แพรพลอย', 'Praeploy_CMJ', null, 'castella', 'Black', '#555555');
registerMember('airin', 'Airin', 'ไอริน', 'Airin_CMJ', null, 'castella', 'Blue', '#b6d5ee');
registerMember('asia-castella', 'Asia', 'เอเซีย', 'Asia_CMJ', null, 'castella', 'Pink', '#f3cdd6');
registerMember('khongkwan', 'Khongkwan', 'ของขวัญ', 'Khongkwan_CMJ', null, 'castella', 'Orange', '#fca26d');
registerMember('charmew', 'Charmew', 'ชาร์มิว', 'Charmew_CMJ', null, 'castella', 'White', '#ffffff');
registerMember('friend', 'Friend', 'เฟรนด์', 'Friend_CMJ', null, 'castella', 'Purple', '#dcdaf2');
registerMember('puifaii', 'Puifaii', 'ปุยฝ้าย', 'Puifaii_CMJ', null, 'castella', 'Navy', '#000080');

// 7. Add The Glass Girls (TGG) Members
registerMember('pim', 'Pim', 'พิม', 'pimgalet', 'https://pbs.twimg.com/profile_images/2072657220052090881/KO0B-fbi_400x400.jpg', 'tgg', 'N/A', '#7f8c8d');
registerMember('kaimook', 'Kaimook', 'ไข่มุก', 'kaimooktgg', null, 'tgg', 'N/A', '#7f8c8d', 'active', 'leader');
registerMember('mint', 'Mint', 'มิ้นต์', 'mint_tgg', null, 'tgg', 'N/A', '#7f8c8d', 'active', 'leader');
registerMember('ni', 'Ni', 'นิ', 'ni_tgg', null, 'tgg', 'N/A', '#7f8c8d');
registerMember('pam', 'Pam', 'แพม', 'pam_tgg', null, 'tgg', 'N/A', '#7f8c8d');
registerMember('maple', 'Maple', 'เมเปิ้ล', 'maple_tgg', null, 'tgg', 'N/A', '#7f8c8d');
registerMember('front', 'Front', 'ฟร้อนท์', 'front_tgg', null, 'tgg', 'N/A', '#7f8c8d');
registerMember('asia-tgg', 'Asia', 'เอเชียร์', 'asia_tgg', null, 'tgg', 'N/A', '#7f8c8d');
registerMember('preammy', 'Preammy', 'พรีมมี่', 'preammy_tgg', null, 'tgg', 'N/A', '#7f8c8d');

// 8. Validate All Data Against Zod Schemas
console.log('Validating parsed data against Zod schemas...');
const validCompanies = CompaniesSchema.parse(companies);
const validGroups = GroupsSchema.parse(groups);
const validMembers = MembersSchema.parse(members);
const validMemberships = GroupMembershipsSchema.parse(memberships);

// 9. Check Referential Integrity
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

// 10. Write to src/data/
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
