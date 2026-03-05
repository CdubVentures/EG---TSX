// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://expertgaming.gg', // update to actual domain

  // WHY adapter: all existing pages stay static (prerender: true by default).
  // Only auth endpoints opt in to SSR with `export const prerender = false`.
  adapter: node({ mode: 'standalone' }),

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
