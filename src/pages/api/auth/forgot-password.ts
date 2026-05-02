/** POST /api/auth/forgot-password — Request password reset code. */

import type { APIRoute } from 'astro';
import { jsonNoIndex } from '@core/seo/indexation-policy';
import { cognitoForgotPassword } from '@features/auth/server/cognito-api';

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

  const forgotPw = globalThis.__mockCognitoForgotPassword ?? cognitoForgotPassword;
  const result = await forgotPw(email);

  if (!result.ok) {
    return jsonNoIndex({ error: result.error }, { status: 400 });
  }

  return jsonNoIndex({ status: 'code-sent', email });
};
