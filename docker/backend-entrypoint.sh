#!/bin/sh
set -e

APP_USER="${APP_USER:-appuser}"
MANAGE_PY="bipdelivery/manage.py"

run_as_app() {
    if [ "$(id -u)" = "0" ]; then
        gosu "$APP_USER" "$@"
    else
        "$@"
    fi
}

prepare_runtime_dirs() {
    mkdir -p bipdelivery/staticfiles bipdelivery/media bipdelivery/logs

    if [ "$(id -u)" = "0" ]; then
        chown -R "$APP_USER:$APP_USER" bipdelivery/staticfiles bipdelivery/media bipdelivery/logs
    fi
}

seed_admin_user() {
    if [ -z "${DJANGO_BOOTSTRAP_ADMIN_EMAIL:-}" ]; then
        return
    fi

    if [ -z "${DJANGO_BOOTSTRAP_ADMIN_PASSWORD:-}" ]; then
        echo "DJANGO_BOOTSTRAP_ADMIN_PASSWORD is required when DJANGO_BOOTSTRAP_ADMIN_EMAIL is set." >&2
        exit 1
    fi

    run_as_app python "$MANAGE_PY" seed_dashboard_roles \
        --email "$DJANGO_BOOTSTRAP_ADMIN_EMAIL" \
        --password "$DJANGO_BOOTSTRAP_ADMIN_PASSWORD" \
        --role "${DJANGO_BOOTSTRAP_ADMIN_ROLE:-admin}" \
        --staff
}

prepare_runtime_dirs
run_as_app python "$MANAGE_PY" migrate --noinput
run_as_app python "$MANAGE_PY" collectstatic --noinput
run_as_app python "$MANAGE_PY" seed_dashboard_roles
seed_admin_user

if [ "$(id -u)" = "0" ]; then
    exec gosu "$APP_USER" "$@"
fi

exec "$@"
