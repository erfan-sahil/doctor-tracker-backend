#!/bin/sh
set -e

if [ "${SEED_ADMIN}" = "true" ]; then
  node dist/scripts/seedAdmin.js
fi

exec "$@"