# Invade API

A League of Legends statistics API built with AdonisJS v6.

Personal project. I wanted a fast, no-fluff League of Legends stats app, so I
built one. The live version runs at [invade.lol](https://invade.lol) - feel
free to try it out before setting up locally.

> Not affiliated with or endorsed by Riot Games. League of Legends is a
> trademark of Riot Games, Inc.

## Stack

- **Framework** - AdonisJS v6
- **Databases** - PostgreSQL (player data) + ClickHouse (match analytics)
- **Cache** - Redis
- **Storage** - S3-compatible (MinIO locally, Cloudflare R2 in production)
- **Data source** - Riot Games API

## Prerequisites

- Node.js >= 22
- Docker and Docker Compose
- A Riot Games API key - get one at https://developer.riotgames.com

## Getting started

**1. Clone**

```bash
git clone https://github.com/invadelol/core.git
cd core
```

**2. Fill in secrets**

```bash
make dev
```

On first run, `make dev` creates `.env` from `.env.example` and stops.
Open `.env` and fill in two values:

- `APP_KEY` - run `node ace generate:key` to get one
- `RIOT_API_KEY` - get a key at https://developer.riotgames.com

Everything else is pre-filled with local defaults.

**3. Start**

```bash
make dev
```

That's it. `make dev` installs dependencies, starts Docker services (PostgreSQL,
ClickHouse, Redis, MinIO), waits for them to be ready, runs migrations, and
launches the dev server.

The API is available at http://localhost:3333.

---

## Make shortcuts

| Command | Description |
| --- | --- |
| `make dev` | Full onboarding + dev server (use this) |
| `make up` | Start Docker services only |
| `make down` | Stop Docker services |
| `make migrate` | Run all migrations |
| `make build` | Build for production |
| `make start` | Start production server |
| `make test` | Run test suite |
| `make lint` | Run ESLint |
| `make typecheck` | TypeScript check |

## npm scripts

```bash
npm run dev          # dev server with HMR
npm run build        # production build
npm start            # production server
npm run lint         # ESLint
npm run format       # Prettier
npm run typecheck    # TypeScript check
npm test             # test suite
```

---

## API routes

### Health and docs

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/` | Hello world |
| `GET` | `/health` | Health check |
| `GET` | `/docs` | Swagger UI |
| `GET` | `/swagger` | OpenAPI spec |

### Summoner

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/summoners/search?q=` | Search by name |
| `POST` | `/summoners/sync` | Sync from Riot API |
| `GET` | `/summoners/:platform/:summoner` | Get by GameName-TagLine |

### Analytics (by PUUID)

All routes require a valid PUUID and are cached.

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/summoners/puuid/:puuid/activity` | Match activity |
| `GET` | `/summoners/puuid/:puuid/friends` | Frequent teammates |
| `GET` | `/summoners/puuid/:puuid/ranks` | Current and historical ranks |
| `GET` | `/summoners/puuid/:puuid/stats` | Overall stats |
| `GET` | `/summoners/puuid/:puuid/champions` | Per-champion stats |
| `GET` | `/summoners/puuid/:puuid/matches` | Recent matches |
| `PUT` | `/summoners/puuid/:puuid/increment` | Increment profile view count |

---

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `APP_KEY` | yes | AdonisJS signing key - run `node ace generate:key` |
| `RIOT_API_KEY` | yes | Riot developer API key |
| `DB_HOST` | yes | PostgreSQL host |
| `DB_PORT` | yes | PostgreSQL port |
| `DB_USER` | yes | PostgreSQL user |
| `DB_PASSWORD` | no | PostgreSQL password |
| `DB_DATABASE` | yes | PostgreSQL database name |
| `CLICKHOUSE_URL` | yes | ClickHouse HTTP endpoint |
| `CLICKHOUSE_USER` | yes | ClickHouse user |
| `CLICKHOUSE_PASSWORD` | no | ClickHouse password |
| `CLICKHOUSE_DB` | yes | ClickHouse database name |
| `DRIVE_DISK` | yes | Storage driver - only `r2` is supported |
| `R2_KEY` | yes | S3/R2 access key |
| `R2_SECRET` | yes | S3/R2 secret |
| `R2_BUCKET` | yes | S3/R2 bucket name |
| `R2_ENDPOINT` | yes | S3/R2 endpoint URL |
| `REDIS_HOST` | yes | Redis host |
| `REDIS_PORT` | yes | Redis port |
| `REDIS_PASSWORD` | no | Redis password |

See `.env.example` for all defaults.

---

## License

[Polyform Noncommercial 1.0.0](LICENSE) - free for personal and open source
use, not for commercial use.
