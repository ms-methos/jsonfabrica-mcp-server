# @jsonfabrica/mcp-server

[![npm](https://img.shields.io/npm/v/@jsonfabrica/mcp-server)](https://www.npmjs.com/package/@jsonfabrica/mcp-server)
[![license](https://img.shields.io/npm/l/@jsonfabrica/mcp-server)](./LICENSE)

A local [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server
that lets an AI coding agent — Claude Desktop, Cursor, or anything else that
speaks MCP — generate realistic, schema-conformant JSON test data mid-session by
calling [JsonFabrica](https://jsonfabrica.com)'s REST API as MCP tools.

It runs over **stdio transport only**: your AI client launches it as a
subprocess, so there's no network service to host and no port to open. It never
talks to anything except the JsonFabrica gateway you configure.

> New to JsonFabrica? It's an API-first service for generating synthetic JSON
> test data from reusable templates — deterministic, seed-reproducible, with
> referential integrity across related records. See
> [jsonfabrica.com](https://jsonfabrica.com) and the
> [API docs](https://jsonfabrica.com/docs).

## Install / run

Add it to your MCP client's config so the client launches it via `npx`:

```json
{
  "mcpServers": {
    "jsonfabrica": {
      "command": "npx",
      "args": ["-y", "@jsonfabrica/mcp-server"],
      "env": {
        "JSONFABRICA_API_KEY": "sk_live_...",
        "JSONFABRICA_API_URL": "https://api.jsonfabrica.com"
      }
    }
  }
}
```

- **Claude Desktop** — add the block above to `claude_desktop_config.json`
  (Settings → Developer → Edit Config), then restart.
- **Cursor** — Settings → MCP → Add new MCP server, or add the block to
  `~/.cursor/mcp.json`.

Get an API key by signing up at [jsonfabrica.com](https://jsonfabrica.com) —
Settings → API Keys.

Or run it directly for local testing:

```bash
npm install
npm run build
JSONFABRICA_API_KEY=sk_live_... node dist/index.js
```

## What it looks like in a session

Once connected, an agent can do things like:

> **You:** Generate 20 realistic customer records and 60 orders linked to them,
> and drop them into `fixtures/seed.json`.
>
> **Agent:** *calls `jsonfabrica_create_template` for the customer and order
> shapes, then `jsonfabrica_create_batch` with a `relations` map so each order
> references a generated customer id, then writes the result to the file.*

No tab-switching to a dashboard, no hand-written fixtures.

## Configuration

| Env var | Required | Default | Notes |
|---|---|---|---|
| `JSONFABRICA_API_KEY` | Yes | — | If missing, the server still starts and answers tool discovery, but every tool call fails with "check JSONFABRICA_API_KEY". Never logged or echoed back in tool output. |
| `JSONFABRICA_API_URL` | No | `https://api.jsonfabrica.com` | Base URL of the JsonFabrica gateway. Override this if you're self-hosting the gateway (e.g. `http://localhost:4000`). |

## Tools

Every tool's description states, verbatim, which REST endpoint it calls. Tool
names are prefixed `jsonfabrica_` to avoid collisions with other MCP servers
your client may have loaded.

### Health / Auth

| Tool | Endpoint | Notes |
|---|---|---|
| `jsonfabrica_health` | `GET /health` | No auth. Connectivity check. |
| `jsonfabrica_whoami` | `GET /v1/whoami` | Returns `{ tenantId, role }` for the configured key. |

### Templates

| Tool | Endpoint |
|---|---|
| `jsonfabrica_create_template` | `POST /v1/templates` |
| `jsonfabrica_list_templates` | `GET /v1/templates` |
| `jsonfabrica_get_template` | `GET /v1/templates/{templateId}` |
| `jsonfabrica_update_template` | `PUT /v1/templates/{templateId}` |
| `jsonfabrica_delete_template` | `DELETE /v1/templates/{templateId}` |
| `jsonfabrica_generate_from_template` | `POST /v1/templates/{templateId}/generate` |
| `jsonfabrica_generate_adhoc` | `POST /v1/templates/generate` (no persistence; same billing as persisted generation) |

Template `body` strings use JsonFabrica's function-call placeholder syntax with
angle brackets, e.g. `<getRandomFullName()>`, `<getRandomEmail()>`,
`<createSeq('orderNo')>`. The full catalogue of built-in functions is documented
at [jsonfabrica.com/docs/functions](https://jsonfabrica.com/docs/functions) —
it's authoring reference, not something this server exposes as tools.

### Sequences

| Tool | Endpoint |
|---|---|
| `jsonfabrica_create_sequence` | `POST /v1/sequences` |
| `jsonfabrica_list_sequences` | `GET /v1/sequences` |
| `jsonfabrica_get_sequence` | `GET /v1/sequences/{name}` |
| `jsonfabrica_update_sequence` | `PATCH /v1/sequences/{name}` |
| `jsonfabrica_delete_sequence` | `DELETE /v1/sequences/{name}` |
| `jsonfabrica_bump_sequence` | `POST /v1/sequences/{name}/bump` |

### Batches

| Tool | Endpoint |
|---|---|
| `jsonfabrica_create_batch` | `POST /v1/batches` (small batches run synchronously — 200 with `results`; larger batches are queued — 202, poll with `jsonfabrica_get_batch`) |
| `jsonfabrica_get_batch` | `GET /v1/batches/{batchId}` |

### Usage

| Tool | Endpoint |
|---|---|
| `jsonfabrica_get_usage` | `GET /v1/usage` — returns `{ tenantId, usageTotal, asOf }` |

### Explicitly out of scope

- `POST /v1/signup` and `PATCH /v1/billing/tier` — unauthenticated
  account-creation / billing-tier-change endpoints. Wrapping these would let a
  model create real paid subscriptions or change billing tiers on the user's
  behalf; excluded by design (generation API surface only).
- `POST /v1/webhooks/stripe` — Stripe-only webhook ingestion, not a
  developer-facing capability.

## Error handling

Every tool catches errors internally and returns an MCP `isError: true` result
with a readable message — it never throws out of the handler or crashes the host
process. Common cases:

- **401** → "Invalid or missing API key — check JSONFABRICA_API_KEY."
- **403** (admin tools) → "This API key does not have admin role."
- **402** (blocked account) → the upstream `blockReason` is passed through.
- Network failure (gateway unreachable) → a message naming the configured
  `JSONFABRICA_API_URL`.
- Anything else → `JsonFabrica API error [CODE] (HTTP status): message`.

## Troubleshooting

- **401 / "Invalid or missing API key"** → check `JSONFABRICA_API_KEY` is set
  and valid.
- **Connection refused / UPSTREAM_UNREACHABLE** → check `JSONFABRICA_API_URL` and
  that the gateway is actually running and reachable from wherever this process
  runs.
- **403 on admin tools** → your API key's tenant doesn't have `role=admin`.

## Development

```bash
npm install
npm run build   # tsc -p tsconfig.json
npm test        # build + node --test dist/
npm start       # node dist/index.js (requires JSONFABRICA_API_KEY)
```

Source layout mirrors the OpenAPI spec's tags: one file per tag under
`src/tools/`. `src/client.ts` is the only place that knows about `fetch`, the
base URL, and the `Authorization` header.

## License

MIT — see [LICENSE](./LICENSE).
