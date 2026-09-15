import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  CompaniesSchema,
  GroupsSchema,
  MembersSchema,
  GroupMembershipsSchema
} from '../schemas/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const DATA_DIR = path.join(ROOT_DIR, 'src/data');

console.log(' Running Automated Validation Suite...');

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  PASS: ${msg}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${msg}`);
    failed++;
  }
}

try {
  const companies = CompaniesSchema.parse(JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'companies.json'), 'utf-8')));
  const groups = GroupsSchema.parse(JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'groups.json'), 'utf-8')));
  const members = MembersSchema.parse(JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'members.json'), 'utf-8')));
  const memberships = GroupMembershipsSchema.parse(JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'memberships.json'), 'utf-8')));

  // Test 1: Schema validation
  assert(companies.length >= 3, `Companies count (${companies.length}) >= 3`);
  assert(groups.length >= 8, `Groups count (${groups.length}) >= 8`);
  assert(members.length >= 40, `Members count (${members.length}) >= 40`);
  assert(memberships.length >= members.length, `Memberships count (${memberships.length}) >= members count (${members.length})`);

  // Test 2: Uniqueness of IDs
  const companyIds = new Set(companies.map(c => c.id));
  assert(companyIds.size === companies.length, 'All company IDs are unique');

  const groupIds = new Set(groups.map(g => g.id));
  assert(groupIds.size === groups.length, 'All group IDs are unique');

  const memberIds = new Set(members.map(m => m.id));
  assert(memberIds.size === members.length, 'All member IDs are unique');

  const membershipIds = new Set(memberships.map(ms => ms.id));
  assert(membershipIds.size === memberships.length, 'All membership IDs are unique');

  // Test 3: Referential integrity
  let allGroupRefsValid = true;
  for (const g of groups) {
    if (!companyIds.has(g.company_id)) allGroupRefsValid = false;
  }
  assert(allGroupRefsValid, 'All groups reference valid companies');

  let allMembershipRefsValid = true;
  for (const ms of memberships) {
    if (!groupIds.has(ms.group_id) || !memberIds.has(ms.member_id)) {
      allMembershipRefsValid = false;
    }
  }
  assert(allMembershipRefsValid, 'All memberships reference valid groups and members');

  // Test 4: Check Yiwha has multiple group memberships
  const yiwhaMemberships = memberships.filter(ms => ms.member_id === 'yiwha');
  assert(yiwhaMemberships.length === 2, `Yiwha has 2 group memberships (found: ${yiwhaMemberships.length})`);
  const soraYiwha = yiwhaMemberships.find(ms => ms.group_id === 'sora-sora');
  const noxYiwha = yiwhaMemberships.find(ms => ms.group_id === 'nox-0ff');
  assert(soraYiwha?.color.name === 'Black' && soraYiwha?.is_active === false, 'Yiwha in Sora Sora is Black and Graduated');
  assert(noxYiwha?.color.name === 'White' && noxYiwha?.is_active === true, 'Yiwha in Nox:0ff is White and Active');

  // Test 5: Hex Colors
  const hexRegex = /^#[0-9a-fA-F]{6}$/;
  let allHexValid = true;
  for (const ms of memberships) {
    if (!hexRegex.test(ms.color.hex)) allHexValid = false;
  }
  assert(allHexValid, 'All membership colors have valid 6-char hex codes');

  // Test 6: Country format (clean text, no emojis)
  const allCompaniesCleanCountry = companies.every(c => c.country === 'Thailand');
  assert(allCompaniesCleanCountry, 'All companies have country "Thailand"');

  const allGroupsCleanCountry = groups.every(g => g.country === 'Thailand');
  assert(allGroupsCleanCountry, 'All groups have country "Thailand"');

  // Test 7: Ensure blood_type, height_cm, and raw_text are removed
  const rawMembersJson = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'members.json'), 'utf-8'));
  const hasRemovedFields = rawMembersJson.some((m: any) => 
    'blood_type' in m || 'height_cm' in m || (m.birthday && 'raw_text' in m.birthday)
  );
  assert(!hasRemovedFields, 'No members contain blood_type, height_cm, or birthday.raw_text');

  // Test 8: Avatar cache completeness
  const allMembersHaveAvatar = members.every(m => Boolean(m.avatar_cached_path));
  assert(allMembersHaveAvatar, `All ${members.length} members have avatar_cached_path populated`);

  const allGroupsHaveAvatar = groups.every(g => Boolean(g.avatar_cached_path));
  assert(allGroupsHaveAvatar, `All ${groups.length} groups have avatar_cached_path populated`);

  const allMemberFilesExist = members.every(m => m.avatar_cached_path && fs.existsSync(path.join(ROOT_DIR, m.avatar_cached_path)));
  assert(allMemberFilesExist, 'All member WebP avatar files physically exist on disk');

  const allGroupFilesExist = groups.every(g => g.avatar_cached_path && fs.existsSync(path.join(ROOT_DIR, g.avatar_cached_path)));
  assert(allGroupFilesExist, 'All group WebP avatar files physically exist on disk');

  // Test 9: Company avatar cache completeness
  const allCompaniesHaveAvatar = companies.every(c => Boolean(c.avatar_cached_path));
  assert(allCompaniesHaveAvatar, `All ${companies.length} companies have avatar_cached_path populated`);

  const allCompanyFilesExist = companies.every(c => c.avatar_cached_path && fs.existsSync(path.join(ROOT_DIR, c.avatar_cached_path)));
  assert(allCompanyFilesExist, 'All company WebP avatar files physically exist on disk');

  // Test 10: Member birthday completeness
  const allMembersHaveBirthday = members.every(m => m.birthday && typeof m.birthday.month === 'number' && typeof m.birthday.day === 'number');
  assert(allMembersHaveBirthday, `All ${members.length} members have complete month and day birthdays`);

  // Test 11: Group SNS coverage (X and Instagram for all 17 groups)
  const allGroupsHaveXAndIG = groups.every(g => {
    const platforms = g.sns.map(s => s.platform);
    return platforms.includes('x') && platforms.includes('instagram');
  });
  assert(allGroupsHaveXAndIG, `All ${groups.length} groups have both X and Instagram SNS channels`);

} catch (err) {
  console.error('Test Suite Threw Exception:', err);
  failed++;
}

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
