# Django Admin MFA Runbook

`/admin/login/` now enforces the same TOTP MFA the dashboard's own login
already had (see `bipdelivery/api/admin_auth.py`): any staff/superuser with a
confirmed `TOTPDevice` must supply a valid code (or backup code) to log into
the admin, on top of the username/password check. Rate limiting
(`admin_login_ip`, `admin_login_identity`) applies too.

This is enforced unconditionally for accounts that already have MFA
configured. What is *not* unconditional is `DJANGO_ADMIN_MFA_ENFORCED`: it
only controls whether staff/superuser accounts **without** a confirmed MFA
device can still log in password-only.

## Rollout sequence

Never flip `DJANGO_ADMIN_MFA_ENFORCED=True` in the same deploy that ships
this code -- do it as two separate, explicitly sequenced steps.

1. Deploy this code with `DJANGO_ADMIN_MFA_ENFORCED` unset (defaults to
   `False`). Nothing changes for staff who don't use MFA yet; staff who
   already do will be asked for their code on `/admin/` too.
2. Have every staff/superuser set up MFA via the dashboard's
   `Configuracoes > Seguranca` tab (same `TOTPDevice` the API login already
   uses -- no separate admin-specific setup flow exists).
3. Confirm there are no stragglers:

   ```bash
   # VM + Docker Compose
   docker compose -f docker-compose.prod.yml exec backend \
     python manage.py list_staff_without_mfa

   # Render
   # Run from the Render shell (Dashboard -> bipflow-backend -> Shell)
   python manage.py list_staff_without_mfa
   ```

   It should report "Every staff/superuser account has a confirmed MFA
   device." before proceeding.
4. Set `DJANGO_ADMIN_MFA_ENFORCED=True`:
   - VM: add it to the prod `.env` (see `.env.prod.example`) and redeploy --
     `docker-compose.prod.yml`'s `x-backend-env` already has a passthrough
     entry for it.
   - Render: edit the `DJANGO_ADMIN_MFA_ENFORCED` env var from the dashboard
     (Environment tab) and redeploy.

## Escape hatch (locked out)

If enforcement locks out every remaining admin (e.g. the bootstrap admin
never set up MFA and enforcement was turned on anyway):

1. Set `DJANGO_ADMIN_MFA_ENFORCED=False` and redeploy. This immediately lets
   password-only staff back into `/admin/` (accounts with a confirmed
   `TOTPDevice` are unaffected either way -- they still need their code).
2. Alternatively, without redeploying: open a shell on the backend container
   and reset via the ORM, e.g. to drop a broken/inaccessible MFA device
   (only if the locked-out account **has** a device but lost access to it):

   ```bash
   docker compose -f docker-compose.prod.yml exec backend python manage.py shell
   >>> from django.contrib.auth import get_user_model
   >>> from bipdelivery.api.models import TOTPDevice, MFABackupCode
   >>> user = get_user_model().objects.get(username="admin@example.com")
   >>> TOTPDevice.objects.filter(user=user).delete()
   >>> MFABackupCode.objects.filter(user=user).delete()
   ```

   This is the same recovery pattern already used for other misconfigurations
   in this project -- see `docs/production-go-live.md`.

## Deliberately out of scope

Moving `/admin/` off its default path and IP-allowlisting it were both
considered and deferred: a path change needs coordinated edits across
`bipdelivery/core/urls.py` **and** the frontend's nginx config (a static file
baked into the frontend image, not templated -- easy to silently desync), and
an IP allowlist risks locking out the only operator if their IP changes
without a static IP/VPN. Worth revisiting if the operational profile changes
(e.g. a dedicated ops team with a stable VPN egress IP).
