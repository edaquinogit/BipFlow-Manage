#!/usr/bin/env python3
"""Generate secure local secrets for BipFlow.

Examples:
  python scripts/generate-secrets.py
  python scripts/generate-secrets.py >> .env
  python scripts/generate-secrets.py --env
  python scripts/generate-secrets.py --only DJANGO_SECRET_KEY
"""

from __future__ import annotations

import argparse
import secrets
import sys
import time
from pathlib import Path


SECRET_SIZES = {
    "DJANGO_SECRET_KEY": 64,
    "POSTGRES_PASSWORD": 32,
    "REDIS_PASSWORD": 32,
}


def generate_values(keys: list[str]) -> dict[str, str]:
    return {key: secrets.token_urlsafe(SECRET_SIZES[key]) for key in keys}


def render_env_lines(values: dict[str, str]) -> str:
    return "\n".join(f"{key}={value}" for key, value in values.items()) + "\n"


def update_env_file(env_path: Path, values: dict[str, str], *, force: bool) -> None:
    original = env_path.read_text(encoding="utf-8") if env_path.exists() else ""
    lines = original.splitlines()
    updated_keys: set[str] = set()
    rendered: list[str] = []

    for line in lines:
        key, sep, current_value = line.partition("=")
        if sep and key in values:
            if current_value and not force:
                rendered.append(line)
            else:
                rendered.append(f"{key}={values[key]}")
            updated_keys.add(key)
        else:
            rendered.append(line)

    missing = [key for key in values if key not in updated_keys]
    if missing and rendered and rendered[-1] != "":
        rendered.append("")
    rendered.extend(f"{key}={values[key]}" for key in missing)

    if env_path.exists():
        backup_path = env_path.with_name(f"{env_path.name}.backup.{int(time.time())}")
        backup_path.write_text(original, encoding="utf-8")
        print(f"Backed up existing {env_path} to {backup_path}", file=sys.stderr)

    env_path.write_text("\n".join(rendered).rstrip() + "\n", encoding="utf-8")
    print(f"Wrote secrets to {env_path}", file=sys.stderr)
    print("Do not commit this file.", file=sys.stderr)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate secure BipFlow secrets.")
    parser.add_argument(
        "--only",
        choices=sorted(SECRET_SIZES),
        help="Generate only one secret.",
    )
    parser.add_argument(
        "--env",
        action="store_true",
        help="Update .env in place, preserving non-secret settings.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite existing secret values when used with --env.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    keys = [args.only] if args.only else list(SECRET_SIZES)
    values = generate_values(keys)

    if args.env:
        update_env_file(Path(".env"), values, force=args.force)
    else:
        sys.stdout.write(render_env_lines(values))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
