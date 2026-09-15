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

export const MemberSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/).describe('Canonical unique identifier, e.g. ame, yiwha, nadear'),
  stage_name: z.string().min(1),
  stage_name_th: z.string().nullable().optional(),
  real_name: MemberRealNameSchema.default({}),
  birthday: MemberBirthdaySchema.default({}),
  sns: z.array(SNSChannelSchema).default([])
});
export type Member = z.infer<typeof MemberSchema>;
