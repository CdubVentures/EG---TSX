/**
 * GET /api/user/vault — Read authenticated user's vault (supports conditional GET via ?rev=N).
 * PUT /api/user/vault — Write compare entries to DynamoDB (preserves builds).
 */

import type { APIRoute } from 'astro';
import { withCachePolicyHeaders } from '@core/cache-cdn-contract';
import { readSessionToken } from '@features/auth/server/cookies';
import { verifyIdToken } from '@features/auth/server/jwt';
import { readVault, writeVault } from '@features/vault/server/db';
import { VaultPutRequestSchema } from '@features/vault/server/schema';
import { jsonNoIndex, withNoIndexHeaders } from '@core/seo/indexation-policy';

export const prerender = false;

const NO_CACHE_HEADERS = withNoIndexHeaders(withCachePolicyHeaders('dynamicApis'));

// ─── Auth guard ────────────────────────────────────────────────────────────

async function getUid(cookies: Parameters<APIRoute>[0]['cookies']): Promise<string | null> {
  const token = readSessionToken(cookies);
  if (!token) return null;
  const verify = globalThis.__mockVerifyIdToken ?? verifyIdToken;
  const claims = await verify(token);
  return claims?.uid ?? null;
}

// ─── GET /api/user/vault ───────────────────────────────────────────────────

export const GET: APIRoute = async ({ cookies, url }) => {
  const uid = await getUid(cookies);
  if (!uid) return new Response(null, { status: 401, headers: NO_CACHE_HEADERS });

  // Conditional GET: if client sends ?rev=N and server matches, return 304
  const clientRev = url.searchParams.get('rev');
  const read = globalThis.__mockReadVault ?? readVault;
  const data = await read(uid);

  if (clientRev !== null && parseInt(clientRev, 10) === data.rev) {
    return new Response(null, { status: 304, headers: NO_CACHE_HEADERS });
  }

  return jsonNoIndex({
    compare: data.compare,
    builds: data.builds,
    rev: data.rev,
  }, { headers: NO_CACHE_HEADERS });
};

// ─── PUT /api/user/vault ───────────────────────────────────────────────────

export const PUT: APIRoute = async ({ cookies, request }) => {
  const uid = await getUid(cookies);
  if (!uid) return new Response(null, { status: 401, headers: NO_CACHE_HEADERS });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonNoIndex({ error: 'Invalid JSON' }, { status: 400, headers: NO_CACHE_HEADERS });
  }

  const parsed = VaultPutRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonNoIndex(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400, headers: NO_CACHE_HEADERS },
    );
  }

  // Preserve existing builds — PUT only updates compare
  const read = globalThis.__mockReadVault ?? readVault;
  const write = globalThis.__mockWriteVault ?? writeVault;
  const existing = await read(uid);
  const newRev = await write(uid, parsed.data.compare, existing.builds);

  return jsonNoIndex({ ok: true, rev: newRev }, { headers: NO_CACHE_HEADERS });
};
