import { z } from 'zod';
import { CompanySchema } from './company.js';
import { GroupSchema } from './group.js';
import { MemberSchema } from './member.js';
import { GroupMembershipSchema } from './membership.js';

export * from './sns.js';
export * from './company.js';
export * from './group.js';
export * from './member.js';
export * from './membership.js';

export const CompaniesSchema = z.array(CompanySchema);
export const GroupsSchema = z.array(GroupSchema);
export const MembersSchema = z.array(MemberSchema);
export const GroupMembershipsSchema = z.array(GroupMembershipSchema);
