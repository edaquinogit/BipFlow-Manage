# Production Go-Live Checklist

Use this checklist before accepting real storefront orders.

## Executable Check

Run after migrations and after configuring the production environment:

```powershell
python bipdelivery\manage.py check_go_live_readiness --strict
```

The command verifies:

- debug mode is disabled;
- host, CORS and CSRF allowlists are configured for HTTPS production domains;
- production storage choices are not local-only;
- at least one dashboard operator exists;
- store WhatsApp is configured;
- catalog has sellable products with stock;
- at least one active delivery region exists.

## Manual Smoke

1. Open the public storefront on the production domain.
2. Add an available product to the cart.
3. Choose an active delivery region.
4. Finish checkout.
5. Confirm the generated WhatsApp message opens for the store number.
6. Log in to the dashboard.
7. Confirm the order appears in recent sales.
8. Move the order status from `Novo` to `Enviado` or `Cancelado`.

## Operational Baseline

- PostgreSQL backup and restore path are known.
- Product images are persisted outside ephemeral container storage.
- Runtime logs are accessible to the operator.
- Secrets are injected by the deployment platform or secret manager.
- Rollback command or previous image tag is known before deploy.
