# Z-Index Map

> Canonical reference for every z-index layer in EG-TSX.
> Update this file whenever a z-index is added, removed, or changed.
>
> **Last audited:** 2026-03-04

---

## Layer Stack (high to low)

```
 LAYER                 Z-INDEX    POSITION    STACKING CONTEXT
 ─────────────────────────────────────────────────────────────────
 <dialog> (top layer)   (auto)    browser     Top Layer (above all z-index)
 Account dropdown       99560     fixed       Viewport
 ─── mobile nav group ──────────────────────────────────────────
 Side menu drawer       97525     absolute    mainNav
 Shade overlay          97500     fixed       Viewport
 ─── navbar group ──────────────────────────────────────────────
 Navbar (mainNav)       95000     fixed       Viewport
 Top bar (≤825px)       95000     (inherits)  Viewport
 ─── dropdown group ────────────────────────────────────────────
 Mega menus (desktop)   94000     absolute    mainNav
 Vault menu (mobile)    94000     fixed       Viewport (moved to <body>)
 ─── local contexts ────────────────────────────────────────────
 Auth close button      10        absolute    <dialog> top layer
 Side auth footer       2         relative    Side menu drawer
```

---

## Detailed Reference

### Top Layer (browser-managed)

| Element | Selector | File | Notes |
|---------|----------|------|-------|
| Auth dialog | `<dialog>` | `src/features/auth/components/AuthDialog.tsx` | Uses native `<dialog>` — rendered in the browser's **top layer**, which sits above all z-index stacking contexts. No z-index needed. `::backdrop` is also in the top layer. |

### 99560 — Account Dropdown

| Element | Selector | File | Line |
|---------|----------|------|------|
| Account dropdown | `.account-dropdown` | `src/shared/layouts/NavIcons.astro` | 270 |

- **Position:** `fixed` — escapes the navbar stacking context entirely
- **Trigger:** Hover/click on "My Account" icon (visible when logged in)
- **WHY 99560:** Must float above everything including the mobile side menu (97525). Sits in the viewport's stacking context, not inside the navbar.

### 97525 — Mobile Side Menu

| Element | Selector | File | Line |
|---------|----------|------|------|
| Side menu drawer | `.side-menu` | `src/styles/global.css` | 857 |

- **Position:** `absolute` (relative to `mainNav`)
- **Trigger:** Hamburger icon click (≤1150px)
- **WHY 97525:** Above the shade overlay (97500) but inside the navbar's stacking context (95000). Since it's a child of `mainNav`, its effective layer in the viewport is 95000 + 97525 within that context.

### 97500 — Shade Overlay

| Element | Selector | File | Line |
|---------|----------|------|------|
| Shade overlay | `.shade-overlay` | `src/styles/global.css` | 993 |

- **Position:** `fixed` — covers viewport
- **Trigger:** Side menu open (≤1150px)
- **Background:** `rgba(0, 0, 0, 0.5)` — 50% black
- **WHY 97500:** Below side menu (97525) so the drawer paints on top of the dimmed backdrop. `pointer-events: none` when closed, `pointer-events: all` when active (click to dismiss).

### 95000 — Navbar

| Element | Selector | File | Line |
|---------|----------|------|------|
| Main navbar | `.mainNav` | `src/shared/layouts/GlobalNav.astro` | 187 |
| Top bar (mobile) | `.top-bar` | `src/shared/layouts/GlobalNav.astro` | 249 |

- **CSS variable:** `--nav-z: 95000` (defined in `src/styles/global.css:289`)
- **Position:** `fixed` at top of viewport
- **Creates stacking context:** Yes — all children (mega menus, side menu) paint within this context
- **WHY 95000:** Must be above page content but below overlays (shade, account dropdown). The vault mega-menu (94000) is moved to `<body>` on mobile so it paints BELOW the navbar, creating the "slide from under" effect.

### 94000 — Mega Menus / Vault

| Element | Selector | File | Line |
|---------|----------|------|------|
| Desktop mega menus | `.mega-menu` | `src/shared/layouts/NavLinks.astro` | 925 |
| Vault menu (mobile) | `.mega-menu-vault` | `src/shared/layouts/NavLinks.astro` | 2113 |

- **Position (desktop):** `absolute` — positioned below the nav link that triggered it
- **Position (mobile vault):** `fixed` — moved to `<body>` via JS to escape navbar stacking context
- **WHY 94000:** Below navbar (95000) so the navbar covers the top edge of menus. On desktop this is invisible (menus drop below the bar). On mobile, the vault slides down from behind the navbar.

### 10 — Auth Dialog Close Button

| Element | Selector | File | Line |
|---------|----------|------|------|
| Close button (x) | Tailwind `z-10` | `src/features/auth/components/AuthDialog.tsx` | 83 |

- **Position:** `absolute` (top-right of dialog)
- **Context:** Inside `<dialog>` top layer — this z-index is local to the dialog, not the page
- **WHY 10:** Ensures the close button stays clickable above dialog content (form fields, text)

### 2 — Side Auth Footer

| Element | Selector | File | Line |
|---------|----------|------|------|
| Auth footer | `.side-auth-footer` | `src/styles/global.css` | 1012 |

- **Position:** Default (`relative` via flex)
- **Context:** Inside `.side-menu` — local to the drawer
- **WHY 2:** Keeps the "Join for free" / "My Profile" button above the scrolling menu content via `box-shadow` overlap

---

## Rules for Adding New Z-Indices

1. **Pick from the existing bands.** Don't invent a new tier unless no band fits.
2. **Document here first.** Add the entry to this file before writing the CSS.
3. **Respect stacking contexts.** A child of `mainNav` (z-index 95000) can't escape its parent's context unless it uses `position: fixed` AND is moved outside the DOM tree (like the mobile vault).
4. **Use CSS variables for shared values.** If multiple selectors share a z-index, define a `--z-*` variable in `global.css`.
5. **Avoid Tailwind arbitrary z-index** (`z-[99999]`). Use the documented bands.

### Band Allocation

| Band | Range | Purpose |
|------|-------|---------|
| **Top layer** | (auto) | Native `<dialog>`, `popover` — managed by browser |
| **Overlays** | 99000–99999 | Account dropdown, search overlay, settings popup |
| **Mobile nav** | 97000–97999 | Side menu, shade overlay |
| **Navbar** | 95000 | Fixed header bar |
| **Dropdowns** | 94000–94999 | Mega menus, vault, tooltips anchored to navbar |
| **Page-level** | 1000–9999 | Sticky headers, floating action buttons, toasts |
| **Component-local** | 1–100 | Internal layering (close buttons, badges, overlapping elements) |
