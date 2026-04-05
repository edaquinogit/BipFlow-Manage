#!/usr/bin/env sh
if [ -z "$husky_skip_init" ]; then
  debug () {
    if [ "$HUSKY_DEBUG" = "1" ]; then
      echo "husky (debug) - $1"
    fi
  }
  readonly hook_name="$(basename -- "$0")"
  debug "running $hook_name"
  if [ -f "$0.local" ]; then
    debug "running $hook_name.local"
    . "$0.local"
  fi
fi
