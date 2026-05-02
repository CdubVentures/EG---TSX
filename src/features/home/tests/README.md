# src/features/home/tests

## Purpose

`src/features/home/tests/` verifies slideshow and scroller behavior on the home
surface.

## Public API (The Contract)

- `scroller-markup.test.mjs`
- `slideshow-autoplay.test.mjs`
- `slideshow-deal.test.mjs`

## Dependencies

Allowed imports:

- Public home feature modules
- Node test APIs and fixtures

## Mutation Boundaries

- Tests may use isolated mocks and sample content only.

## Domain Invariants

- Home tests lock down merchandising behavior that is easy to regress visually.
