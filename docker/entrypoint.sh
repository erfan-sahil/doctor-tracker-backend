#!/bin/sh
set -e

if [ "${SEED_ADMIN}" = "true" ]; then
  echo "Seeding admin account if needed..."
  node dist/scripts/seedAdmin.js
fi

exec "$@"