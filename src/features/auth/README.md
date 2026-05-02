# src/features/auth

## Purpose

Owns the Cognito-backed authentication flow for EG - TSX, including client auth
state, auth dialog UX, OIDC redirect handling, cookie/session helpers, and
server token validation/refresh logic.

## Public API (The Contract)

- `index.ts`
  Exports `AuthState`, `AuthStatus`, `GUEST`, `LOADING`,
  `AuthDialogView`, `$auth`, `setAuthenticated()`, `setLoading()`,
  `setGuest()`, `hydrateAuth()`, `hydrateAuthFromCookieHint()`, `logout()`,
  `$authDialog`, `openLogin()`, `openSignup()`, `closeAuth()`, `switchView()`,
  `$authForm`, `setFormEmail()`, `setFormError()`, `setFormLoading()`,
  `setFormSuccess()`, `clearForm()`, `AuthMeResponseSchema`,
  `AuthMeResponse`, and `AuthDialog`.
- `oauth-popup.ts`
  Popup helpers used by the social/OIDC client flow.
- `server/cognito-config.ts`
  `getCognitoConfig()`.
- `server/cognito-api.ts`
  Direct Cognito API helpers.
- `server/cookies.ts`
  Cookie read/write helpers.
- `server/html.ts`
  `escapeHtml()` and `errorPage()`.
- `server/jwt.ts`
  ID-token verification helpers.
- `server/login-redirect.ts`
  Internal return-path redirect builder.
- `server/oidc.ts`
  OIDC state, nonce, PKCE, and return URL helpers.
- `server/refresh.ts`
  Refresh-token exchange helpers.
- `server/token-exchange.ts`
  Authorization-code token exchange helpers.

## Dependencies

Allowed imports:

- `@core/*`
- `@shared/lib/*`
- Browser APIs and `nanostores`
- `jose` and `zod` for server validation
- `@features/vault/*` only for the documented auth-to-vault sync path

Forbidden imports:

- Unrelated feature internals

## Mutation Boundaries

- May write auth/session cookies.
- May call Cognito/OIDC endpoints.
- May update client auth/dialog state.
- Must not write arbitrary project files.

## Domain Invariants

- `hydrateAuth()` must deduplicate concurrent client fetches.
- Guest startup must not fetch `/api/auth/me` without the cookie hint gate.
- OIDC flows require PKCE and internal-only return URLs.
- Error pages must escape user-controlled content.
- Auth remains the single shared-kernel owner of signed-in user identity state.

## Local Sub-Boundaries

- [components/README.md](components/README.md)
- [server/README.md](server/README.md)
- [tests/README.md](tests/README.md)
