/** POST /api/auth/resend-code — Resend email verification code. */

import type { APIRoute } from 'astro';
import { jsonNoIndex } from '@core/seo/indexation-policy';
import { cognitoResendCode } from '@features/auth/server/cognito-api';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return jsonNoIndex(
      { error: { code: 'InvalidRequest', message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  const { email } = body;
  if (!email) {
    return jsonNoIndex(
      { error: { code: 'InvalidRequest', message: 'Email is required' } },
      { status: 400 },
    );
  }

  const resend = globalThis.__mockCognitoResendCode ?? cognitoResendCode;
  const result = await resend(email);

  if (!result.ok) {
    return jsonNoIndex({ error: result.error }, { status: 400 });
  }

  return jsonNoIndex({ status: 'code-sent' });
};
