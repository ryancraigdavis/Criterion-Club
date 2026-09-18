# Criterion Club — dev tasks. Run `just <recipe>`.

registry := "ghcr.io/ryancraigdavis"

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

# Build both images for the NAS (amd64) and push them to GHCR, tagged with the commit and `latest`.
# Refuses a dirty tree so every tag names a real commit. Needs `docker login ghcr.io` once.
release:
    #!/usr/bin/env bash
    set -euo pipefail
    tag="$(git describe --always --dirty)"
    [[ "$tag" != *-dirty ]] || { echo "commit first: release tags must name a commit" >&2; exit 1; }
    for part in api:backend web:frontend; do
        image="{{registry}}/criterion-club-${part%%:*}"
        docker build --platform linux/amd64 -t "$image:$tag" -t "$image:latest" "${part#*:}"
        docker push "$image:$tag"
        docker push "$image:latest"
    done
    echo "released $tag — restart the app in TrueNAS to pull it"
