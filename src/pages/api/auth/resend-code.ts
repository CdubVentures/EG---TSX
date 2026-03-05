/** POST /api/auth/resend-code — Resend email verification code. */

import type { APIRoute } from 'astro';
import { cognitoResendCode } from '@features/auth/server/cognito-api';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: { code: 'InvalidRequest', message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  const { email } = body;
  if (!email) {
    return Response.json(
      { error: { code: 'InvalidRequest', message: 'Email is required' } },
      { status: 400 },
    );
  }

  const resend = globalThis.__mockCognitoResendCode ?? cognitoResendCode;
  const result = await resend(email);

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  return Response.json({ status: 'code-sent' });
};
