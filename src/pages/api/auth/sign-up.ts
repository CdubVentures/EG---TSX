/** POST /api/auth/sign-up — Email/password registration via Cognito User Pool API. */

import type { APIRoute } from 'astro';
import { cognitoSignUp } from '@features/auth/server/cognito-api';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: { code: 'InvalidRequest', message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  const { email, password } = body;
  if (!email || !password) {
    return Response.json(
      { error: { code: 'InvalidRequest', message: 'Email and password are required' } },
      { status: 400 },
    );
  }

  const signUp = globalThis.__mockCognitoSignUp ?? cognitoSignUp;
  const result = await signUp(email, password);

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  return Response.json({ status: 'confirm-required', email });
};
