FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

ENV UV_PROJECT_ENVIRONMENT=/app/.venv
ENV PATH="/app/.venv/bin:$PATH"

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl gnupg \
  && curl -Ls --tlsv1.2 --proto "=https" --retry 3 https://cli.doppler.com/install.sh | sh \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY src ./src
RUN uv sync --frozen --no-dev

EXPOSE 8000
CMD ["doppler", "run", "--", "uvicorn", "--factory", "criterion.main:create_app", "--host", "0.0.0.0", "--port", "8000"]
