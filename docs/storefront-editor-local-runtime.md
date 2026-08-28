# Storefront Editor Local Runtime

## Symptom

The storefront editor code is updated in the workspace, but the local browser
or local database appears not to reflect the changes.

## What To Check First

```powershell
Invoke-WebRequest -UseBasicParsing "http://localhost:5173/src/components/dashboard/settings/StorefrontAppearanceTab.vue?raw" |
  Select-Object -ExpandProperty Content |
  Select-String "storefront-promotion-drawer"
```

If this returns a match, Vite is serving the current source code. The issue is
not an old frontend bundle.

Check which database the backend process is using:

```powershell
.venv\Scripts\python.exe bipdelivery\manage.py shell -c "from django.conf import settings; print(settings.DATABASES['default']['NAME'])"
```

## Finding From This Workspace

During the premium storefront editor validation, `localhost:5173` was serving
the updated Vue source, including the new promotion drawer.

The backend left running for validation used an isolated E2E runtime:

```text
DJANGO_SETTINGS_MODULE=e2e_settings
.codex-tmp/e2e-runtime/db.sqlite3
```

The normal local settings use:

```text
bipdelivery/db.sqlite3
```

That normal SQLite file contains old columns on `api_saleorder`, including
`payment_display_code`, `payment_instructions`, `payment_reference`,
`payment_status`, `payment_installment_amount`, `payment_installment_total`,
`payment_installments`, and `payment_link_url`. These columns are not present
in the current model/migration contract, so the local database is stale relative
to the code.

This explains two confusing behaviors:

- Saving through the currently running backend writes into the isolated E2E
  database, not the normal local database.
- Running the normal local backend against `bipdelivery/db.sqlite3` can produce
  behavior that does not match the current code because the schema carries old
  columns.

## Clean Local Reset

Use this only when preserving the current local SQLite data is not required.
The first command makes a backup.

```powershell
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
Copy-Item bipdelivery\db.sqlite3 "bipdelivery\db.sqlite3.backup-$stamp"
Remove-Item bipdelivery\db.sqlite3
.venv\Scripts\python.exe bipdelivery\manage.py migrate --noinput
.venv\Scripts\python.exe bipdelivery\manage.py seed_dashboard_roles --email admin@example.com --password <senha-local> --staff --role admin
.venv\Scripts\python.exe bipdelivery\manage.py seed_e2e_demo_data
```

Then start the normal local servers:

```powershell
.venv\Scripts\python.exe bipdelivery\manage.py runserver localhost:8000 --noreload
npm --prefix bipflow-frontend run dev:ci
```

Frontend:

```text
http://localhost:5173
```

Backend:

```text
http://localhost:8000/api/
```

## Cypress Note

On this Windows environment, Cypress fails verification if
`ELECTRON_RUN_AS_NODE=1` is present. Clear it for Cypress runs:

```powershell
$env:ELECTRON_RUN_AS_NODE=$null
npm --prefix bipflow-frontend run cypress:run
```
