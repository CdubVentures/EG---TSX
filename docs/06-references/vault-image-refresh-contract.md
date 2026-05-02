# Vault Image Refresh Contract

> **Status:** Active
> **Last updated:** 2026-03-05
> **Related:** [`DATA-IMAGE-CONTRACT.md`](DATA-IMAGE-CONTRACT.md) | [`DATA-GATEWAY-CONTRACT.md`](DATA-GATEWAY-CONTRACT.md)

---

## Why This Exists

Vault entries are a cached snapshot of product display data. Product media can change over time (new default color, new edition, corrected stems), so vault snapshots must be repaired from live product media on a schedule.

Without this contract, stale entries can point at non-existent files like `top_t.webp` when the real default is color/edition-specific (for example `top---white+black_t.webp`).

---

## Global Source of Truth

1. **Photoshop export naming (`webp-all-options.jsx`)**
2. **Filesystem scan to media schema (`scripts/build-media.mjs`)**
3. **Product JSON `media` object (`defaultColor`, `defaultEdition?`, `colors`, `editions`, `images[]`)**
4. **Runtime resolver (`getImageWithFallback(media, imageDefaults(category).defaultImageView)`)**
5. **Vault cache snapshot (`VaultEntry.product`)**
6. **TTL refresh pipeline (`/api/vault/thumbs`)**

Rule: vault `thumbnailStem` is a cache, never the canonical source.

---

## Naming Contract (Color + Edition)

- Base view: `top`
- Color variant: `top---white+black`
- Edition + color variant: `top___cyberpunk-2077-edition---black+red`

Separators:
- `___` means edition
- `---` means color

This naming is parsed into `media.images[]` by `build-media.mjs`.

---

## When Product JSON Media Is Updated

`media` is updated when:

1. New image files are exported/renamed in `public/images/...`
2. `node scripts/build-media.mjs --scan-only` is run
3. Product JSON is rewritten with updated:
   - `media.defaultColor`
   - `media.colors`
   - `media.editions`
   - `media.images`

Rule: if images changed on disk and `build-media` was not run, runtime defaults can be wrong.

---

## Vault Snapshot Contract

Canonical vault identity:
- `VaultEntry.productId`
- `VaultEntry.category`

Cached display snapshot:
- `VaultEntry.product` (brand/model/imagePath/thumbnailStem)

The snapshot may become stale. It must be refreshed from live product media.

---

## Refresh Contract

Client module: `src/features/vault/sync.ts`

1. Build request from current entries (`requestId`, `category`)
2. POST to `/api/vault/thumbs`
3. Resolve current product + thumbnail stem server-side from live `media` + defaults
4. Apply resolved result back into vault entries
5. Persist updated vault snapshot
6. Store refresh timestamp per persona scope

TTL key:
- `eg-vault-thumbs-refresh:v2:<scope>`

Default TTL:
- 1 hour

Refresh triggers:
- vault sync init
- auth transitions (guest/authenticated)
- visibility regain (`document.visibilitychange`)

---

## Why `sangle` Can Still Show Even When `top/right` Exist

Fallback chain logic (`right -> top -> left -> sangle` for mouse) is only used when resolver code runs.

If a vault snapshot already has `thumbnailStem: "sangle---..."` and that file exists, the UI will render it directly (no network error, so no `<img onError>` fallback).

That is why stale snapshot data can keep showing `sangle` until `/api/vault/thumbs` refresh rewrites the cached stem.

---

## Request ID Alias Resolution (Stale Vault Compatibility)

`/api/vault/thumbs` now resolves products from multiple ID shapes so legacy vault entries are repairable:

- `product.id`
- data `slug`
- `category/slug`
- `category/brand/slug`
- `slug` alone (path slug)
- `brand/slug`
- `hubs/category/brand/slug` and `/hubs/category/brand/slug`
- `url` field variants (with and without leading slash)
- request IDs passed as full URLs (origin/query stripped)

---

## API Contract: `/api/vault/thumbs`

Request:

```json
{
  "items": [
    { "requestId": "mouse/alienware/aw610m", "category": "mouse" }
  ]
}
```

Response:

```json
{
  "items": [
    {
      "requestId": "mouse/alienware/aw610m",
      "productId": "alienware-aw610m",
      "category": "mouse",
      "slug": "aw610m",
      "brand": "Alienware",
      "model": "AW610M",
      "imagePath": "/images/mouse/alienware/aw610m",
      "thumbnailStem": "top---white+black"
    }
  ]
}
```

`thumbnailStem` must come from current live resolver logic, not from vault storage.

---

## Developer Checklist

When images/defaults look wrong:

1. Confirm file naming uses `___edition` and `---color` correctly.
2. Confirm files exist for required size suffixes (`_t.webp` for vault dropdown, `_xs.webp` for vault toast).
3. Run `node scripts/build-media.mjs --scan-only`.
4. Check product JSON `media.defaultColor` and `media.images`.
5. Confirm category `defaultImageView` chain in `config/data/image-defaults.json`.
6. Confirm `/api/vault/thumbs` returns expected `thumbnailStem`.
7. Confirm vault refresh TTL key is advancing in localStorage.
8. Verify `tryImageFallback()` onError is wired on vault image elements (VaultDropdown + VaultToast).
9. If all fallback views 404, confirm the EG logo SVG placeholder appears (global handler, not browser error icon).

---

## Runtime Image Error Fallback (`tryImageFallback`)

Even after the vault refresh pipeline resolves the best `thumbnailStem`, the actual image file can still fail at runtime (CDN outage, deleted file, cache miss). Both vault UI components use `tryImageFallback()` from `src/core/images.ts` to walk the category's `defaultImageView` chain on each `<img>` error:

| Component | Size suffix | Import |
|-----------|-------------|--------|
| `VaultDropdown.tsx` | `_t` (300px thumbnail) | `import { tryImageFallback } from '@core/images'` |
| `VaultToast.tsx` | `_xs` (200px toast thumbnail) | `import { tryImageFallback } from '@core/images'` |

**Behavior:** On each error, `tryImageFallback` tries the next view in the chain (e.g. `right → top → left → sangle` for mouse). When the chain is exhausted, the global broken-image handler (MainLayout capture-phase listener) shows the EG logo SVG placeholder.

**This is separate from the refresh pipeline.** The refresh pipeline updates `thumbnailStem` in localStorage to match current media defaults. `tryImageFallback` handles runtime load failures for whatever stem is currently stored.

---

## Non-Negotiable Rule

Do not hardcode vault fallback stems globally to `top`.

Always resolve default stems through:
- product `media`
- category image defaults fallback chain
- runtime resolver (`getImageWithFallback`)
- runtime error handler (`tryImageFallback` in React `onError`)
