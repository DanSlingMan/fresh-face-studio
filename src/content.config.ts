import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    author: z.string().optional().default('Fresh Face Studio'),
    tags: z.array(z.string()).optional().default([]),
    featured: z.boolean().optional().default(false),
    ogImage: z.string().optional(),
  }),
});

export const collections = { blog };
