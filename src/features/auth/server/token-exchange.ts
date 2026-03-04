/** Token exchange — exchanges authorization code for Cognito tokens. */

export interface TokenResponse {
  id_token: string;
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

/**
 * Exchange an authorization code for tokens via Cognito's /oauth2/token endpoint.
 * Supports both confidential (with secret) and public (no secret) clients.
 * Returns null on failure.
 */
export async function exchangeCodeForTokens(code: string, codeVerifier?: string): Promise<TokenResponse | null> {
  const env = typeof import.meta !== 'undefined' && import.meta.env
    ? import.meta.env
    : process.env;

  const clientId = env.PUBLIC_COGNITO_APP_CLIENT_ID;
  const clientSecret = env.COGNITO_CLIENT_SECRET;
  const domain = env.COGNITO_DOMAIN;
  const callbackUrl = env.COGNITO_CALLBACK_URL;

  const tokenUrl = `https://${domain}/oauth2/token`;

  const params: Record<string, string> = {
    grant_type: 'authorization_code',
    client_id: clientId ?? '',
    code,
    redirect_uri: callbackUrl ?? '',
  };

  // WHY: only include client_secret for confidential clients.
  // Cognito public clients (no secret) work without it.
  if (clientSecret) {
    params.client_secret = clientSecret;
  }

  if (codeVerifier) {
    params.code_verifier = codeVerifier;
  }

  const body = new URLSearchParams(params);

  try {
    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) return null;

    const data = await res.json() as TokenResponse;
    return data;
  } catch {
    return null;
  }
}
