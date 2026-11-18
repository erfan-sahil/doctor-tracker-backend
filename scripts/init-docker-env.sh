#!/bin/sh
set -e

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env"
EXAMPLE="$ROOT/.env.example"

if [ -f "$ENV_FILE" ]; then
  echo ".env already exists — not overwritten."
  exit 0
fi

if [ ! -f "$EXAMPLE" ]; then
  echo "Missing .env.example"
  exit 1
fi

cp "$EXAMPLE" "$ENV_FILE"

if ! command -v openssl >/dev/null 2>&1; then
  echo "Created .env from example. Install openssl or edit secrets manually."
  exit 0
fi

ACCESS="$(openssl rand -hex 32)"
REFRESH="$(openssl rand -hex 32)"
ADMIN_PW="$(openssl rand -base64 18 | tr -d '/+=' | head -c 20)"

# GNU sed vs BSD sed
if sed --version >/dev/null 2>&1; then
  SED_INPLACE=(sed -i)
else
  SED_INPLACE=(sed -i '')
fi

"${SED_INPLACE[@]}" "s|^ACCESS_TOKEN_SECRET=.*|ACCESS_TOKEN_SECRET=${ACCESS}|" "$ENV_FILE"
"${SED_INPLACE[@]}" "s|^REFRESH_TOKEN_SECRET=.*|REFRESH_TOKEN_SECRET=${REFRESH}|" "$ENV_FILE"
"${SED_INPLACE[@]}" "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=${ADMIN_PW}|" "$ENV_FILE"
"${SED_INPLACE[@]}" "s|^SEED_ADMIN=.*|SEED_ADMIN=true|" "$ENV_FILE"

echo "Created .env with random JWT secrets and admin password."
echo "Admin: see ADMIN_EMAIL / ADMIN_PASSWORD in .env"
echo "After first successful start, set SEED_ADMIN=false in .env."