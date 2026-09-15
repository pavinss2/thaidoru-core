import { z } from 'zod';
import { SNSChannelSchema } from './sns.js';

export const CompanyStatusEnum = z.enum(['active', 'inactive']);
export type CompanyStatus = z.infer<typeof CompanyStatusEnum>;

export const CompanySchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/).describe('Unique slug identifier, e.g. catsolute, a-lot-of-tone, ic45'),
  name: z.string().min(1),
  country: z.string().default('Thailand'),
  status: CompanyStatusEnum.default('active'),
  website_url: z.string().url().nullable().optional(),
  sns: z.array(SNSChannelSchema).default([]),
  description: z.string().nullable().optional()
});
export type Company = z.infer<typeof CompanySchema>;
