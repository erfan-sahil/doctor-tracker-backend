# Doctor Tracker API

## Environment

One **`.env`** file (gitignored) powers local dev, seeds, and Docker Compose. See **`.env.example`**.

```bash
npm run env:init   # creates .env with random secrets (first time only)
```

## Docker (production-style)

```bash
docker compose up
```

Use `-d` to run in the background.

- API: http://localhost:5001/api/v1
- Health: http://localhost:5001/api/v1/health

Credentials are in **`.env`** (`ADMIN_EMAIL`, `ADMIN_PASSWORD`). After the first run, set `SEED_ADMIN=false` in `.env` and restart the API.

### Local MongoDB access (Compass / mongosh)

Mongo is not exposed on the host by default. To bind it to localhost only:

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml up
```

### Production notes

- Set `CORS_ORIGIN` to your real frontend URL.
- Use strong secrets (re-run `env:init` on a new machine or set manually).
- Do not use `docker-compose.local.yml` on a public server.
- Optional: set `API_HOST_PORT` when starting compose if you need a different host port.

Stop: `docker compose down`

## Local dev (no Docker)

```bash
npm run dev
```