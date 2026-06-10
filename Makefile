.PHONY: dev build start test lint typecheck migrate up down

dev:
	npm run dev

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

migrate:
	node ace migration:run
	node ace clickhouse:migration:run

up:
	docker compose up -d

down:
	docker compose down
