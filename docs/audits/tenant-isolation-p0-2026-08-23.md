# Tenant Isolation P0 - Execution Log

Date: 2026-08-23
Branch: `fix/store-settings-tenant-scope`

## Objective

Harden the first project stage before continuing feature work: no dashboard,
public storefront, or catalog bot path may reuse store A data when the resolved
request belongs to store B.

This document is intentionally operational. It records what changed, why it
changed, and which tests prove the current guarantee, so the next step can be
planned from evidence instead of memory.

## Scope

Included in this stage:

- Replace request-scoped usage of the legacy `StoreSettings` singleton with the
  resolved `Store` as source of truth for WhatsApp configuration.
- Keep the existing `/api/v1/store/settings/` payload shape for frontend
  compatibility while backing it with `Store.whatsapp_phone`.
- Ensure the public settings endpoint never falls back to another store's
  legacy singleton phone.
- Pass the resolved `Store` into the catalog bot engine and filter products,
  delivery regions, and human-handoff WhatsApp by that store.
- Add browser-level coverage for the shared-device handoff:
  operator A logs in, logs out, stale store A localStorage is present, then
  operator B logs in and resolves only store B.

Out of scope for this stage:

- Removing the `StoreSettings` model or migration history.
- Reworking all dashboard modules again; existing tenant-scoped viewsets remain
  covered by their current tests.
- PostgreSQL migration and production infrastructure changes.

## Architectural Decisions

1. `Store` is the tenant-scoped source of truth.

   `StoreSettings` remains a legacy compatibility contract for serializers and
   old migrations, but request-scoped behavior must not call `get_solo()`.

2. Dashboard settings are per resolved store.

   `GET /api/v1/store/settings/` now serializes a snapshot derived from the
   authenticated request's resolved store. `PATCH` updates only that store's
   `whatsapp_phone`.

3. Public settings do not cross-fallback.

   `GET /api/v1/store/settings/public/` returns the requested store phone (or
   the environment fallback from `Store.get_configured_whatsapp_phone()`), never
   a phone saved in the singleton for another store.

4. Bot replies are store-scoped by construction.

   `build_bot_reply(message, store)` receives the resolved store explicitly.
   Product suggestions, delivery-region replies, and WhatsApp handoff all use
   that same store.

5. Frontend store context treats persisted slugs as untrusted until membership
   is confirmed.

   The Cypress coverage preserves the contract that a stale
   `bipflow_selected_store_slug` must not be sent as `X-Store-Slug` during the
   next operator's first authenticated store-resolution request.

## Verification Matrix

Backend:

- `StoreSettingsAPITest`
  - public endpoint resolves requested store phone;
  - public endpoint ignores legacy singleton for non-default stores;
  - dashboard GET/PATCH are scoped to the authenticated store;
  - dashboard PATCH no longer creates or updates the singleton.
- `BotConversationStoreIsolationTest`
  - WhatsApp handoff uses the resolved store;
  - catalog replies show only products from the resolved store;
  - delivery replies show only delivery regions from the resolved store.

Frontend:

- Existing unit coverage keeps `store-scope`, `useCurrentStore`, and logout
  cleanup guarded.
- New Cypress spec:
  `bipflow-frontend/cypress/e2e/multi-tenant/dashboard-store-scope-handoff.cy.ts`

## Next Checkpoint

Before moving into the next project stage, keep this exit criterion green:

- Backend targeted tenant-isolation tests pass.
- Frontend unit tests for store scope/auth pass.
- Typecheck, lint, and production build pass.
- If backend and frontend dev servers are available, run the new Cypress spec
  against a migrated local database.

## Local E2E Notes

The Cypress spec was executed locally after clearing `ELECTRON_RUN_AS_NODE` for
the Cypress process. Without that override, Cypress' Electron binary starts as
Node and fails verification with `bad option: --smoke-test`.

The spec then reached the backend setup step but the local
`bipdelivery/db.sqlite3` file returned `500` on dashboard-owner registration.
Traceback cause: orphan `NOT NULL` columns on `api_store`
(`card_max_installments`, `card_min_installment_amount`,
`card_monthly_interest_rate`, `payment_card_link_url`,
`payment_pix_link_url`) that are not present in the current model or migration
files. The same registration path passes in pytest with a fresh migrated test
database, so do not drop those local columns automatically; run this Cypress
spec against a clean DB/staging DB or explicitly reconcile the local SQLite
schema first.

## Known Follow-Ups

- Audit any remaining direct calls to `StoreSettings.get_solo()` or
  `StoreSettings.get_configured_whatsapp_phone()` and classify each one as
  legacy/admin-only or tenant-risk.
- Decide when to formally deprecate the singleton model from user-facing paths.
- Add production smoke checks around public settings and bot replies once
  staging data has at least two active stores.
