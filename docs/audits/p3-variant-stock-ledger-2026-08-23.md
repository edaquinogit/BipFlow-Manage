# P3 - Variant Stock Ledger From Product Form

Date: 2026-08-23

## Context

P1 made `ProductVariant.stock_quantity` the stock authority for products with
active variants. P2 allowed the physical PDV to sell those variants while
preserving `variant_id` in the sale payload. One remaining inventory risk was
the product form: direct edits to a variant's stock changed the saleable
aggregate but did not create a `StockMovement` row.

This slice closes that gap.

## Decision

Variant stock changes made through `variants_payload` are audited.

- On product creation, new variants with stock greater than zero generate
  variant-scoped `entrada_inicial` movements.
- On product update, existing or newly added variants whose stock changes
  generate `ajuste_inventario` movements.
- The movement direction is derived from the delta:
  - stock increase -> `entrada`;
  - stock decrease -> `saida`.
- Metadata-only variant updates do not create stock movements.
- Product-level initial stock movement is skipped when the product has active
  variants, avoiding duplicate aggregate ledger rows.

## Implemented In This Slice

- Added variant stock movement recording inside `ProductSerializer._sync_variants`.
- Associated form-driven stock movements with `request.user` as `performed_by`.
- Preserved aggregate product stock sync from active variants.
- Updated `ProductViewSet.perform_create` so variant-managed products rely on
  variant-level initial movements instead of a duplicate product-level entry.
- Added backend tests for initial variant ledger rows, inventory adjustments,
  decreases, and metadata-only updates.

## Acceptance Criteria

- Creating a variant-managed product with stocked variants creates one
  `StockMovement` per stocked variant.
- Updating a variant from 5 to 8 creates an `entrada` of 3 with
  `reason=ajuste_inventario`.
- Updating a variant from 5 to 2 creates a `saida` of 3 with
  `reason=ajuste_inventario`.
- Omitting `stock_quantity` in a legacy variant metadata payload preserves the
  current stock and creates no movement.
- Product aggregate stock remains synchronized from active variants.

## Verification

- `.venv\Scripts\python.exe -m pytest bipdelivery\tests\test_api_health.py::ProductAPIHealthTest bipdelivery\tests\test_stock_movements.py::StockMovementAPITest -q`
  - Result: 44 passed.
- `.venv\Scripts\python.exe -m black --check bipdelivery\api\serializers.py bipdelivery\api\views.py bipdelivery\tests\test_api_health.py`
  - Result: passed.
- `.venv\Scripts\python.exe bipdelivery\manage.py makemigrations --check --dry-run`
  - Result: no changes detected.
- `.venv\Scripts\python.exe bipdelivery\manage.py check`
  - Result: passed.
- `.venv\Scripts\python.exe -m pytest bipdelivery\tests\test_api_health.py::ProductAPIHealthTest bipdelivery\tests\test_stock_movements.py bipdelivery\tests\test_pdv_sales.py bipdelivery\tests\test_sale_order_cancellation.py -q`
  - Result: 93 passed.
- `git diff --check`
  - Result: passed; Git only reported expected LF/CRLF working-copy warnings on Windows.

## Remaining Follow-Ups

- Define a stricter business rule for deleting stocked variants from the
  product form. Current stock edits are audited, but deleting a variant is a
  separate lifecycle decision because the `StockMovement.variant` foreign key
  is intentionally nullable and would be cleared after the variant row is
  removed.
- Consider whether the dashboard should route all variant stock changes through
  the dedicated stock movement modal instead of inline numeric fields.
