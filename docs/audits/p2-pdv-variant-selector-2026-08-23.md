# P2 - PDV Variant Selector

Date: 2026-08-23

## Context

P1 made inventory variant-aware across backend sales, cancellation restocks,
manual stock movements, labels, and theme settings. The deliberate frontend
gap left in P1 was the physical counter flow: the PDV cart refused
variant-managed products because the cashier could not choose the exact
variant to sell.

This P2 closes that operational gap without changing backend authority. Stock,
availability, price, and final validation remain enforced by the existing PDV
sale endpoint.

## Scope

- Add a PDV variant picker when a scanned product has active variants.
- Keep cart lines distinct by product plus variant.
- Show the selected variant in the PDV cart row.
- Send `variant_id` in the PDV sale payload for selected variants.
- Keep variant options with no available stock disabled.
- Preserve the previous product-only PDV flow for products without variants.

## Decisions

1. Product-level scan still uses `public_code`.

   The existing physical label/QR contract remains stable. A scan resolves the
   product, then the PDV asks for the variant only when the product has active
   variants.

2. Cart identity is now `product_id + variant_id`.

   This avoids merging two variants of the same product into one line and keeps
   the frontend payload aligned with backend stock movement traceability.

3. Backend remains the source of truth.

   The frontend uses last-known stock only for immediate cashier feedback. The
   final sale still goes through the atomic backend PDV validation implemented
   in P1.

4. No new migration in this slice.

   P1 already introduced `StockMovement.variant` and backend support for PDV
   sale items with `variant_id`.

## Acceptance Criteria

- Scanning a variant-managed product opens the variant picker instead of adding
  an unsafe product-level cart line.
- Selecting an active in-stock variant adds a PDV cart line with the variant
  name, color, image fallback, and variant stock limit.
- Different variants of the same product remain separate cart lines.
- Finalizing a selected variant sends `variant_id` to the PDV sale API.
- Existing product-only PDV scans, quantity controls, recent sales, receipt,
  camera scanner, and sale finalization keep working.
- Focus returns to the scan input after variant selection, quantity changes,
  removal, and modal close.

## Implemented In This Slice

- Updated `usePdvCart` so PDV lines have a stable `lineKey` based on
  `product_id:variant_id`.
- Added variant metadata to PDV cart lines: `variantId`, `variantName`, and
  `variantColorHex`.
- Added optional variant input to `cart.addProduct(product, quantity, variant)`.
- Added the PDV variant picker to `DashboardPdvView.vue`.
- Updated PDV cart quantity and removal actions to target exact line keys.
- Updated PDV sale payload creation to include `variant_id` only when selected.
- Added/updated unit tests for variant selection, separate variant lines, and
  sale payload preservation.

## Verification

- `npm run test:unit:run -- src/composables/__tests__/usePdvCart.spec.ts src/views/dashboard/__tests__/DashboardPdvView.spec.ts`
  - Result: 2 files passed, 56 tests passed.
- `npm run typecheck`
  - Result: passed.
- `npm run lint`
  - Result: passed.
- `npm run build`
  - Result: passed, with the existing Vite chunk-size warning.
- `.venv\Scripts\python.exe -m pytest bipdelivery\tests\test_pdv_sales.py -q`
  - Result: 27 passed.

## Remaining Follow-Ups

- Direct variant stock edits in the product form are now audited in
  `docs/audits/p3-variant-stock-ledger-2026-08-23.md`.
- Consider a future per-variant QR/label mode only if stores need labels that
  bypass the product-level variant picker.
