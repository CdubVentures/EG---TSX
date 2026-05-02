/** HTML helpers for server-rendered auth pages. */

import { withNoIndexHeaders } from '@core/seo/indexation-policy';

/** HTML-escape a string to prevent XSS in server-rendered HTML. */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Returns an error HTML page with status 400. Message is HTML-escaped. */
export function errorPage(message: string): Response {
  const html = `<!DOCTYPE html>
<html><head><title>Login Error</title></head>
<body style="font-family:sans-serif;padding:2rem;background:#1d2021;color:#f87171;">
<p>${escapeHtml(message)}</p>
<a href="/" style="display:inline-block;margin-top:1rem;padding:0.5rem 1.5rem;background:#333;color:#e5e7eb;border:1px solid #555;border-radius:4px;cursor:pointer;text-decoration:none;">Back to site</a>
</body></html>`;

  return new Response(html, {
    status: 400,
    headers: withNoIndexHeaders({ 'Content-Type': 'text/html' }),
  });
}
