import { z } from 'zod';
import { SNSChannelSchema } from './sns.js';

export const MemberRealNameSchema = z.object({
  first_name_th: z.string().nullable().optional(),
  last_name_th: z.string().nullable().optional(),
  first_name_en: z.string().nullable().optional(),
  last_name_en: z.string().nullable().optional(),
  nickname: z.string().nullable().optional()
}).default({});

export const MemberBirthdaySchema = z.object({
  month: z.number().int().min(1).max(12).nullable().optional(),
  day: z.number().int().min(1).max(31).nullable().optional(),
  year: z.number().int().nullable().optional()
}).default({});

export const AvatarHistoryEntrySchema = z.object({
  path: z.string().describe('Relative path to an archived WebP, e.g. assets/avatars/history/ame/2026-11-09.webp'),
  source_url: z.string().url().nullable().optional().describe('X avatar URL this image was cached from, when known'),
  archived_at: z.string().describe('ISO date (YYYY-MM-DD) the image stopped being the current avatar')
});
export type AvatarHistoryEntry = z.infer<typeof AvatarHistoryEntrySchema>;

export const MemberSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/).describe('Canonical unique identifier, e.g. ame, yiwha, nadear'),
  stage_name: z.string().min(1),
  stage_name_th: z.string().nullable().optional(),
  real_name: MemberRealNameSchema.default({}),
  birthday: MemberBirthdaySchema.default({}),
  avatar_cached_path: z.string().nullable().optional(),
  avatar_source_url: z.string().url().nullable().optional().describe('X avatar URL the current avatar_cached_path webp was built from. If the X avatar_url differs (e.g. edited by hand), the refresh job rebuilds the webp.'),
  avatar_history: z.array(AvatarHistoryEntrySchema).optional().describe('Older avatars, newest first. Filled by refresh-x-avatars.'),
  sns: z.array(SNSChannelSchema).default([])
});
export type Member = z.infer<typeof MemberSchema>;
