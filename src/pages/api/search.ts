/** GET /api/search?q={query}&limit=8&type=product — Full-text search endpoint. */

import type { APIRoute } from 'astro';
import { contentImage, collectionImagePath } from '@core/images';
import { imageDefaults, viewObjectFit } from '@core/config';
import { withCachePolicyHeaders } from '@core/cache-cdn-contract';
import { articleUrl, resolveHero, type ArticleCollection } from '@core/article-helpers';
import type { SearchResult } from '@features/search/types';
import type { ProductMedia } from '@core/media';
import { getImageWithFallback } from '@core/media';
import { withNoIndexHeaders } from '@core/seo/indexation-policy';
import { productUrlFromImagePath } from '@core/seo/url-contract';

export const prerender = false;

// WHY short cache: identical queries cached at edge, reduces DB hits
const CACHE_HEADERS = withNoIndexHeaders(withCachePolicyHeaders('searchApi'));
const NO_CACHE_HEADERS = withNoIndexHeaders(withCachePolicyHeaders('dynamicApis'));

/** Resolve a product thumbnail URL and objectFit from its media + category. */
export function resolveProductImage(
  media: ProductMedia,
  imagePath: string,
  category: string,
): { imageUrl: string; imageFit: 'cover' | 'contain' } | null {
  const defaults = imageDefaults(category);
  const img = getImageWithFallback(media, defaults.coverImageView);
  if (!img) return null;

  return {
    imageUrl: contentImage(imagePath, img.stem, 'xxs'),
    imageFit: viewObjectFit(category, img.view),
  };
}

/** Resolve an article thumbnail URL from its collection + id + hero stem. */
function resolveArticleImage(
  collection: string,
  id: string,
  hero: string | null,
): { imageUrl: string; imageFit: 'cover' | 'contain' } | null {
  if (!hero) return null;

  if (collection === 'brands') {
    return {
      imageUrl: contentImage(collectionImagePath('brands', id), 'brand-logo-horizontal-mono-black', 'xs', 'png'),
      imageFit: 'contain',
    };
  }

  const heroPath = resolveHero(collection, id, hero);
  return {
    imageUrl: `${heroPath}_xxs.webp`,
    imageFit: 'cover',
  };
}

export const GET: APIRoute = async ({ url }) => {
  const { pool } = await import('@core/db');
  const q = url.searchParams.get('q')?.trim() ?? '';
  const limitParam = parseInt(url.searchParams.get('limit') ?? '8', 10);
  const limit = Math.min(Math.max(limitParam, 1), 50);
  const type = url.searchParams.get('type'); // 'product' | 'article' | null (both)

  if (!q) {
    return Response.json([], { headers: CACHE_HEADERS });
  }

  const results: SearchResult[] = [];

  try {
    // WHY: search products unless type=article
    if (type !== 'article') {
      const productResults = await pool.query(
        `SELECT id, brand, model, category, image_path, media, specs,
                ts_rank(search_vec, plainto_tsquery('simple', $1)) AS rank
         FROM products
         WHERE search_vec @@ plainto_tsquery('simple', $1)
            OR brand ILIKE $2 OR model ILIKE $2
         ORDER BY rank DESC
         LIMIT $3`,
        [q, `%${q}%`, limit],
      );

      for (const row of productResults.rows) {
        const media = row.media as ProductMedia;
        const image = resolveProductImage(media, row.image_path, row.category);

        results.push({
          title: `${row.brand} ${row.model}`,
          url: productUrlFromImagePath({
            category: row.category,
            imagePath: row.image_path,
            fallbackSlug: row.id,
          }),
          type: 'product',
          category: row.category,
          imageUrl: image?.imageUrl,
          imageFit: image?.imageFit,
          brand: row.brand,
        });
      }
    }

    // WHY: search articles unless type=product
    if (type !== 'product') {
      const remaining = limit - results.length;
      if (remaining > 0) {
        const articleResults = await pool.query(
          `SELECT id, collection, title, description, category, hero, brand, model,
                  ts_rank(search_vec, plainto_tsquery('simple', $1)) AS rank
           FROM articles
           WHERE search_vec @@ plainto_tsquery('simple', $1)
              OR title ILIKE $2 OR brand ILIKE $2
           ORDER BY rank DESC
           LIMIT $3`,
          [q, `%${q}%`, remaining],
        );

        for (const row of articleResults.rows) {
          const image = resolveArticleImage(row.collection, row.id, row.hero);

          results.push({
            title: row.title,
            url: articleUrl(row.collection as ArticleCollection, row.id),
            type: row.collection as SearchResult['type'],
            category: row.category ?? undefined,
            imageUrl: image?.imageUrl,
            imageFit: image?.imageFit,
            snippet: row.description ? row.description.slice(0, 96) : undefined,
            brand: row.brand ?? undefined,
          });
        }
      }
    }

    return Response.json(results, { headers: CACHE_HEADERS });
  } catch (err) {
    console.error('[search] Query error:', err);
    return Response.json(
      { error: 'Search temporarily unavailable' },
      { status: 503, headers: NO_CACHE_HEADERS },
    );
  }
};
