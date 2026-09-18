# Criterion Club — dev tasks. Run `just <recipe>`.

api:
    cd backend && doppler run -- uv run uvicorn --factory criterion.main:create_app --reload --port 8100

web:
    cd frontend && npm run dev

dev:
    just api & just web; wait

lint:
    cd backend && uv run ruff check . && uv run ruff format --check .
    cd frontend && npm run lint

fmt:
    cd backend && uv run ruff check --fix . && uv run ruff format .
    cd frontend && npm run fmt

test-api:
    cd backend && uv run pytest

test-web:
    cd frontend && npm test

test: test-api test-web

build:
    docker compose build

# Reads DOPPLER_TOKEN (a service token, never your personal login) from .env beside this file.
up:
    docker compose up --build -d

down:
    docker compose down
