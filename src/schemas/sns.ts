import { z } from 'zod';

export const SNSPlatformEnum = z.enum([
  'x',
  'instagram',
  'facebook',
  'tiktok',
  'youtube',
  'spotify',
  'threads',
  'other'
]);
export type SNSPlatform = z.infer<typeof SNSPlatformEnum>;

export const SNSChannelSchema = z.object({
  platform: SNSPlatformEnum,
  profile_id: z.string().nullable().optional().describe('Immutable platform unique ID, e.g. Facebook page ID or X rest_id'),
  current_handle: z.string().nullable().optional().describe('Current handle or vanity username, e.g. ame_sorasora'),
  url: z.string().url().nullable().optional().describe('Full profile URL'),
  avatar_url: z.string().url().nullable().optional().describe('Scraped avatar URL from source platform'),
  avatar_cached_path: z.string().nullable().optional().describe('Relative path to permanently cached asset in CDN')
});
export type SNSChannel = z.infer<typeof SNSChannelSchema>;
