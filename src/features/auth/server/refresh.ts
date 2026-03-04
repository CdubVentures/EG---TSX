/** Token refresh — exchanges refresh_token for new Cognito tokens. */

export interface RefreshResponse {
  id_token: string;
  access_token: string;
  token_type: string;
  expires_in: number;
}

/**
 * Exchange a refresh_token for new id/access tokens via Cognito's /oauth2/token endpoint.
 * Returns null on any failure (expired refresh token, network error, etc.).
 */
export async function refreshTokens(refreshToken: string): Promise<RefreshResponse | null> {
  if (!refreshToken) return null;

  const env = typeof import.meta !== 'undefined' && import.meta.env
    ? import.meta.env
    : process.env;

  const clientId = env.PUBLIC_COGNITO_APP_CLIENT_ID;
  const clientSecret = env.COGNITO_CLIENT_SECRET;
  const domain = env.COGNITO_DOMAIN;

  const tokenUrl = `https://${domain}/oauth2/token`;

  const params: Record<string, string> = {
    grant_type: 'refresh_token',
    client_id: clientId ?? '',
    refresh_token: refreshToken,
  };

  if (clientSecret) {
    params.client_secret = clientSecret;
  }

  const body = new URLSearchParams(params);

  try {
    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) return null;

    const data = await res.json() as RefreshResponse;
    return data;
  } catch {
    return null;
  }
}
