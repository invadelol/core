# Invade API

A League of Legends statistics API built with [AdonisJS](https://adonisjs.com/).

## Tech Stack

- **Framework**: AdonisJS v6
- **Database**: PostgreSQL + ClickHouse (analytics)
- **Cache**: Redis
- **Storage**: S3/R2 (match data)
- **Data Source**: Riot Games API

## Getting Started

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Run development server
npm run dev
```

## API Routes

### Health & Docs

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Hello world |
| `GET` | `/health` | Health check |
| `GET` | `/docs` | Swagger UI |
| `GET` | `/swagger` | OpenAPI spec |

### Summoner Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/summoners/search?q=` | Search summoners by name |
| `POST` | `/summoners/sync` | Sync summoner data from Riot API |
| `GET` | `/summoners/:platform/:summoner` | Get summoner by GameName-TagLine |

### PUUID-based Analytics

All routes below require a valid PUUID and are cached:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/summoners/puuid/:puuid/activity` | Get summoner match activity |
| `GET` | `/summoners/puuid/:puuid/friends` | Get frequently played with players |
| `GET` | `/summoners/puuid/:puuid/ranks` | Get current and historical ranks |
| `GET` | `/summoners/puuid/:puuid/stats` | Get overall summoner stats |
| `GET` | `/summoners/puuid/:puuid/champions` | Get champion-specific stats |
| `GET` | `/summoners/puuid/:puuid/matches` | Get recent matches |
| `PUT` | `/summoners/puuid/:puuid/increment` | Increment profile view count |

## Scripts

```bash
npm run dev          # Start dev server with HMR
npm run build        # Build for production
npm start            # Start production server
npm run lint         # Run ESLint
npm run typecheck    # TypeScript check
npm run test         # Run tests

# ClickHouse migrations
npm run clickhouse:migrate
npm run clickhouse:migrate:status
npm run clickhouse:migrate:fresh
```