# Routing and GUI

Validated against:

- `src/pages/**`
- `src/shared/layouts/MainLayout.astro`
- `src/shared/layouts/GlobalNav.astro`
- `src/shared/layouts/NavLinks.astro`
- `src/shared/layouts/NavIcons.astro`
- `src/shared/layouts/NavMobile.tsx`
- `src/features/auth/components/**`
- `src/features/home/components/**`
- `src/features/settings/components/**`
- `src/features/search/components/SearchDialog.tsx`
- `src/features/site-index/components/**`
- `src/features/notifications/store.ts`
- `src/features/notifications/vault-bridge.ts`
- `src/features/vault/components/VaultToggleButton.tsx`
- `src/features/vault/components/VaultDropdown.tsx`
- `src/features/vault/components/VaultCount.tsx`
- `src/features/notifications/components/**`

Local contracts:

- [../../src/pages/README.md](../../src/pages/README.md)
- [../../src/pages/api/README.md](../../src/pages/api/README.md)
- [../../src/shared/layouts/README.md](../../src/shared/layouts/README.md)
- [../../src/shared/ui/README.md](../../src/shared/ui/README.md)

## File-based routing

| Route file | User-visible URLs | Delivery mode | View assembly |
|---|---|---|---|
| [`src/pages/index.astro`](../../src/pages/index.astro) | `/` | Static HTML from S3 via CloudFront | Home landing page with mounted auth, search, settings, toast, and vault-aware catalog islands |
| [`src/pages/reviews/[...slug].astro`](../../src/pages/reviews/[...slug].astro) | `/reviews/`, `/reviews/page/{n}/`, `/reviews/{category}/`, `/reviews/{category}/page/{n}/` | Static HTML from S3 via CloudFront | `SiteIndexPage.astro` article index family |
| [`src/pages/guides/[...slug].astro`](../../src/pages/guides/[...slug].astro) | `/guides/`, `/guides/page/{n}/`, `/guides/{category}/`, `/guides/{category}/page/{n}/` | Static HTML from S3 via CloudFront | `SiteIndexPage.astro` article index family |
| [`src/pages/news/[...slug].astro`](../../src/pages/news/[...slug].astro) | `/news/`, `/news/page/{n}/`, `/news/{category}/`, `/news/{category}/page/{n}/` | Static HTML from S3 via CloudFront | `SiteIndexPage.astro` article index family |
| [`src/pages/brands/[...slug].astro`](../../src/pages/brands/[...slug].astro) | `/brands/`, `/brands/page/{n}/`, `/brands/{category}/`, `/brands/{category}/page/{n}/` | Static HTML from S3 via CloudFront | `IndexBleed.astro` plus `BrandBody.astro` |
| [`src/pages/games/[...slug].astro`](../../src/pages/games/[...slug].astro) | `/games/`, `/games/page/{n}/`, `/games/{genre}/`, `/games/{genre}/page/{n}/` | Static HTML from S3 via CloudFront | `IndexBleed.astro` plus `GamesBody.astro` (3×2 day-seeded dashboard + A–Z poster grid) |
| [`src/pages/login/google.ts`](../../src/pages/login/google.ts) | `/login/google` | Lambda | Redirect builder into Cognito Hosted UI |
| [`src/pages/login/discord.ts`](../../src/pages/login/discord.ts) | `/login/discord` | Lambda | Redirect builder into Cognito Hosted UI |
| [`src/pages/auth/callback.ts`](../../src/pages/auth/callback.ts) | `/auth/callback` | Lambda | OAuth callback, token exchange, cookie issuance |
| [`src/pages/logout.ts`](../../src/pages/logout.ts) | `/logout` | Lambda | Cookie clear plus hosted logout redirect |
| [`src/pages/api/search.ts`](../../src/pages/api/search.ts) | `/api/search` | Lambda | PostgreSQL-backed global search |
| [`src/pages/api/auth/me.ts`](../../src/pages/api/auth/me.ts) | `/api/auth/me` | Lambda | Session inspection and client hydration boundary |
| [`src/pages/api/auth/sign-in.ts`](../../src/pages/api/auth/sign-in.ts) | `/api/auth/sign-in` | Lambda | Email and password sign-in |
| [`src/pages/api/auth/sign-up.ts`](../../src/pages/api/auth/sign-up.ts) | `/api/auth/sign-up` | Lambda | Email and password registration |
| [`src/pages/api/auth/confirm-sign-up.ts`](../../src/pages/api/auth/confirm-sign-up.ts) | `/api/auth/confirm-sign-up` | Lambda | Email verification code confirmation |
| [`src/pages/api/auth/forgot-password.ts`](../../src/pages/api/auth/forgot-password.ts) | `/api/auth/forgot-password` | Lambda | Password reset code request |
| [`src/pages/api/auth/confirm-forgot-password.ts`](../../src/pages/api/auth/confirm-forgot-password.ts) | `/api/auth/confirm-forgot-password` | Lambda | Password reset completion |
| [`src/pages/api/auth/resend-code.ts`](../../src/pages/api/auth/resend-code.ts) | `/api/auth/resend-code` | Lambda | Verification code resend |
| [`src/pages/api/user/vault.ts`](../../src/pages/api/user/vault.ts) | `/api/user/vault` | Lambda | Authenticated vault read and write |
| [`src/pages/api/vault/thumbs.ts`](../../src/pages/api/vault/thumbs.ts) | `/api/vault/thumbs` | Lambda | Thumbnail normalization for vault entries |
| [`src/pages/api/admin/db-setup.ts`](../../src/pages/api/admin/db-setup.ts) | `/api/admin/db-setup` | Lambda | Operator schema bootstrap |
| [`src/pages/api/admin/db-sync.ts`](../../src/pages/api/admin/db-sync.ts) | `/api/admin/db-sync` | Lambda | Operator content mirror sync |
| [`src/pages/robots.txt.ts`](../../src/pages/robots.txt.ts) | `/robots.txt` | Lambda | Dynamic robots response |
| [`src/pages/404.astro`](../../src/pages/404.astro) | Fallback 404 | Static HTML from S3 via CloudFront | Static not-found page |

## Navigation Surface Map

| Surface | Desktop entry points | Mobile entry points | Primary files | Notes |
|---|---|---|---|---|
| Global shell | Top bar, mega menus, auth/search/settings icons | Hamburger drawer plus shared icon cluster | [`MainLayout.astro`](../../src/shared/layouts/MainLayout.astro), [`GlobalNav.astro`](../../src/shared/layouts/GlobalNav.astro), [`NavLinks.astro`](../../src/shared/layouts/NavLinks.astro), [`NavIcons.astro`](../../src/shared/layouts/NavIcons.astro), [`NavMobile.tsx`](../../src/shared/layouts/NavMobile.tsx) | MainLayout owns the shared shell and mounts the interactive islands |
| Auth | `Log in`, `Sign Up`, account dropdown, hosted provider buttons | Drawer auth footer plus shared dialog | [`NavIcons.astro`](../../src/shared/layouts/NavIcons.astro), [`NavMobile.tsx`](../../src/shared/layouts/NavMobile.tsx), [`AuthDialog.tsx`](../../src/features/auth/components/AuthDialog.tsx) | All entry points converge on the same auth store and dialog island |
| Search | Search icon and `Ctrl` or `Cmd` plus `K` shortcut | Search icon in shared top bar | [`NavIcons.astro`](../../src/shared/layouts/NavIcons.astro), [`SearchDialog.tsx`](../../src/features/search/components/SearchDialog.tsx) | Search closes account and settings popups before opening |
| Settings | Settings icon in the desktop nav cluster | No dedicated mobile trigger was verified | [`NavIcons.astro`](../../src/shared/layouts/NavIcons.astro), [`SettingsDialog.tsx`](../../src/features/settings/components/SettingsDialog.tsx), [`SettingsPanel.tsx`](../../src/features/settings/components/SettingsPanel.tsx) | Theme is device-scoped; hub preferences are uid-scoped `localStorage` only in this snapshot |
| Vault and compare | Vault mega menu, desktop count badge, compare toggles on product cards | Vault mobile icon plus the same compare toggles on responsive cards | [`NavLinks.astro`](../../src/shared/layouts/NavLinks.astro), [`NavIcons.astro`](../../src/shared/layouts/NavIcons.astro), [`VaultDropdown.tsx`](../../src/features/vault/components/VaultDropdown.tsx), [`VaultCount.tsx`](../../src/features/vault/components/VaultCount.tsx), [`VaultToggleButton.tsx`](../../src/features/vault/components/VaultToggleButton.tsx) | Guest state stays local; authenticated state syncs through `/api/user/vault` |
| Notifications | No direct nav trigger was verified | No direct mobile trigger was verified | [`MainLayout.astro`](../../src/shared/layouts/MainLayout.astro), [`ToastContainer.tsx`](../../src/features/notifications/components/ToastContainer.tsx), [`VaultToast.tsx`](../../src/features/notifications/components/VaultToast.tsx), [`vault-bridge.ts`](../../src/features/notifications/vault-bridge.ts) | Toasts are generated indirectly from vault actions and have no dedicated history screen |
| Catalog browse | Home hero shortcuts, mega menu links, index pages, slideshow, site-index cards | Drawer links, home tiles, responsive cards | [`HomeHero.astro`](../../src/features/home/components/HomeHero.astro), [`TopProducts.astro`](../../src/features/home/components/TopProducts.astro), [`HomeSlideshow.astro`](../../src/features/home/components/HomeSlideshow.astro), [`SiteIndexPage.astro`](../../src/features/site-index/components/SiteIndexPage.astro), [`BrandBody.astro`](../../src/features/site-index/components/BrandBody.astro) | Browse pages are static; compare persistence becomes dynamic through the vault APIs |

## Navigation Contracts Beyond Route Files

These URL contracts are validated link emissions in the current source tree. The
"no local route file" statement below is an inference from `src/pages/**` only.

| URL contract | Source files | Current interpretation |
|---|---|---|
| `/games/{slug}` | [`NavLinks.astro`](../../src/shared/layouts/NavLinks.astro), [`NavMobile.tsx`](../../src/shared/layouts/NavMobile.tsx), [`HomeHero.astro`](../../src/features/home/components/HomeHero.astro) | Single-game detail URL — no local route file in this snapshot (`/games/` index is implemented in `src/pages/games/[...slug].astro`) |
| `/hubs` and `/hubs/{category}` | [`NavLinks.astro`](../../src/shared/layouts/NavLinks.astro), [`NavMobile.tsx`](../../src/shared/layouts/NavMobile.tsx), [`HomeHero.astro`](../../src/features/home/components/HomeHero.astro), [`TopProducts.astro`](../../src/features/home/components/TopProducts.astro) | Navigation contract exists, but no local `src/pages/hubs/**` route file exists in this snapshot |
| `/hubs/{category}/{brandSlug}/{modelSlug}` | [`HomeSlideshow.astro`](../../src/features/home/components/HomeSlideshow.astro), [`src/pages/api/search.ts`](../../src/pages/api/search.ts), [`url-contract.ts`](../../src/core/seo/url-contract.ts) | Helper-generated product detail URL with no local route file in this snapshot |
| `/{collection}/{entryId}` | [`src/pages/api/search.ts`](../../src/pages/api/search.ts), [`article-helpers.ts`](../../src/core/article-helpers.ts) | Helper-generated editorial detail URL with no local route file in this snapshot |
| `/account` | [`NavIcons.astro`](../../src/shared/layouts/NavIcons.astro), [`NavMobile.tsx`](../../src/shared/layouts/NavMobile.tsx) | Linked account surface with no local route file in this snapshot |
| `/about` | [`NavMobile.tsx`](../../src/shared/layouts/NavMobile.tsx) | Linked drawer destination with no local route file in this snapshot |

## Global Shell

```text
MainLayout.astro
- GlobalNav.astro
  - NavMobile.tsx
  - NavLogo.astro
  - NavLinks.astro
  - NavIcons.astro
  - SearchDialog.tsx
- AuthDialog.tsx
- SettingsDialog.tsx
- main slot
- SiteFooter.astro
- ToastContainer.tsx
```

MainLayout also bootstraps:

- auth hydration through `/api/auth/me`
- vault sync initialization
- vault notification bridge
- settings and theme loading
- ads bootstrap

## Home View Hierarchy

`/` is assembled by [`src/pages/index.astro`](../../src/pages/index.astro):

```text
MainLayout.astro
- AnnouncementBar.astro
- top rail
  - HomeHero.astro
  - TopProducts.astro
    - SectionDivider.astro
    - CategoryDropdown.tsx
    - HomeSlideshow.astro
      - slideshow-carousel.ts
      - VaultToggleButton.tsx mounts on slideshow compare slots
- dashboard rail
  - Dashboard.astro
  - AdSlot.astro
- mid rail
  - GamesScroller.astro
  - FeaturedScroller.astro for reviews
  - AdSlot.astro
- lower rail
  - FeaturedScroller.astro for guides
  - LatestNews.astro
```

Detailed request and hydration flow: [Home](../04-features/home.md).

## Auth Surface

Primary files:

- [`NavIcons.astro`](../../src/shared/layouts/NavIcons.astro)
- [`NavMobile.tsx`](../../src/shared/layouts/NavMobile.tsx)
- [`AuthDialog.tsx`](../../src/features/auth/components/AuthDialog.tsx)
- [`LoginView.tsx`](../../src/features/auth/components/LoginView.tsx)
- [`SignupView.tsx`](../../src/features/auth/components/SignupView.tsx)
- [`ConfirmSignupView.tsx`](../../src/features/auth/components/ConfirmSignupView.tsx)
- [`ForgotPasswordView.tsx`](../../src/features/auth/components/ForgotPasswordView.tsx)

Hierarchy:

```text
NavIcons.astro
- login-nav-icon -> openLogin()
- signup-nav-icon -> openSignup()
- account dropdown -> /account and /logout

NavMobile.tsx
- footer auth link -> openLogin()
- account link -> /account

AuthDialog.tsx
- LoginView.tsx
- SignupView.tsx
- ConfirmSignupView.tsx
- ForgotPasswordView.tsx
```

## Search Surface

Primary files:

- [`NavIcons.astro`](../../src/shared/layouts/NavIcons.astro)
- [`SearchDialog.tsx`](../../src/features/search/components/SearchDialog.tsx)
- [`src/features/search/store.ts`](../../src/features/search/store.ts)

Hierarchy:

```text
NavIcons.astro
- search-nav-icon click
- global Ctrl or Cmd plus K shortcut

search/store.ts
- openSearch()
- closeSearch()

SearchDialog.tsx
- query input
- 300ms debounce
- AbortController cancellation
- keyboard navigation
- result link list
```

## Settings Surface

Primary files:

- [`NavIcons.astro`](../../src/shared/layouts/NavIcons.astro)
- [`SettingsDialog.tsx`](../../src/features/settings/components/SettingsDialog.tsx)
- [`SettingsPanel.tsx`](../../src/features/settings/components/SettingsPanel.tsx)
- [`store.ts`](../../src/features/settings/store.ts)

Hierarchy:

```text
NavIcons.astro
- settings-nav-icon click -> openSettings()

settings/store.ts
- $settingsDialog
- $userPrefs
- $theme
- loadPrefs()
- loadTheme()
- setPref()
- setTheme()

SettingsDialog.tsx
- native dialog shell
- loadPrefs() on open
- showModal() and close animation

SettingsPanel.tsx
- theme segmented control
- hub preference toggle and radio groups
- guest CTA -> openSignup() or openLogin()
```

## Vault Surface

Primary files:

- [`NavLinks.astro`](../../src/shared/layouts/NavLinks.astro)
- [`NavIcons.astro`](../../src/shared/layouts/NavIcons.astro)
- [`VaultDropdown.tsx`](../../src/features/vault/components/VaultDropdown.tsx)
- [`VaultCount.tsx`](../../src/features/vault/components/VaultCount.tsx)
- [`VaultToggleButton.tsx`](../../src/features/vault/components/VaultToggleButton.tsx)
- [`sync.ts`](../../src/features/vault/sync.ts)
- [`ToastContainer.tsx`](../../src/features/notifications/components/ToastContainer.tsx)

Hierarchy:

```text
NavLinks.astro
- desktop vault menu shell
  - VaultCount.tsx
  - VaultDropdown.tsx

NavIcons.astro
- mobile vault icon
  - VaultCount.tsx

Product cards
- VaultToggleButton.tsx
  - addToVault() or removeFromVault()
  - emitVaultAction()

MainLayout.astro
- initVaultSync()
- initVaultBridge()
- ToastContainer.tsx
```

The vault-to-toast handoff is expanded in [Notifications](../04-features/notifications.md).

## Notification Surface

Primary files:

- [`MainLayout.astro`](../../src/shared/layouts/MainLayout.astro)
- [`src/features/notifications/store.ts`](../../src/features/notifications/store.ts)
- [`src/features/notifications/vault-bridge.ts`](../../src/features/notifications/vault-bridge.ts)
- [`ToastContainer.tsx`](../../src/features/notifications/components/ToastContainer.tsx)
- [`VaultToast.tsx`](../../src/features/notifications/components/VaultToast.tsx)
- [`src/features/vault/vault-action.ts`](../../src/features/vault/vault-action.ts)

Hierarchy:

```text
MainLayout.astro
- initVaultBridge()
- ToastContainer.tsx
  - notifications/store.ts
  - VaultToast.tsx

VaultToggleButton.tsx and vault/store.ts
- emitVaultAction()
  - vault-bridge.ts
    - notify()
```

## Catalog Surface

Primary files:

- [`HomeHero.astro`](../../src/features/home/components/HomeHero.astro)
- [`TopProducts.astro`](../../src/features/home/components/TopProducts.astro)
- [`CategoryDropdown.tsx`](../../src/features/home/components/CategoryDropdown.tsx)
- [`HomeSlideshow.astro`](../../src/features/home/components/HomeSlideshow.astro)
- [`slideshow-carousel.ts`](../../src/features/home/slideshow-carousel.ts)
- [`VaultToggleButton.tsx`](../../src/features/vault/components/VaultToggleButton.tsx)
- [`SiteIndexPage.astro`](../../src/features/site-index/components/SiteIndexPage.astro)
- [`IndexBleed.astro`](../../src/features/site-index/components/IndexBleed.astro)
- [`IndexBody.astro`](../../src/features/site-index/components/IndexBody.astro)
- [`BrandBody.astro`](../../src/features/site-index/components/BrandBody.astro)
- [`CategorySidebar.astro`](../../src/features/site-index/components/CategorySidebar.astro)
- [`FeedVertical.astro`](../../src/features/site-index/components/FeedVertical.astro)

Hierarchy by surface:

```text
TopProducts.astro
- SectionDivider.astro
- CategoryDropdown.tsx
- HomeSlideshow.astro
  - slideshow-carousel.ts
  - VaultToggleButton.tsx mounts on slideshow compare controls

SiteIndexPage.astro
- IndexBleed.astro
- IndexBody.astro
  - CategorySidebar.astro
  - FeedVertical.astro

brands/[...slug].astro
- IndexBleed.astro
- BrandBody.astro
  - CategorySidebar.astro
  - FeedHeader.astro
  - BrandCard.astro
  - Pagination.astro
```

Static browse and compare persistence are expanded in [Catalog](../04-features/catalog.md).

## Delivery Split

- Home plus the reviews, guides, news, and brands index families are prerendered
  and served from S3 behind CloudFront.
- Auth, search, vault sync, logout, and admin DB routes are Lambda-backed.
- Catalog filtering on the home slideshow is client-side and does not hit a
  database by itself.
- Catalog compare persistence becomes database-backed only when the current
  persona is authenticated and `vault/sync.ts` pushes to `/api/user/vault`.
