/** POST /api/auth/confirm-forgot-password — Reset password with verification code. */

import type { APIRoute } from "astro";
import { jsonNoIndex } from '@core/seo/indexation-policy';
import { cognitoConfirmForgotPassword } from "@features/auth/server/cognito-api";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  let body: { email?: string; code?: string; newPassword?: string };
  try {
    body = await request.json();
  } catch {
    return jsonNoIndex({ error: { code: "InvalidRequest", message: "Invalid JSON body" } }, { status: 400 });
  }

  const { email, code, newPassword } = body;
  if (!email || !code || !newPassword) {
    return jsonNoIndex({ error: { code: "InvalidRequest", message: "Email, code, and new password are required" } }, { status: 400 });
  }

  const confirmForgot = globalThis.__mockCognitoConfirmForgotPassword ?? cognitoConfirmForgotPassword;
  const result = await confirmForgot(email, code, newPassword);

  if (!result.ok) {
    return jsonNoIndex({ error: result.error }, { status: 400 });
  }

  return jsonNoIndex({ status: "password-reset" });
};
