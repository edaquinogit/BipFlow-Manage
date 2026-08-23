# P1 - Inventory, Labels, Theme

Date: 2026-08-23
Branch: `fix/store-settings-tenant-scope`

## Objective

Finish the next reliability layer after the P0 tenant-isolation hardening:

- reliable stock when products have variants;
- tenant-scoped label configuration through `LabelSettings`;
- a controlled storefront theme engine instead of free-form theme JSON.

## Decisions

1. Variant-managed stock

   When a product has active variants, `ProductVariant.stock_quantity` is the
   source of truth for saleable inventory. `Product.stock_quantity` remains as
   a denormalized aggregate used by listings, filters, low-stock alerts, bot
   responses, and broad availability checks.

2. Ledger traceability

   `StockMovement` must be able to point to the affected variant. Manual
   product-level movement remains valid only for products without active
   variants. Variant-managed products require `variant_id` in manual stock
   adjustments, checkout/PDV sale movements, and cancellation restocks.

3. Labels are store settings, not app constants

   The old hardcoded A4 2x5 sheet stays as the default, but is formalized in a
   tenant-owned `LabelSettings` row. Label endpoints return the settings used
   to render the batch so the frontend can generate PDFs consistently per
   store.

4. Theme engine is allowlisted

   `Store.theme` remains a JSON column for now, but the API returns a
   normalized object with only supported color tokens and safe defaults. Extra
   keys or malformed colors are ignored rather than allowed to leak into CSS
   variables.

## Acceptance Criteria

- Creating/updating variants syncs the product aggregate stock.
- Manual stock movement for a product with active variants is rejected unless a
  valid variant from that product/store is supplied.
- Checkout and PDV sales persist `StockMovement.variant_id` when a variant is
  sold, and cancellation restocks the same variant.
- Bulk QR labels are still tenant-scoped and return the store's
  `LabelSettings` with backwards-compatible defaults.
- `StoreSerializer.theme` always returns the normalized theme shape.
- Tests document the contracts above.

## Explicit Non-Goals

- Removing the legacy singleton `StoreSettings`.
- Building a full visual theme editor in the dashboard.
- Replacing product QR labels with per-variant QR codes in this slice.

## Implemented In This Slice

- Added `LabelSettings` as a tenant-owned one-to-one model with A4 defaults.
- Added `StockMovement.variant` so inventory ledger rows can identify the
  variant actually moved.
- Synced `Product.stock_quantity` from active variants on product variant
  create/update and on manual variant stock movements.
- Updated manual stock movement to require `variant_id` for products with
  active variants.
- Updated WhatsApp checkout, PDV sales, and cancellation restock ledgers to
  persist variant-aware stock movements.
- Added `GET/PATCH /api/v1/store/mine/<slug>/label-settings/`.
- Added `GET/PATCH /api/v1/store/mine/<slug>/appearance/`.
- Updated bulk label responses to include the resolved store's label settings.
- Updated frontend label PDF/print rendering to use those settings with
  backwards-compatible defaults.
- Updated frontend PDV cart to refuse variant-managed products until the PDV UI
  can choose a variant, preventing an unsafe product-level sale.
- Added controlled theme normalization through `Store.normalize_theme()` and
  `StoreAppearanceSettingsSerializer`.

## Verification

- `python bipdelivery/manage.py makemigrations api` with project venv.
- `.venv\Scripts\python.exe bipdelivery\manage.py makemigrations --check --dry-run`
- `.venv\Scripts\python.exe bipdelivery\manage.py check`
- `.venv\Scripts\python.exe -m pytest bipdelivery/tests/test_stock_movements.py bipdelivery/tests/test_pdv_sales.py bipdelivery/tests/test_sale_order_cancellation.py bipdelivery/tests/test_product_qr_code_bulk.py bipdelivery/tests/test_store_onboarding.py bipdelivery/tests/test_api_health.py::CheckoutWhatsAppAPITest -q`
  - Result: 149 passed.
- `npm run test:unit:run -- src/composables/__tests__/usePdvCart.spec.ts src/views/dashboard/__tests__/DashboardPdvView.spec.ts src/components/dashboard/product-table/__tests__/BulkQrLabelsModal.spec.ts src/components/dashboard/product-table/__tests__/PdvSaleReceiptModal.spec.ts src/utils/__tests__/productLabelsPdf.spec.ts src/services/__tests__/store.service.spec.ts`
  - Result: 87 passed.
- `npm run typecheck`
- `npm run lint`

## Known Follow-Ups

- PDV variant selector completed in
  `docs/audits/p2-pdv-variant-selector-2026-08-23.md`.
- Direct variant stock edits in the product form are now audited in
  `docs/audits/p3-variant-stock-ledger-2026-08-23.md`.
