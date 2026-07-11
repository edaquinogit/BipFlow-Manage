#!/bin/sh
set -eu

APP_USER="${APP_USER:-appuser}"
MANAGE_PY="bipdelivery/manage.py"
MIN_SECRET_LENGTH=32

require_secret() {
    name="$1"
    eval "value=\${$name:-}"

    if [ -z "$value" ]; then
        echo "ERROR: $name is required but not set." >&2
        echo "Generate local values with: python scripts/generate-secrets.py" >&2
        exit 1
    fi

    case "$value" in
        *change?me*|*placeholder*|*bipflow?password*|*django?insecure*|*TO?O*|admin???|password|password???|secret|123456|test)
            echo "ERROR: $name contains an unsafe placeholder or weak value." >&2
            echo "Generate local values with: python scripts/generate-secrets.py" >&2
            exit 1
            ;;
    esac

    value_length=${#value}
    if [ "$value_length" -lt "$MIN_SECRET_LENGTH" ]; then
        echo "ERROR: $name must be at least $MIN_SECRET_LENGTH characters." >&2
        echo "Generate local values with: python scripts/generate-secrets.py" >&2
        exit 1
    fi
}

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

validate_secrets() {
    # POSTGRES_PASSWORD/REDIS_PASSWORD are NOT required here on purpose:
    # Django never reads them directly (see build_database_config() in
    # settings.py), they only exist to let docker-compose interpolate
    # DATABASE_URL/CACHE_URL in docker-compose*.yml. Managed-DB topologies
    # (Render + Neon/Upstash) hand over a complete DATABASE_URL/CACHE_URL
    # with no separate POSTGRES_PASSWORD/REDIS_PASSWORD env var at all, so
    # requiring them here would fail closed for a perfectly valid setup.
    require_secret "DJANGO_SECRET_KEY"
    require_secret "DATABASE_URL"
    require_secret "CACHE_URL"
}

seed_admin_user() {
    if [ -z "${DJANGO_BOOTSTRAP_ADMIN_EMAIL:-}" ]; then
        return
    fi

    require_secret "DJANGO_BOOTSTRAP_ADMIN_PASSWORD"

    # No --password flag here on purpose: it would put the plaintext
    # password in this process's argv, visible to anyone who can read the
    # container's process list for the life of this command. The command
    # reads DJANGO_BOOTSTRAP_ADMIN_PASSWORD from the environment directly
    # instead -- it's already exported into the container's env either way.
    run_as_app python "$MANAGE_PY" seed_dashboard_roles \
        --email "$DJANGO_BOOTSTRAP_ADMIN_EMAIL" \
        --role "${DJANGO_BOOTSTRAP_ADMIN_ROLE:-admin}" \
        --staff
}

validate_secrets
prepare_runtime_dirs
run_as_app python "$MANAGE_PY" migrate --noinput
run_as_app python "$MANAGE_PY" collectstatic --noinput
run_as_app python "$MANAGE_PY" seed_dashboard_roles
seed_admin_user

if [ "$(id -u)" = "0" ]; then
    exec gosu "$APP_USER" "$@"
fi

exec "$@"
