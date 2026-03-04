/** Cognito User Pool API wrapper — raw fetch, zero deps. */

export interface AuthResult {
  idToken: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface CognitoError {
  code: string;
  message: string;
}

export type CognitoResult<T> = { ok: true; data: T } | { ok: false; error: CognitoError };

// WHY: map Cognito error types to user-friendly messages.
// NotAuthorizedException and UserNotFoundException share the same message
// to prevent user enumeration attacks.
const ERROR_MESSAGES: Record<string, string> = {
  NotAuthorizedException: 'Incorrect email or password',
  UserNotFoundException: 'Incorrect email or password',
  UsernameExistsException: 'An account with this email already exists',
  CodeMismatchException: 'Invalid verification code',
  ExpiredCodeException: 'Verification code expired — request a new one',
  LimitExceededException: 'Too many attempts — please wait and try again',
};

function getConfig() {
  const env = typeof import.meta !== 'undefined' && import.meta.env
    ? import.meta.env
    : process.env;

  return {
    region: env.PUBLIC_COGNITO_REGION as string,
    clientId: env.PUBLIC_COGNITO_APP_CLIENT_ID as string,
  };
}

async function cognitoRequest<T>(
  action: string,
  body: Record<string, unknown>,
  extractData: (json: Record<string, unknown>) => T,
): Promise<CognitoResult<T>> {
  const { region } = getConfig();
  const url = `https://cognito-idp.${region}.amazonaws.com/`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': `AWSCognitoIdentityProviderService.${action}`,
      },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, error: { code: 'NetworkError', message: 'Network request failed' } };
  }

  let json: Record<string, unknown>;
  try {
    json = await res.json() as Record<string, unknown>;
  } catch {
    return { ok: false, error: { code: 'ParseError', message: 'Invalid response from server' } };
  }

  if (!res.ok) {
    const rawType = (json.__type as string) ?? 'UnknownError';
    // WHY: Cognito __type may include a namespace prefix (e.g., "com.amazonaws...#NotAuthorizedException")
    const code = rawType.includes('#') ? rawType.split('#').pop()! : rawType;
    const cognitoMessage = (json.message as string) ?? 'An error occurred';
    const friendlyMessage = ERROR_MESSAGES[code];

    // WHY: InvalidPasswordException includes Cognito's specific detail about what failed
    if (code === 'InvalidPasswordException') {
      return { ok: false, error: { code, message: cognitoMessage } };
    }

    return { ok: false, error: { code, message: friendlyMessage ?? cognitoMessage } };
  }

  return { ok: true, data: extractData(json) };
}

export async function cognitoSignIn(
  email: string,
  password: string,
): Promise<CognitoResult<AuthResult>> {
  const { clientId } = getConfig();
  return cognitoRequest('InitiateAuth', {
    AuthFlow: 'USER_PASSWORD_AUTH',
    ClientId: clientId,
    AuthParameters: { USERNAME: email, PASSWORD: password },
  }, (json) => {
    const auth = json.AuthenticationResult as Record<string, unknown>;
    return {
      idToken: auth.IdToken as string,
      accessToken: auth.AccessToken as string,
      refreshToken: auth.RefreshToken as string,
      expiresIn: auth.ExpiresIn as number,
    };
  });
}

export async function cognitoSignUp(
  email: string,
  password: string,
): Promise<CognitoResult<{ userSub: string; codeDelivery: string }>> {
  const { clientId } = getConfig();
  return cognitoRequest('SignUp', {
    ClientId: clientId,
    Username: email,
    Password: password,
    UserAttributes: [{ Name: 'email', Value: email }],
  }, (json) => ({
    userSub: json.UserSub as string,
    codeDelivery: (json.CodeDeliveryDetails as Record<string, unknown>)?.Destination as string ?? '',
  }));
}

export async function cognitoConfirmSignUp(
  email: string,
  code: string,
): Promise<CognitoResult<void>> {
  const { clientId } = getConfig();
  return cognitoRequest('ConfirmSignUp', {
    ClientId: clientId,
    Username: email,
    ConfirmationCode: code,
  }, () => undefined as void);
}

export async function cognitoForgotPassword(
  email: string,
): Promise<CognitoResult<{ codeDelivery: string }>> {
  const { clientId } = getConfig();
  return cognitoRequest('ForgotPassword', {
    ClientId: clientId,
    Username: email,
  }, (json) => ({
    codeDelivery: (json.CodeDeliveryDetails as Record<string, unknown>)?.Destination as string ?? '',
  }));
}

export async function cognitoConfirmForgotPassword(
  email: string,
  code: string,
  newPassword: string,
): Promise<CognitoResult<void>> {
  const { clientId } = getConfig();
  return cognitoRequest('ConfirmForgotPassword', {
    ClientId: clientId,
    Username: email,
    ConfirmationCode: code,
    Password: newPassword,
  }, () => undefined as void);
}

export async function cognitoResendCode(
  email: string,
): Promise<CognitoResult<{ codeDelivery: string }>> {
  const { clientId } = getConfig();
  return cognitoRequest('ResendConfirmationCode', {
    ClientId: clientId,
    Username: email,
  }, (json) => ({
    codeDelivery: (json.CodeDeliveryDetails as Record<string, unknown>)?.Destination as string ?? '',
  }));
}
