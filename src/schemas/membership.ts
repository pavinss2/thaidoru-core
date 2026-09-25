import { z } from 'zod';

export const MembershipStatusEnum = z.enum(['active', 'graduated', 'hiatus', 'trainee', 'withdrawn']);
export type MembershipStatus = z.infer<typeof MembershipStatusEnum>;

export const MemberRoleEnum = z.enum(['member', 'leader', 'sub-leader', 'center', 'trainee', 'guest']);
export type MemberRole = z.infer<typeof MemberRoleEnum>;

export const MemberColorSchema = z.object({
  name: z.string(),
  hex: z.string().regex(/^#[0-9a-fA-F]{6}$/)
});

export const GroupMembershipSchema = z.object({
  id: z.string().describe('Composite ID: {group_id}_{member_id}'),
  group_id: z.string().describe('Foreign key referencing Group.id'),
  member_id: z.string().describe('Foreign key referencing Member.id'),
  status: MembershipStatusEnum.default('active'),
  role: MemberRoleEnum.default('member'),
  color: MemberColorSchema,
  joined_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  // Last day in the group; null while still a member. "Active" is status === 'active'.
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional()
});
export type GroupMembership = z.infer<typeof GroupMembershipSchema>;
