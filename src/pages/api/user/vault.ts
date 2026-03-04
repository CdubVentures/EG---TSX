/**
 * GET /api/user/vault — Read authenticated user's vault (supports conditional GET via ?rev=N).
 * PUT /api/user/vault — Write compare entries to DynamoDB (preserves builds).
 */

import type { APIRoute } from 'astro';
import { readSessionToken } from '@features/auth/server/cookies';
import { verifyIdToken } from '@features/auth/server/jwt';
import { readVault, writeVault } from '@features/vault/server/db';
import { VaultPutRequestSchema } from '@features/vault/server/schema';

export const prerender = false;

// ─── Auth guard ────────────────────────────────────────────────────────────

async function getUid(cookies: Parameters<APIRoute>[0]['cookies']): Promise<string | null> {
  const token = readSessionToken(cookies);
  if (!token) return null;
  const claims = await verifyIdToken(token);
  return claims?.uid ?? null;
}

// ─── GET /api/user/vault ───────────────────────────────────────────────────

export const GET: APIRoute = async ({ cookies, url }) => {
  const uid = await getUid(cookies);
  if (!uid) return new Response(null, { status: 401 });

  // Conditional GET: if client sends ?rev=N and server matches, return 304
  const clientRev = url.searchParams.get('rev');
  const data = await readVault(uid);

  if (clientRev !== null && parseInt(clientRev, 10) === data.rev) {
    return new Response(null, { status: 304 });
  }

  return Response.json({
    compare: data.compare,
    builds: data.builds,
    rev: data.rev,
  });
};

// ─── PUT /api/user/vault ───────────────────────────────────────────────────

export const PUT: APIRoute = async ({ cookies, request }) => {
  const uid = await getUid(cookies);
  if (!uid) return new Response(null, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = VaultPutRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 });
  }

  // Preserve existing builds — PUT only updates compare
  const existing = await readVault(uid);
  const newRev = await writeVault(uid, parsed.data.compare, existing.builds);

  return Response.json({ ok: true, rev: newRev });
};
