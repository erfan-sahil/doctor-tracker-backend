# Doctor Tracker API

## Docker (production-style)

Secrets live in **`docker.env`** (gitignored). Nothing sensitive is committed in `docker-compose.yml`.

### First time

```bash
npm run docker:init    # creates docker.env with random secrets
docker compose up
```

Use `-d` to run in the background.

- API: http://localhost:5001/api/v1
- Health: http://localhost:5001/api/v1/health

Credentials are in **`docker.env`** (`ADMIN_EMAIL`, `ADMIN_PASSWORD`). After the first run, set `SEED_ADMIN=false` in `docker.env` and restart the API.

### Local MongoDB access (Compass / mongosh)

Mongo is not exposed on the host by default. To bind it to localhost only:

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml up
```

### Production notes

- Set `CORS_ORIGIN` to your real frontend URL.
- Use strong secrets (re-run `docker:init` on a new machine or set manually).
- Do not use `docker-compose.local.yml` on a public server.
- Optional: set `API_HOST_PORT` when starting compose if you need a different host port.

Stop: `docker compose down`