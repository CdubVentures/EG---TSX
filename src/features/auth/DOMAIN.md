# Auth Feature — Domain Contract

## Purpose

Authentication via AWS Cognito (OIDC + PKCE). Supports Google, Discord, and
email/password login. Manages session cookies, token refresh, and cross-tab sync.

## Public API

### Client (`store.ts`)

| Export | Description |
|--------|-------------|
| `$auth` | Nanostore atom — `AuthState` (guest / loading / authenticated) |
| `hydrateAuth()` | Fetch `/api/auth/me`, set `$auth`. Deduplicates concurrent calls. |
| `setAuthenticated()` | Set authenticated state with uid/email/username |
| `setGuest()` | Reset to guest |
| `logout()` | Reset state + navigate to `/logout` |
| `$authDialog` | Atom — `{ open, view }` for login/signup modal |
| `openLogin()` / `openSignup()` / `closeAuth()` / `switchView()` | Dialog controls |

### Server (`server/`)

| Module | Export | Description |
|--------|--------|-------------|
| `cognito-config.ts` | `getCognitoConfig()` | Zod-validated Cognito env vars |
| `cookies.ts` | `buildAuthCookieHeaders()`, `buildClearCookieHeaders()`, `setAuthCookies()`, `clearAuthCookies()`, `readSessionToken()`, `readRefreshToken()`, `buildPkceCookie()`, `buildClearPkceCookie()` | Cookie CRUD |
| `html.ts` | `escapeHtml()`, `errorPage()` | XSS-safe HTML for callback error pages |
| `jwt.ts` | `verifyIdToken()`, `getTokenExpiry()` | RS256 JWT verification via JWKS |
| `login-redirect.ts` | `buildLoginRedirect()` | Shared 302 redirect builder (PKCE + nonce) |
| `oidc.ts` | `generateOidcState()`, `validateOidcState()`, `validateReturnUrl()`, `generatePkceChallenge()` | CSRF state + PKCE + return URL validation |
| `refresh.ts` | `refreshTokens()` | Cognito token refresh |
| `token-exchange.ts` | `exchangeCodeForTokens()` | Authorization code → token exchange |

### Components (`components/`)

| Component | Description |
|-----------|-------------|
| `AuthDialog.tsx` | Modal shell — renders LoginView or SignupView |
| `LoginView.tsx` | Email/password + social login buttons |
| `SignupView.tsx` | Registration form |
| `BrandLogo.tsx` | Logo in auth dialog header |
| `GoogleIcon.tsx` | Google "G" SVG icon |

## Cookie Table

| Name | HttpOnly | Secure (prod) | Max-Age | Purpose |
|------|----------|---------------|---------|---------|
| `eg_session` | yes | yes | 30 days | JWT id_token |
| `eg_refresh` | yes | yes | 30 days | Refresh token |
| `eg_hint` | no | yes | 30 days | Client hint (logged-in flag) |
| `eg_first` | no | yes | 5 min | First-signup merge trigger |
| `eg_nonce` | yes | yes | 5 min | OIDC CSRF state |
| `eg_pkce` | yes | yes | 5 min | PKCE code_verifier |
| `eg_return` | no | yes | 5 min | Mobile redirect URL |

## Boundaries

- **Client → Server:** `hydrateAuth()` fetches `/api/auth/me` (validated via Zod schema)
- **Server → Cognito:** Token exchange, refresh, JWKS verification
- **Cross-tab:** BroadcastChannel `eg-auth-sync` syncs `$auth` state
- **Auth → Vault:** `$auth` transitions trigger vault persona switches (via `sync.ts`)

## Dependencies

- `nanostores` — reactive state
- `jose` — JWT verification (server only)
- `zod` — schema validation
- AWS Cognito — identity provider

## Security Invariants

- `errorPage()` always HTML-escapes user input (XSS prevention)
- `errorPage()` returns status 400 (not 200)
- OIDC state HMAC-signed when secret available; nonce + cookie comparison otherwise
- Return URLs validated: must start with `/`, reject `//` and scheme injections
- PKCE (S256) on all login flows
- `hydrateAuth()` deduplicates concurrent calls (prevents race conditions)

## Test Coverage

| File | Tests | Covers |
|------|-------|--------|
| `auth-server.test.mjs` | 52 | OIDC, JWT, token exchange, PKCE, cookies, escapeHtml, errorPage, buildLoginRedirect |
| `auth-hydrate.test.mjs` | 7 | hydrateAuth flow + dedup |
| `auth-store.test.mjs` | — | Store state transitions |
| `auth-dialog-store.test.mjs` | — | Dialog open/close/switch |
| `auth-schemas.test.mjs` | — | Zod schema validation |
