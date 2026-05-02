# src/features/auth/components

## Purpose

`src/features/auth/components/` contains the client auth dialog and its
supporting views/icons.

## Public API (The Contract)

- `AuthDialog.tsx`
- `LoginView.tsx`
- `SignupView.tsx`
- `ConfirmSignupView.tsx`
- `ForgotPasswordView.tsx`
- `BrandLogo.tsx`
- `GoogleIcon.tsx`
- `auth-ui.tsx`

## Dependencies

Allowed imports:

- Public auth stores and schemas from `../`
- `@shared/*`
- React and browser APIs

## Mutation Boundaries

- May update local form/UI state and dispatch public auth actions.
- Must not own server-side Cognito or cookie logic.

## Domain Invariants

- Components stay client-facing; auth protocol and token rules stay in
  `../server/`.
