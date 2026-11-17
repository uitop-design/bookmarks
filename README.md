# Bookmarks

A small bookmark manager. Paste a URL and the API fetches the page title, description, site name
and icon for you. Organize bookmarks with tags, find them with full-text search and filter by
any combination of tags.

- Metadata is fetched while the bookmark is created, with strict time, size and redirect limits
- SSRF protection: pages on private networks and localhost are never fetched (unless explicitly allowed)
- URLs are normalized, so the same page cannot be saved twice
- PostgreSQL full-text search with ranking and web search syntax (`"exact phrase"`, `-exclude`, `or`)
- Responsive UI with light and dark themes; search and tag filters live in the URL

## Stack

| Part     | Technology                                                                                            |
| -------- | ----------------------------------------------------------------------------------------------------- |
| API      | Node.js 24, TypeScript (strict), Fastify 5, Zod 4 + fastify-type-provider-zod, Swagger UI             |
| Database | PostgreSQL 18, Prisma 7 (`prisma-client` generator, `@prisma/adapter-pg`)                             |
| Metadata | Built-in `fetch` with manual redirects, `node-html-parser`                                            |
| Web      | Vite, React 19, TypeScript, Tailwind CSS v4, shadcn/ui, TanStack Query, React Hook Form, React Router |
| Tooling  | npm workspaces, Biome (lint + format), Vitest                                                         |
| Runtime  | Docker Compose: nginx (web), API, PostgreSQL and a one-off migrate + seed job                         |

## Repository layout

```
apps/
  api/
    prisma/            schema, SQL migrations, idempotent seed
    src/
      app.ts           buildApp() factory (no listen), used by the server and tests
      server.ts        listen + graceful shutdown
      config/          environment schema
      plugins/         prisma, error handler, swagger
      modules/
        bookmarks/     routes, service, schemas
        tags/          routes, service, schemas
        health/        routes, service, schemas
      metadata/        page loader with limits, HTML parser, private address guard
      lib/             URL normalization, db client, HTTP errors
    test/              unit tests (database and HTTP are mocked)
  web/
    src/
      api/             fetch client, response schemas, TanStack Query hooks
      components/      app components; ui/ holds shadcn/ui components
      hooks/           URL-synced filters, debounce
      pages/           bookmarks page
      lib/             helpers
    nginx.conf         SPA fallback, /api proxy, gzip, asset caching
docker-compose.yml
```

## Data model

| Table           | Columns                                                                                                                                                                           |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bookmarks`     | `id` uuid, `url` (normalized, unique), `title`, `description?`, `site_name?`, `favicon_url?`, `metadata_status` (`PENDING`, `OK`, `FAILED`), `created_at`, `updated_at`, `search` |
| `tags`          | `id` uuid, `name` (unique, lowercase)                                                                                                                                             |
| `bookmark_tags` | `bookmark_id`, `tag_id` — composite primary key, both cascade on delete                                                                                                           |

`search` is a stored generated `tsvector` column with a GIN index, written by hand in the SQL
migrations (Prisma sees it as `Unsupported("tsvector")`):

```sql
setweight(to_tsvector('simple', title), 'A') ||
setweight(to_tsvector('simple', coalesce(description, '')), 'B') ||
setweight(to_tsvector('simple', url || ' ' || regexp_replace(url, '[^[:alnum:]]+', ' ', 'g')), 'C')
```

The URL is indexed both as is and split into words, so `github.com`, `github` and a word from the
path all match. Tags that no longer have bookmarks are deleted together with their last bookmark
or tag change.

## URL normalization

Only absolute `http` and `https` URLs up to 2048 characters are accepted; URLs with credentials
are rejected. Before saving, a URL is normalized:

- scheme and host are lowercased, internationalized hosts are converted to punycode
- the default port (`:80` for http, `:443` for https) is removed
- the fragment is removed
- tracking parameters are removed: `utm_*`, `fbclid`, `gclid`; other parameters keep their order
- trailing slashes are removed from the path, except for the root `/`

`HTTPS://Example.com:443/docs/?utm_source=x#intro` becomes `https://example.com/docs`. Adding a URL
that normalizes to an existing bookmark returns `409` with the existing bookmark id in the message.

## Metadata fetching

`POST /api/bookmarks` and `POST /api/bookmarks/:id/refresh` fetch the page synchronously:

- `GET` with the `BookmarksBot/1.0` user agent and a 5 second timeout for the whole operation
  (DNS, redirects and body)
- at most 3 redirects, followed manually; every hop is validated again
- only `text/html` responses are read, and only the first 1 MB of the body
- the declared charset is respected

Fields are extracted in this order:

| Field         | Source                                                                                |
| ------------- | ------------------------------------------------------------------------------------- |
| `title`       | `og:title` → `<title>` → host name (max 200 characters)                               |
| `description` | `og:description` → `<meta name="description">` (truncated to 300 characters)          |
| `siteName`    | `og:site_name`                                                                        |
| `faviconUrl`  | `<link rel="icon">` / `shortcut icon` → `apple-touch-icon` → `/favicon.ico`, absolute |

The bookmark is always created. If the page cannot be fetched (timeout, error status, not HTML,
blocked address) the title falls back to the host name and `metadataStatus` is `FAILED`. A refresh
overwrites title, description, site name and icon, including manual edits, and can turn `FAILED`
into `OK` once the page is reachable.

### SSRF protection

Before each request, including every redirect target, the host is resolved and all of its
addresses are checked. Loopback, private (RFC 1918), carrier-grade NAT, link-local (including cloud
metadata `169.254.169.254`), multicast, reserved and documentation ranges are blocked for IPv4 and
IPv6, as well as IPv4-mapped IPv6 addresses. A blocked URL can still be saved as a bookmark, but
its page is never requested.

Set `ALLOW_PRIVATE_URLS=true` to allow private addresses, for example to bookmark pages on a local
network. It is `false` in `.env.example` and `true` in `docker-compose.yml`, so the stack can be
tested against pages served from the host machine.

## Search and filters

`GET /api/bookmarks?q=&tags=&page=&limit=`

- `q` (1–100 characters) is parsed with `websearch_to_tsquery('simple', q)`: plain words,
  `"exact phrase"`, `-excluded`, `a or b`. Results are ordered by `ts_rank`, so title matches rank
  above description matches, which rank above URL matches
- without `q` the newest bookmarks come first
- `tags=a,b` (up to 10) returns bookmarks that have all of the listed tags; combined with `q` both
  conditions apply
- `page` defaults to 1, `limit` to 24 (max 100); the response is `{ items, total, page, limit }`

## API

All endpoints are under `/api`. Interactive documentation is available at
[`/docs`](http://localhost:3901/docs).

| Method   | Path                         | Description                                                    |
| -------- | ---------------------------- | -------------------------------------------------------------- |
| `POST`   | `/api/bookmarks`             | Add a bookmark `{ url, tags? }` → `201`; duplicate URL → `409` |
| `GET`    | `/api/bookmarks`             | Search, filter and paginate bookmarks                          |
| `GET`    | `/api/bookmarks/:id`         | Get one bookmark                                               |
| `PATCH`  | `/api/bookmarks/:id`         | Update `{ title?, description?, tags? }`; `tags` replaces all  |
| `DELETE` | `/api/bookmarks/:id`         | Delete a bookmark → `204`                                      |
| `POST`   | `/api/bookmarks/:id/refresh` | Fetch page metadata again                                      |
| `GET`    | `/api/tags`                  | `[{ name, count }]`, most used first, then by name             |
| `GET`    | `/api/health`                | API and database status                                        |

Validation rules: up to 10 tags per bookmark, each 1–24 characters of `[a-z0-9-]` (input is
lowercased, trimmed and deduplicated); `title` 1–200 and `description` up to 500 characters after
trimming; unknown body fields are rejected.

Every error has the same shape:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": ["url: Only http and https URLs are supported"],
  "path": "/api/bookmarks",
  "timestamp": "2026-11-17T12:00:00.000Z"
}
```

Validation errors list every problem as `field: message`. Malformed JSON, oversized bodies and
unsupported content types use the same format. Database constraint errors are mapped
(`P2002` → 409, `P2025` → 404, `P2003` → 400); unexpected errors return `500` without details,
which are written to the log.

## Running with Docker Compose

```bash
docker compose up -d --build
```

| Service    | URL                                                           |
| ---------- | ------------------------------------------------------------- |
| Web        | [http://localhost:3900](http://localhost:3900)                |
| API        | [http://localhost:3901/api](http://localhost:3901/api/health) |
| Swagger UI | [http://localhost:3901/docs](http://localhost:3901/docs)      |
| PostgreSQL | `localhost:5442` (user, password and database `bookmarks`)    |

The `migrate` service applies migrations and runs the seed (15 well-known sites with predefined
metadata and overlapping tags; no network requests) before the API starts. The seed is idempotent.
nginx serves the web app with an SPA fallback and proxies `/api` to the API container.

To start over with a clean database:

```bash
docker compose down -v && docker compose up -d --build
```

## Local development

Requirements: Node.js 22+ and a PostgreSQL database (for example the one from Compose:
`docker compose up -d postgres`).

```bash
npm install
cp apps/api/.env.example apps/api/.env
npm run db:migrate -w apps/api
npm run db:seed -w apps/api
npm run dev
```

`npm run dev` starts the API on port 3901 (`tsx watch`) and the Vite dev server on port 5173,
which proxies `/api` to the API.

### Environment variables

| Variable             | Default       | Description                              |
| -------------------- | ------------- | ---------------------------------------- |
| `DATABASE_URL`       | —             | PostgreSQL connection string             |
| `PORT`               | `3901`        | API port                                 |
| `HOST`               | `0.0.0.0`     | API host                                 |
| `LOG_LEVEL`          | `info`        | pino log level                           |
| `NODE_ENV`           | `development` | `development` enables pretty logs        |
| `ALLOW_PRIVATE_URLS` | `false`       | Allow fetching pages on private networks |

## Scripts

Run from the repository root:

| Command             | Description                      |
| ------------------- | -------------------------------- |
| `npm run dev`       | API and web in watch mode        |
| `npm run build`     | Build both apps                  |
| `npm run typecheck` | Type-check both apps             |
| `npm test`          | API unit tests (Vitest)          |
| `npm run lint`      | Biome lint and format check      |
| `npm run format`    | Apply Biome fixes and formatting |

Unit tests cover URL normalization, metadata parsing, the page loader (timeouts, size limit,
redirects, content types), the private address guard, tag normalization and replacement, and the
error handler. The database and HTTP are mocked, so tests need no running services.
