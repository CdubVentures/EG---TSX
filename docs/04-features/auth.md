# Auth

Validated against:

- `src/shared/layouts/NavIcons.astro`
- `src/shared/layouts/NavMobile.tsx`
- `src/features/auth/components/**`
- `src/features/auth/oauth-popup.ts`
- `src/features/auth/store.ts`
- `src/features/auth/server/login-redirect.ts`
- `src/pages/api/auth/*.ts`
- `src/pages/auth/callback.ts`
- `src/pages/logout.ts`

## Traceability

| Layer | Artifacts |
|---|---|
| Frontend map | [Auth Surface](../03-architecture/routing-and-gui.md#auth-surface) |
| Shared entry points | [`NavIcons.astro`](../../src/shared/layouts/NavIcons.astro), [`NavMobile.tsx`](../../src/shared/layouts/NavMobile.tsx) |
| Dialog and forms | [`AuthDialog.tsx`](../../src/features/auth/components/AuthDialog.tsx), [`LoginView.tsx`](../../src/features/auth/components/LoginView.tsx), [`SignupView.tsx`](../../src/features/auth/components/SignupView.tsx), [`ConfirmSignupView.tsx`](../../src/features/auth/components/ConfirmSignupView.tsx), [`ForgotPasswordView.tsx`](../../src/features/auth/components/ForgotPasswordView.tsx) |
| Client state | [`store.ts`](../../src/features/auth/store.ts), [`oauth-popup.ts`](../../src/features/auth/oauth-popup.ts) |
| Runtime routes | [`/api/auth/sign-in`](../../src/pages/api/auth/sign-in.ts), [`/api/auth/sign-up`](../../src/pages/api/auth/sign-up.ts), [`/api/auth/confirm-sign-up`](../../src/pages/api/auth/confirm-sign-up.ts), [`/api/auth/forgot-password`](../../src/pages/api/auth/forgot-password.ts), [`/api/auth/confirm-forgot-password`](../../src/pages/api/auth/confirm-forgot-password.ts), [`/api/auth/resend-code`](../../src/pages/api/auth/resend-code.ts), [`/api/auth/me`](../../src/pages/api/auth/me.ts), [`/auth/callback`](../../src/pages/auth/callback.ts), [`/logout`](../../src/pages/logout.ts) |
| Data schema | [`DynamoDB vault store`](../03-architecture/data-model.md#dynamodb-vault-store) |
| Adjacent features | [Vault](./vault.md) |
| Standalone Mermaid | [auth.mmd](./auth.mmd) |

## Runtime surface

| Route | Role |
|---|---|
| `/api/auth/sign-up` | Create an email and password account in Cognito |
| `/api/auth/confirm-sign-up` | Confirm the verification code for a newly registered account |
| `/api/auth/resend-code` | Resend the verification code |
| `/api/auth/sign-in` | Email and password sign-in |
| `/api/auth/forgot-password` | Request a reset code |
| `/api/auth/confirm-forgot-password` | Complete the password reset |
| `/login/google` | Start Google Hosted UI login |
| `/login/discord` | Start Discord Hosted UI login |
| `/auth/callback` | Exchange the OAuth code, verify the token, and issue cookies |
| `/api/auth/me` | Rehydrate the client auth store from the session cookie |
| `/logout` | Clear local cookies and continue to hosted logout |

## Sequence Diagram

```mermaid
sequenceDiagram
  autonumber
  actor U as User
  participant NAV as NavIcons or NavMobile
  participant DSTORE as auth dialog store
  participant DIALOG as AuthDialog island
  participant FORM as auth form views
  participant POPUP as openOAuthPopup()
  participant LOGIN as /login/google or /login/discord
  participant SIGNUP as /api/auth/sign-up
  participant CONFIRM as /api/auth/confirm-sign-up
  participant RESEND as /api/auth/resend-code
  participant SIGNIN as /api/auth/sign-in
  participant FORGOT as /api/auth/forgot-password
  participant RESET as /api/auth/confirm-forgot-password
  participant CALLBACK as /auth/callback
  participant ME as /api/auth/me
  participant LOGOUT as /logout
  participant COG as Cognito Hosted UI or User Pool
  participant JWT as verifyIdToken()
  participant DDB as DynamoDB eg_profiles
  participant ASTATE as auth store
  participant VSYNC as vault sync

  U->>NAV: Click Log in or Sign Up
  NAV->>DSTORE: openLogin() or openSignup()
  DSTORE->>DIALOG: open dialog and choose initial view
  DIALOG-->>U: showModal() and render form

  alt Email sign-up path
    U->>FORM: Submit email and password
    FORM->>SIGNUP: POST /api/auth/sign-up
    SIGNUP->>COG: cognitoSignUp(email, password)
    COG-->>SIGNUP: confirm required
    SIGNUP-->>FORM: confirm-required JSON
    FORM->>DSTORE: set email and switch to confirm-signup
    DSTORE->>DIALOG: render ConfirmSignupView
    opt User requests another code
      U->>FORM: Click Resend code
      FORM->>RESEND: POST /api/auth/resend-code
      RESEND->>COG: cognitoResendCode(email)
      COG-->>RESEND: code sent
      RESEND-->>FORM: code-sent JSON
    end
    U->>FORM: Submit verification code
    FORM->>CONFIRM: POST /api/auth/confirm-sign-up
    CONFIRM->>COG: cognitoConfirmSignUp(email, code)
    COG-->>CONFIRM: confirmed
    CONFIRM-->>FORM: confirmed JSON
    FORM->>DSTORE: switch to login
  else Email sign-in path
    U->>FORM: Submit email and password
    FORM->>SIGNIN: POST /api/auth/sign-in
    SIGNIN->>COG: cognitoSignIn(email, password)
    COG-->>SIGNIN: id token and refresh token
    SIGNIN->>JWT: verifyIdToken(id token)
    JWT-->>SIGNIN: uid and profile claims
    SIGNIN->>DDB: readVaultRev(uid)
    DDB-->>SIGNIN: current rev or 0
    SIGNIN-->>FORM: authenticated JSON plus auth cookies
    FORM->>ASTATE: setAuthenticated(uid, email, username)
    ASTATE->>DIALOG: authenticated listener closes dialog
    ASTATE->>VSYNC: auth state changed to authenticated
  else Forgot password path
    U->>FORM: Click Forgot password
    FORM->>DSTORE: switch to forgot-password
    DSTORE->>DIALOG: render ForgotPasswordView
    U->>FORM: Submit email for reset
    FORM->>FORGOT: POST /api/auth/forgot-password
    FORGOT->>COG: cognitoForgotPassword(email)
    COG-->>FORGOT: reset code sent
    FORGOT-->>FORM: code-sent JSON
    U->>FORM: Submit code and new password
    FORM->>RESET: POST /api/auth/confirm-forgot-password
    RESET->>COG: cognitoConfirmForgotPassword(email, code, newPassword)
    COG-->>RESET: password reset complete
    RESET-->>FORM: password-reset JSON
    FORM->>DSTORE: switch to login
  else Hosted UI OAuth path
    U->>FORM: Click Continue with Google or Discord
    FORM->>POPUP: openOAuthPopup(provider path)
    alt Desktop popup
      POPUP->>LOGIN: window.open(provider path)
    else Mobile redirect
      POPUP->>POPUP: write eg_return cookie
      POPUP->>LOGIN: window.location = provider path
    end
    LOGIN->>COG: buildLoginRedirect() with state and PKCE cookies
    COG-->>CALLBACK: Redirect to /auth/callback with code and state
    CALLBACK->>CALLBACK: validate nonce and PKCE cookies
    CALLBACK->>COG: exchangeCodeForTokens(code, verifier)
    COG-->>CALLBACK: id token and refresh token
    CALLBACK->>JWT: verifyIdToken(id token)
    JWT-->>CALLBACK: uid and profile claims
    CALLBACK->>DDB: readVaultRev(uid)
    DDB-->>CALLBACK: current rev or 0
    alt Mobile return cookie exists
      CALLBACK-->>U: 302 back to validated return URL plus auth cookies
      U->>ME: next page bootstrap calls /api/auth/me
    else Desktop popup callback
      CALLBACK-->>POPUP: HTML postMessage plus auth cookies
      POPUP->>ME: hydrateAuth()
    end
    ME->>JWT: verifyIdToken(session cookie)
    JWT-->>ME: authenticated claims
    ME-->>ASTATE: authenticated session payload
    ASTATE->>DIALOG: close dialog
    ASTATE->>VSYNC: auth state changed to authenticated
  end

  opt Logout path
    U->>NAV: Click Sign out
    NAV->>LOGOUT: navigate to /logout
    LOGOUT-->>U: clear cookies and redirect to hosted logout
    U->>ME: next bootstrap calls /api/auth/me
    ME-->>ASTATE: guest session payload
  end

  Note over DDB,VSYNC: DynamoDB participation inside auth is limited to rev lookup for first-login detection. Full vault persistence is documented in vault.mmd and vault.md.
```

## Flow Notes

- Every GUI entry point converges on the same auth dialog store, so desktop and
  mobile triggers share one runtime path after the click.
- Email sign-in and Hosted UI OAuth both consult DynamoDB `rev` before the
  response returns. That lookup is used for first-login detection and later
  vault merge behavior.
- `/api/auth/me` is the rehydration boundary used by popup completion, mobile
  redirect completion, and general page bootstrap.
- Logout is a runtime route, not a client-only state reset. The client store may
  flip to guest immediately, but the durable boundary is still `/logout`.
- First-login merge behavior and ongoing compare persistence are expanded in
  [vault.md](./vault.md).
