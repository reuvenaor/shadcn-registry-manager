import { z } from 'zod';

export const scrapeBlocksInputSchema = z.object({
  registryUrl: z.string(),
  style: z.string(),
});

// Minimal block schema for output (can be extended as needed)
export const blockSchema = z.string();

export const scrapeBlocksOutputSchema = z.object({
  content: z.array(z.object({
    type: z.literal('text'),
    text: z.string(),
  })),
  structuredContent: z.array(blockSchema),
});
