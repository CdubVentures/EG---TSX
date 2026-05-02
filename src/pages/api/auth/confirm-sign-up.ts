/** POST /api/auth/confirm-sign-up — Verify email with confirmation code. */

import type { APIRoute } from 'astro';
import { jsonNoIndex } from '@core/seo/indexation-policy';
import { cognitoConfirmSignUp } from '@features/auth/server/cognito-api';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  let body: { email?: string; code?: string };
  try {
    body = await request.json();
  } catch {
    return jsonNoIndex(
      { error: { code: 'InvalidRequest', message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  const { email, code } = body;
  if (!email || !code) {
    return jsonNoIndex(
      { error: { code: 'InvalidRequest', message: 'Email and code are required' } },
      { status: 400 },
    );
  }

  const confirm = globalThis.__mockCognitoConfirmSignUp ?? cognitoConfirmSignUp;
  const result = await confirm(email, code);

  if (!result.ok) {
    return jsonNoIndex({ error: result.error }, { status: 400 });
  }

  return jsonNoIndex({ status: 'confirmed' });
};
