// WHY: typed globalThis.__mock* enables unit testing of auth API routes
// without real Cognito/DynamoDB calls, while preserving full type safety.
// The `as any` escape hatch is forbidden per AGENTS.md.

import type { CognitoResult, AuthResult } from '@features/auth/server/cognito-api';
import type { VerifiedClaims } from '@features/auth/server/jwt';

declare global {
  var __mockCognitoSignIn: ((email: string, password: string) => Promise<CognitoResult<AuthResult>>) | undefined;
  var __mockCognitoSignUp: ((email: string, password: string) => Promise<CognitoResult<{ userSub: string; codeDelivery: string }>>) | undefined;
  var __mockCognitoConfirmSignUp: ((email: string, code: string) => Promise<CognitoResult<void>>) | undefined;
  var __mockCognitoForgotPassword: ((email: string) => Promise<CognitoResult<{ codeDelivery: string }>>) | undefined;
  var __mockCognitoConfirmForgotPassword: ((email: string, code: string, newPassword: string) => Promise<CognitoResult<void>>) | undefined;
  var __mockCognitoResendCode: ((email: string) => Promise<CognitoResult<{ codeDelivery: string }>>) | undefined;
  var __mockVerifyIdToken: ((token: string) => Promise<VerifiedClaims | null>) | undefined;
  var __mockReadVaultRev: ((uid: string) => Promise<number>) | undefined;
}

export {};
