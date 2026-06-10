.PHONY: dev build start test lint typecheck migrate up down

# Full onboarding: install deps, create .env if missing, start Docker,
# wait for services, run migrations, then launch the dev server.
dev: node_modules .env up _wait migrate
	npm run dev

# Auto-create .env on first run, then stop so the user can fill in secrets.
.env:
	@cp .env.example .env
	@echo ""
	@echo "  .env created from .env.example."
	@echo "  Fill in APP_KEY and RIOT_API_KEY, then run make dev again."
	@echo "  APP_KEY: run 'node ace generate:key'"
	@echo "  RIOT_API_KEY: https://developer.riotgames.com"
	@echo ""
	@exit 1

node_modules:
	npm install

up:
	docker compose up -d

_wait:
	@echo "Waiting for services..."
	@until docker compose exec -T postgres pg_isready > /dev/null 2>&1; do sleep 1; done
	@until docker compose exec -T clickhouse clickhouse-client --query "SELECT 1" > /dev/null 2>&1; do sleep 1; done
	@echo "Services ready."

migrate:
	node ace migration:run
	node ace clickhouse:migration:run

build:
	npm run build

start:
	npm start

test:
	npm test

lint:
	npm run lint

typecheck:
	npm run typecheck

down:
	docker compose down
