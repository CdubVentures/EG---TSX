import type { APIRoute } from 'astro';
import { CONFIG } from '@core/config';
import { buildRobotsTxt } from '@core/seo/indexation-policy';

export const GET: APIRoute = () => {
  const body = buildRobotsTxt({ siteUrl: CONFIG.site.url });

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  });
};
