// Astro 5 — Content Layer API
// https://docs.astro.build/en/guides/content-collections/
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { collectionEnumValues } from './core/category-contract';

// ─── Slug-folder loader ───────────────────────────────────────────────────
// Article content uses slug-folder layout: {slug}/index.{md,mdx}
// generateId strips the "/index.{md,mdx}" suffix so entry.id matches the image convention
function articleLoader(base: string) {
  return glob({
    pattern: '**/index.{md,mdx}',
    base,
    generateId: ({ entry }) => entry.replace(/\/index\.(md|mdx)$/, ''),
  });
}

// ─── Shared validators ─────────────────────────────────────────────────────
// WHY: category-contract.ts is the single reader for categories.json. Content
// collections derive their allowed category IDs from that shared contract.
const categories = z.enum(collectionEnumValues.dataProducts);
const reviewCategories = z.enum(collectionEnumValues.reviews);
const guideCategories = z.enum(collectionEnumValues.guides);
const newsCategories = z.enum(collectionEnumValues.news);

// ─── Reviews (product review articles) ────────────────────────────────────
// Source: EG-HBS/.markdowns/reviews/**/*.md
// Real fields from: reviews/mouse/Alienware - AW610M [id = 1].md
const reviews = defineCollection({
  loader: articleLoader('./src/content/reviews'),
  schema: z.object({
    // Content identity
    category:    reviewCategories,
    brand:       z.string().optional(),
    model:       z.string().optional(),

    // Authoring
    author:      z.string().default('EG Team'),
    publish: z.boolean().default(true),
    draft:       z.boolean().default(false),

    // SEO / display
    title:       z.string().min(5).max(160),
    subtitle:    z.string().optional(),
    description: z.string().min(20).max(500),
    tags:        z.array(z.coerce.string()).default([]),

    // Dates
    datePublished: z.coerce.date().optional(),
    dateUpdated:   z.coerce.date().optional(),

    // Hero media
    hero:        z.string().optional(),
    heroAspect:  z.string().optional(),
    heroCredit:  z.string().optional(),

    // Links to product data (slug from products registry)
    productId:   z.string().optional(),

    // Editorial
    egbadge:     z.string().optional(),
    pinned:      z.boolean().default(false),

    // Layout
    toc:         z.boolean().default(false),
  }),
});

// ─── Brands ───────────────────────────────────────────────────────────────
// Source: EG-HBS/.markdowns/brands/*.md
// Real fields from: brands/Alienware.md
const brands = defineCollection({
  loader: articleLoader('./src/content/brands'),
  schema: z.object({
    brand:       z.string(),
    displayName: z.string().optional(),

    // SEO / display
    title:       z.string().min(5).max(120),
    subtitle:    z.string().optional(),
    description: z.string().min(20).max(1000),
    profile:     z.string().optional(),
    tags:        z.array(z.coerce.string()).default([]),

    // Dates
    datePublished: z.coerce.date().optional(),
    dateUpdated:   z.coerce.date().optional(),

    // Score (0–10, HBS uses this scale)
    overall:     z.number().min(0).max(10).optional(),

    // Hero
    hero:        z.string().optional(),
    heroCredit:  z.string().optional(),

    // Social links
    brand_website:   z.string().url().optional().or(z.literal('')),
    brand_facebook:  z.string().url().optional().or(z.literal('')),
    brand_x:         z.string().url().optional().or(z.literal('')),
    brand_instagram: z.string().url().optional().or(z.literal('')),
    brand_youtube:   z.string().url().optional().or(z.literal('')),
    brand_tiktok:    z.string().url().optional().or(z.literal('')),

    // Hub config
    categories:       z.array(z.coerce.string()).default([]),
    navbar:           z.array(z.coerce.string()).default([]),
    iDashboard:       z.string().optional(),
    iFilteredDashboard: z.string().optional(),

    // Product references (brand + model strings, resolved at build time)
    product_1:    z.string().optional(),
    product_2:    z.string().optional(),
    product_3:    z.string().optional(),
    product_4:    z.string().optional(),
    product_5:    z.string().optional(),
    product_6:    z.string().optional(),

    toc:          z.boolean().default(false),
    publish:  z.boolean().default(true),
  }),
});

// ─── Games ────────────────────────────────────────────────────────────────
// Source: EG-HBS/.markdowns/games/*.md
// Real fields from: games/Apex Legends (2).md
const games = defineCollection({
  loader: articleLoader('./src/content/games'),
  schema: z.object({
    game:        z.string(),
    guide:       z.string().optional(),
    navbar:      z.boolean().default(false),

    // SEO / display
    title:       z.string().min(2).max(120),
    subtitle:    z.string().optional(),
    description: z.string().min(20).max(500),
    profile:     z.string().optional(),
    tags:        z.array(z.coerce.string()).default([]),

    // Game metadata
    genre:         z.string().optional(),
    releaseDate:   z.coerce.string().optional(), // e.g. "02-04-2019"
    lastPatchDate: z.coerce.string().optional(),
    patchTitle:    z.coerce.string().optional(),

    // Score (0–10)
    overall:     z.number().min(0).max(10).optional(),

    // Hero
    hero:        z.string().optional(),
    heroAlt:     z.string().optional(),
    heroCredit:  z.string().optional(),
    boxCoverArt: z.string().optional(),

    // Social
    game_website:   z.string().url().optional().or(z.literal('')),
    game_facebook:  z.string().url().optional().or(z.literal('')),
    game_x:         z.string().url().optional().or(z.literal('')),
    game_instagram: z.string().url().optional().or(z.literal('')),
    game_youtube:   z.string().url().optional().or(z.literal('')),

    // Hub
    iDashboard:  z.string().optional(),
    author:      z.string().optional(),
    publish: z.boolean().default(true),
    toc:         z.boolean().default(false),
  }),
});

// ─── Guides ───────────────────────────────────────────────────────────────
// Source: EG-HBS/.markdowns/guides/**/*.md
const guides = defineCollection({
  loader: articleLoader('./src/content/guides'),
  schema: z.object({
    category:    guideCategories.optional(),
    guide:       z.string().optional(),
    navbar:      z.array(z.coerce.string()).default([]),

    // SEO / display
    title:       z.string().min(5).max(120),
    subtitle:    z.string().optional(),
    summary:     z.string().optional(),
    description: z.string().min(20).max(500),
    tags:        z.array(z.coerce.string()).default([]),

    // Dates
    datePublished: z.coerce.date().optional(),
    dateUpdated:   z.coerce.date().optional(),

    // Hero
    hero:        z.string().optional(),
    heroCredit:  z.string().optional(),

    // Editorial
    egbadge:     z.string().optional(),
    pinned:      z.boolean().default(false),

    author:      z.string().optional(),
    publish: z.boolean().default(true),
    toc:         z.boolean().default(false),
    draft:       z.boolean().default(false),
  }),
});

// ─── News ─────────────────────────────────────────────────────────────────
const news = defineCollection({
  loader: articleLoader('./src/content/news'),
  schema: z.object({
    title:       z.string().min(5).max(160),
    description: z.string().min(20).max(500),
    tags:        z.array(z.coerce.string()).default([]),

    datePublished: z.coerce.date(),
    dateUpdated:   z.coerce.date().optional(),

    author:      z.string().default('EG Team'),
    hero:        z.string().optional(),
    heroCredit:  z.string().optional(),

    category:    newsCategories.optional(),

    // Editorial
    egbadge:     z.string().optional(),
    pinned:      z.boolean().default(false),

    draft:       z.boolean().default(false),
    publish: z.boolean().default(true),
  }),
});

// ─── Product Media Schema ────────────────────────────────────────────────────
// Structured image data — replaces flat imgTop/imgBot/featureImgCover/etc. fields.
// Built automatically by scripts/build-media.mjs from filesystem scan.

const productImage = z.object({
  stem:    z.string(),                  // e.g. "top", "top---white", "top___cyberpunk-2077-edition---black+red"
  view:    z.string(),                  // e.g. "top", "left", "feature-image", "side" (SVG)
  color:   z.string().optional(),       // e.g. "white", "pink", "black+red"
  edition: z.string().optional(),       // e.g. "cyberpunk-2077-edition"
  seq:     z.number().optional(),       // e.g. 1, 2 for "img1", "img2"
});

const productMedia = z.object({
  defaultColor: z.string().nullable(),  // product.colors[0] or null if no colors
  defaultEdition: z.string().nullable().optional(), // explicit default edition when available
  colors:       z.array(z.string()),    // all colors (default first), deduped
  editions:     z.array(z.string()),    // all editions, deduped
  images:       z.array(productImage),  // ordered by view priority
});

// ─── Data: Products (headless product DB) ───────────────────────────────────
// Source: split from src/data/products/{category}.json → individual files
// Each file = one product: src/content/data-products/{category}/{brand}/{slug}.json
// entry.id = "razer-viper-v3-pro" (glob loader joins {brand}-{slug}, no category prefix)
const dataProducts = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/data-products' }),
  schema: z.object({
    // Identity (strict — these fields MUST exist)
    slug:      z.string(),
    brand:     z.string(),
    model:     z.string(),
    baseModel: z.string(),
    variant:   z.string(),
    category:  categories,
    imagePath: z.string(),

    // Structured media (replaces flat image fields)
    media:     productMedia,

    // All remaining spec/score/content fields pass through
    // Full per-category schemas will tighten as components are built
  }).passthrough(),
});

// ─── Pages (static content) ───────────────────────────────────────────────
const pages = defineCollection({
  loader: articleLoader('./src/content/pages'),
  schema: z.object({
    title:       z.string(),
    description: z.string(),
    noIndex:     z.boolean().default(false),
  }),
});

// ─── Export ───────────────────────────────────────────────────────────────
export const collections = {
  reviews,
  brands,
  games,
  guides,
  news,
  pages,
  dataProducts,
};
