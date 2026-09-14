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

} catch (err) {
  console.error('Test Suite Threw Exception:', err);
  failed++;
}

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
