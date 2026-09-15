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
  GroupMembership
} from '../schemas/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const DATA_DIR = path.join(ROOT_DIR, 'src/data');
const DIST_V1_DIR = path.join(ROOT_DIR, 'dist/v1');
const EXPORT_DIR = path.join(DIST_V1_DIR, 'export');

console.log('--- Starting ThaiDoru Core Build Pipeline ---');

// 1. Load Raw JSON Data
const rawCompanies = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'companies.json'), 'utf-8'));
const rawGroups = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'groups.json'), 'utf-8'));
const rawMembers = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'members.json'), 'utf-8'));
const rawMemberships = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'memberships.json'), 'utf-8'));

// 2. Validate with Zod
console.log(' Validating schemas with Zod...');
const companies: Company[] = CompaniesSchema.parse(rawCompanies);
const groups: Group[] = GroupsSchema.parse(rawGroups);
const members: Member[] = MembersSchema.parse(rawMembers);
const memberships: GroupMembership[] = GroupMembershipsSchema.parse(rawMemberships);

// 3. Check Referential Integrity
console.log(' Checking referential integrity...');
const companyMap = new Map<string, Company>(companies.map(c => [c.id, c]));
const groupMap = new Map<string, Group>(groups.map(g => [g.id, g]));
const memberMap = new Map<string, Member>(members.map(m => [m.id, m]));

for (const g of groups) {
  if (!companyMap.has(g.company_id)) {
    throw new Error(`Referential integrity error: Group "${g.id}" references non-existent company "${g.company_id}"`);
  }
}

for (const m of memberships) {
  if (!groupMap.has(m.group_id)) {
    throw new Error(`Referential integrity error: Membership "${m.id}" references non-existent group "${m.group_id}"`);
  }
  if (!memberMap.has(m.member_id)) {
    throw new Error(`Referential integrity error: Membership "${m.id}" references non-existent member "${m.member_id}"`);
  }
}

// 4. Create Output Directories and Copy Assets
fs.mkdirSync(EXPORT_DIR, { recursive: true });

const SRC_ASSETS_DIR = path.join(ROOT_DIR, 'assets/avatars');
const DIST_ASSETS_DIR = path.join(DIST_V1_DIR, 'assets/avatars');
if (fs.existsSync(SRC_ASSETS_DIR)) {
  console.log(' Copying cached avatar assets to dist/v1/assets/avatars...');
  fs.mkdirSync(DIST_ASSETS_DIR, { recursive: true });
  fs.cpSync(SRC_ASSETS_DIR, DIST_ASSETS_DIR, { recursive: true });
}

// 5. Write Normalized JSONs to dist/v1
console.log(' Generating normalized endpoints...');
fs.writeFileSync(path.join(DIST_V1_DIR, 'companies.json'), JSON.stringify(companies, null, 2));
fs.writeFileSync(path.join(DIST_V1_DIR, 'groups.json'), JSON.stringify(groups, null, 2));
fs.writeFileSync(path.join(DIST_V1_DIR, 'members.json'), JSON.stringify(members, null, 2));
fs.writeFileSync(path.join(DIST_V1_DIR, 'memberships.json'), JSON.stringify(memberships, null, 2));

// 6. Build Denormalized "all.json" Bundle
console.log(' Generating combined "all.json" bundle...');
const cdnBase = process.env.CDN_BASE_URL || 'https://pavinss2.github.io/thaidoru-core';

const denormalizedGroups = groups.map(g => {
  const comp = companyMap.get(g.company_id);
  const grpMemberships = memberships.filter(ms => ms.group_id === g.id);
  const activeMembers = grpMemberships.map(ms => {
    const mem = memberMap.get(ms.member_id)!;
    const cachedUrl = mem.avatar_cached_path ? `${cdnBase}/${mem.avatar_cached_path}` : null;
    const xSns = mem.sns.find(s => s.platform === 'x');
    const fallbackUrl = xSns?.avatar_url || mem.sns.find(s => s.avatar_url)?.avatar_url || null;

    return {
      membership_id: ms.id,
      member_id: mem.id,
      stage_name: mem.stage_name,
      status: ms.status,
      is_active: ms.is_active,
      role: ms.role,
      color: ms.color,
      birthday: mem.birthday,
      avatar_url: cachedUrl || fallbackUrl,
      sns: mem.sns
    };
  });
  return {
    ...g,
    company: comp ? { id: comp.id, name: comp.name } : null,
    members: activeMembers
  };
});

const allBundle = {
  version: '1.0.0',
  generated_at: new Date().toISOString(),
  stats: {
    total_companies: companies.length,
    total_groups: groups.length,
    total_members: members.length,
    total_memberships: memberships.length
  },
  companies,
  groups: denormalizedGroups
};
fs.writeFileSync(path.join(DIST_V1_DIR, 'all.json'), JSON.stringify(allBundle, null, 2));

// 7. Build Cheki-Tracker Adapter (/v1/export/cheki-tracker.json)
console.log(' Generating Cheki Tracker export adapter...');
const dimCompanies = companies.map(c => ({ company: c.name }));

const dimGroups = groups.map(g => {
  const comp = companyMap.get(g.company_id);
  return {
    group: g.name,
    company: comp ? comp.name : 'Individual',
    country: g.country,
    is_active: g.status === 'active'
  };
});

const dimMembers = memberships.map(ms => {
  const grp = groupMap.get(ms.group_id)!;
  const comp = companyMap.get(grp.company_id);
  const mem = memberMap.get(ms.member_id)!;

  // Prefer permanently cached WebP avatar on CDN, fallback to scraped URL
  const cachedUrl = mem.avatar_cached_path ? `${cdnBase}/${mem.avatar_cached_path}` : '';
  const xSns = mem.sns.find(s => s.platform === 'x');
  const fallbackUrl = xSns?.avatar_url || mem.sns.find(s => s.avatar_url)?.avatar_url || '';
  const avatarUrl = cachedUrl || fallbackUrl;
  const xProfileUrl = xSns?.url || '';

  return {
    member_name: mem.stage_name,
    member_image: avatarUrl,
    color: ms.color.name,
    group: grp.name,
    country: grp.country,
    company: comp ? comp.name : 'Individual',
    start_date: ms.joined_date || (ms.is_active ? '1001-01-01' : '1001-01-01'),
    end_date: ms.graduated_date || (ms.is_active ? '9999-12-31' : '2026-01-10'),
    is_active: ms.is_active,
    x_profile: xProfileUrl,
    // Foreign keys for clean relational linking in Cheki Tracker
    _metadata: {
      canonical_member_id: mem.id,
      canonical_group_id: grp.id,
      canonical_membership_id: ms.id,
      color_hex: ms.color.hex,
      role: ms.role,
      status: ms.status,
      cached_avatar_url: cachedUrl || null,
      original_avatar_url: fallbackUrl || null
    }
  };
});

const chekiTrackerExport = {
  version: '1.0.0',
  updated_at: new Date().toISOString(),
  dim_company: dimCompanies,
  dim_group: dimGroups,
  dim_member: dimMembers
};
fs.writeFileSync(path.join(EXPORT_DIR, 'cheki-tracker.json'), JSON.stringify(chekiTrackerExport, null, 2));

console.log(' Build completed successfully!');
console.log(` Output artifacts in: ${DIST_V1_DIR}`);
console.log(`   - companies.json (${companies.length} records)`);
console.log(`   - groups.json (${groups.length} records)`);
console.log(`   - members.json (${members.length} records)`);
console.log(`   - memberships.json (${memberships.length} records)`);
console.log(`   - all.json (Consolidated bundle)`);
console.log(`   - export/cheki-tracker.json (${dimMembers.length} Cheki Tracker records)`);
