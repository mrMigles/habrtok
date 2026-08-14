import { z } from 'zod';

export const tokItemSchema = z.object({
  id: z.string().min(1),
  source: z.literal('Habr'),
  title: z.string().min(1),
  summary: z.string().min(1),
  description: z.string().optional(),
  imageUrl: z.string().url().optional(),
  canonicalUrl: z.string().url(),
  author: z.string().optional(),
  authorAvatarUrl: z.string().url().optional(),
  publishedAt: z.string().datetime().optional(),
  tags: z.array(z.string()).optional(),
  hubs: z.array(z.string()).optional(),
  hubAliases: z.array(z.string()).optional(),
  readingTime: z.number().int().positive().optional(),
  complexity: z.enum(['low', 'medium', 'high']).optional(),
  format: z.string().optional(),
  stats: z
    .object({
      readingCount: z.number().int().nonnegative(),
      commentsCount: z.number().int().nonnegative(),
      favoritesCount: z.number().int().nonnegative(),
      score: z.number(),
    })
    .optional(),
});

export type TokItem = z.infer<typeof tokItemSchema>;

export interface TokSource {
  discover(signal?: AbortSignal): Promise<TokItem[]>;
  related(item: TokItem, signal?: AbortSignal): Promise<TokItem[]>;
  hydrate(ids: string[], signal?: AbortSignal): Promise<TokItem[]>;
}

export interface FeedLevel {
  anchor: TokItem | null;
  items: TokItem[];
  index: number;
  exhausted?: boolean;
}

export interface FeedState {
  levels: FeedLevel[];
  journey: TokItem[];
}
