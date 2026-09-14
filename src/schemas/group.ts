import { z } from 'zod';
import { SNSChannelSchema } from './sns.js';

export const GroupStatusEnum = z.enum(['active', 'disbanded', 'hiatus', 'pre-debut']);
export type GroupStatus = z.infer<typeof GroupStatusEnum>;

export const GroupColorSchema = z.object({
  name: z.string(),
  hex: z.string().regex(/^#[0-9a-fA-F]{6}$/)
});

export const GroupSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/).describe('Unique slug identifier, e.g. sora-sora, nox-off, angevil'),
  company_id: z.string().describe('Foreign key to Company.id'),
  name: z.string().min(1),
  native_name: z.string().nullable().optional(),
  status: GroupStatusEnum.default('active'),
  country: z.string().default('🇹🇭 TH'),
  debut_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  disband_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  theme_color: GroupColorSchema.nullable().optional(),
  music_links: z.record(z.string().url()).default({}),
  sns: z.array(SNSChannelSchema).default([])
});
export type Group = z.infer<typeof GroupSchema>;
