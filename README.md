# Criterion Club

The movie club: what we're watching next, who's coming, what to watch after that.

Members sign in with their Emby account, RSVP and suggest films. Two admins schedule screenings,
read the guest list and run polls. The site talks to Emby for sign-in and to look films up, and
keeps everything else in its own SQLite database.

`HISTORY.md` records where the project came from, the decisions behind it and what is still to do.

## Layout

```
backend/   FastAPI + SQLite: sessions, screenings, RSVPs, suggestions, polls, cached poster art
frontend/  React: the club page (/) and the admin dashboard (/admin)
```

## Running locally

Secrets come from Doppler (`criterion-club` / `dev`); every command goes through `doppler run --`.

```
just api     # backend on :8100
just web     # frontend on :5273, proxies /api to :8100
just test    # pytest + vitest
just lint    # ruff + biome
```

Without `just`:

```
cd backend && doppler run -- uv run uvicorn --factory criterion.main:create_app --reload --port 8100
cd frontend && npm run dev
```

`API_PROXY_TARGET` points the Vite dev proxy at a backend on another port.

## How it works

**Sign-in** is optional. Anyone can RSVP or suggest a film with just a name; signing in prefills it,
ties the entry to an account, and is what unlocks the dashboard. The password goes straight to Emby
— the site keeps only a signed 30-day cookie holding the account id and name. Admins are the Emby
usernames listed in `CLUB_ADMINS`; that is checked on every request, never trusted from the cookie.
Sign-in stays switched off until `SESSION_SECRET` is set, and changing that secret signs everyone
out. Eight wrong passwords in ten minutes earns a rest.

**Films** come from Emby live: the picker searches the library as you type, and saving a screening
snapshots its title, year, synopsis and runtime. Nothing here reads the video store's catalog. A
film that isn't in the library can be typed in by hand with a link to its poster.

**Poster art** is downloaded once and kept in `club-art/`, named by a hash of its source, so a
screening keeps its poster even if the film later leaves Emby. Screenings, suggestions and poll
options all share the same cached image.

**Screenings** show on the club page from the moment they're published until four hours after they
start. RSVPs are private: no names and no counts on the public side, the full list on the dashboard.

**Polls** are optional. One runs at a time; results appear once it's closed and stay for two weeks.
Signed-out votes are tied to a random id kept in the browser, which is an honour system.

**When Emby is down** the club keeps working: the page, the schedule, RSVPs and votes all come from
SQLite. Only sign-in and the film picker need Emby, and a screening that's already saved keeps its
poster and details.

## Production stack

`docker compose` runs the API (with Doppler) and an nginx container that serves the built frontend
and proxies `/api/` to it. Point the reverse proxy at port 8766.

Compose reads `DOPPLER_TOKEN` and `WEB_PORT` from a gitignored `.env` next to the compose file. The
token must be a **service token** for one config, never your personal CLI login:

```
doppler configs tokens create local-docker --project criterion-club --config dev --plain
echo "DOPPLER_TOKEN=dp.st.dev.…" > .env
just up        # docker compose up --build -d → http://localhost:8766
just down
```

The API runs as uid/gid 568 (TrueNAS's `apps` user) and keeps a Doppler fallback file in `/data`,
so it still starts if Doppler is unreachable after a reboot. Both containers have healthchecks; the
web container waits for the API to be healthy. The database and cached art live in the
`criterion-club-data` volume.

nginx trusts `X-Forwarded-For` only from private addresses and passes the API a single client
address, which is what the sign-in, post and search throttles key on. The API must run as a single
worker: the throttles live in memory and there is one shared SQLite connection.

## API

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/health` | — | `{status, emby_ok}`; asks Emby live every time |
| GET | `/api/site` | — | Emby address for the outbound links |
| POST | `/api/club/login` | — | `{username, password}` → sets the cookie |
| POST | `/api/club/logout` | — | clears the cookie |
| GET | `/api/club/me` | — | `{name, admin}` |
| GET | `/api/club/films?q=` | — | live Emby search, 8 results, two-character minimum |
| GET | `/api/club/next` | — | the next published screening, or `null` |
| GET | `/api/club/schedule` | — | the screenings after that one |
| GET | `/api/club/settings` | — | `{board_schedule}` |
| GET | `/api/club/poll` | — | the open poll, or a recently closed one with results |
| POST | `/api/club/votes` | — | one vote per person per poll |
| GET/POST | `/api/club/rsvp` | — | answer or change an answer |
| POST | `/api/club/suggestions` | — | suggest a film |
| GET | `/api/club/admin/overview` | admin | who you are |
| GET/POST | `/api/club/admin/events[/{id}][/delete]` | admin | schedule, edit, cancel |
| GET | `/api/club/admin/events/{id}/rsvps` | admin | the guest list with notes |
| POST | `/api/club/admin/rsvps/{id}/delete` | admin | remove an RSVP |
| GET/POST | `/api/club/admin/suggestions[/{id}][/delete]` | admin | the inbox and its statuses |
| GET/POST | `/api/club/admin/polls[/{id}][/delete]` | admin | build, open and close polls |
| POST | `/api/club/admin/settings` | admin | the upcoming-dates switch |
| GET | `/api/club-art/{version}.webp` | — | cached poster (`-t` for the thumb) |

## Configuration

| Variable | Default | Notes |
|---|---|---|
| `EMBY_SERVER_URL` | required | where the club signs people in and looks films up |
| `EMBY_SERVER_API` | required | admin key for search and poster art |
| `SESSION_SECRET` | empty | empty means sign-in is switched off |
| `CLUB_ADMINS` | empty | comma-separated Emby usernames |
| `SECURE_COOKIES` | `false` | `true` in production |
| `EMBY_PUBLIC_URL` | `EMBY_SERVER_URL` | what the "Emby" links point at |
| `DATA_DIR` | `./data` | holds `club.db` and `club-art/` |
| `FRONTEND_ORIGIN` | `http://localhost:5273` | CORS and the same-site check |
| `LOG_LEVEL` / `LOG_JSON` | `INFO` / `false` | level is case-insensitive; a typo fails startup |

## Screenshot tool

`npm run shoot` drives a headless browser and writes to `frontend/shots/`.

```
npm run shoot -- --shot=home
npm run shoot -- --cookie=club_session=<token> --goto=/admin --shot=dashboard
npm run shoot -- --mobile --shot=phone
```

Steps run in order: `--goto`, `--click-text`, `--click-selector`, `--click=x,y`, `--fill=sel::value`,
`--type`, `--press`, `--cookie=name=value`, `--await-text`, `--await-path`, `--wait=ms`, `--shot=name`.
`--await-text` reads `innerText`, which applies `text-transform`, so wait for what is drawn on
screen ("THE GODFATHER"), not the underlying text.
