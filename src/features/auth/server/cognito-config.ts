/** Cognito configuration — Zod-validated, fails fast at import. */

import { z } from 'zod';

const CognitoConfigSchema = z.object({
  region: z.string().min(1),
  userPoolId: z.string().min(1),
  clientId: z.string().min(1),
  clientSecret: z.string().optional().default(''),
  domain: z.string().min(1),
  callbackUrl: z.string().url(),
  logoutUrl: z.string().url(),
});

function loadConfig() {
  // WHY: process.env for server-only vars — they must be read at runtime from
  // the Lambda environment, not baked in at build time via import.meta.env.
  // PUBLIC_ vars also use process.env here since this file only runs server-side.
  const env = process.env;

  return CognitoConfigSchema.parse({
    region: env.PUBLIC_COGNITO_REGION,
    userPoolId: env.PUBLIC_COGNITO_USER_POOL_ID,
    clientId: env.PUBLIC_COGNITO_APP_CLIENT_ID,
    clientSecret: env.COGNITO_CLIENT_SECRET || '',
    domain: env.COGNITO_DOMAIN,
    callbackUrl: env.COGNITO_CALLBACK_URL,
    logoutUrl: env.COGNITO_LOGOUT_URL,
  });
}

export type CognitoConfig = z.infer<typeof CognitoConfigSchema>;

/** Lazily loaded config — validated once on first access. */
let _config: CognitoConfig | null = null;

export function getCognitoConfig(): CognitoConfig {
  if (!_config) _config = loadConfig();
  return _config;
}
