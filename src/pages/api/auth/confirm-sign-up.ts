/** POST /api/auth/confirm-sign-up — Verify email with confirmation code. */

import type { APIRoute } from 'astro';
import { cognitoConfirmSignUp } from '@features/auth/server/cognito-api';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  let body: { email?: string; code?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: { code: 'InvalidRequest', message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  const { email, code } = body;
  if (!email || !code) {
    return Response.json(
      { error: { code: 'InvalidRequest', message: 'Email and code are required' } },
      { status: 400 },
    );
  }

  const confirm = (globalThis as any).__mockCognitoConfirmSignUp ?? cognitoConfirmSignUp;
  const result = await confirm(email, code);

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  return Response.json({ status: 'confirmed' });
};
