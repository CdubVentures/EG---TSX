/** POST /api/auth/forgot-password — Request password reset code. */

import type { APIRoute } from 'astro';
import { cognitoForgotPassword } from '@features/auth/server/cognito-api';

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

  const forgotPw = (globalThis as any).__mockCognitoForgotPassword ?? cognitoForgotPassword;
  const result = await forgotPw(email);

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  return Response.json({ status: 'code-sent', email });
};
