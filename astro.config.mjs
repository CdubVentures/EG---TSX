// @ts-check
import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';

import react from '@astrojs/react';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { rehypeInlineAds } from './src/features/ads/inline/rehype-inline-ads.mjs';

const env = loadEnv(process.env.NODE_ENV ?? 'production', process.cwd(), '');
const siteUrl = env.PUBLIC_SITE_URL || 'https://eggear.com';

// https://astro.build/config
export default defineConfig({
  site: siteUrl,

  // WHY adapter: all existing pages stay static (prerender: true by default).
  // Only auth endpoints opt in to SSR with `export const prerender = false`.
  adapter: node({ mode: 'standalone' }),

  markdown: {
    rehypePlugins: [rehypeInlineAds],
  },

  integrations: [
    react(),
    mdx(),
    sitemap({
      filter: (page) =>
        !page.includes('/profile/') && !page.includes('/api/'),
    }),
  ],

  vite: {
    plugins: [tailwindcss()],
    resolve: {
      dedupe: ['react', 'react-dom'],
    },
    server: {
      watch: {
        ignored: ['**/.last_sync_success'],
      },
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'nanostores', '@nanostores/react'],
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('react') || id.includes('nanostores')) return 'vendor';
              if (id.includes('jose') || id.includes('@aws-sdk')) return 'auth-vendor';
            }
          },
        },
      },
    },
  },
});
