FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

ENV UV_PROJECT_ENVIRONMENT=/app/.venv \
    PATH="/app/.venv/bin:$PATH" \
    DATA_DIR=/data \
    DOPPLER_ENABLE_VERSION_CHECK=false

# uid/gid 568 is TrueNAS SCALE's "apps" user, so a host-path dataset owned by apps lines up.
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl gnupg \
  && curl -Ls --tlsv1.2 --proto "=https" --retry 3 https://cli.doppler.com/install.sh | sh \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --gid 568 app \
  && useradd --uid 568 --gid 568 --create-home --home-dir /home/app app \
  && mkdir -p /data \
  && chown app:app /data

WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY src ./src
RUN uv sync --frozen --no-dev

USER app
ENV HOME=/home/app
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=15s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8000/api/health > /dev/null || exit 1
CMD ["doppler", "run", "--fallback", "/data/doppler-fallback.json", "--", \
     "uvicorn", "--factory", "criterion.main:create_app", \
     "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
