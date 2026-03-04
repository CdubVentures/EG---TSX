/** POST /api/auth/confirm-forgot-password — Reset password with verification code. */

import type { APIRoute } from 'astro';
import { cognitoConfirmForgotPassword } from '@features/auth/server/cognito-api';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  let body: { email?: string; code?: string; newPassword?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: { code: 'InvalidRequest', message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  const { email, code, newPassword } = body;
  if (!email || !code || !newPassword) {
    return Response.json(
      { error: { code: 'InvalidRequest', message: 'Email, code, and new password are required' } },
      { status: 400 },
    );
  }

  const confirmForgot = (globalThis as any).__mockCognitoConfirmForgotPassword ?? cognitoConfirmForgotPassword;
  const result = await confirmForgot(email, code, newPassword);

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  return Response.json({ status: 'password-reset' });
};
