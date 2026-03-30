---
name: carabase-core
description: Set up and verify connection to a Carabase instance. Health checks, MCP server configuration, and references to task, knowledge, and daily note skills.
metadata:
  version: "1.0.0"
  requires_env:
    - CARABASE_HOST
    - CARABASE_WORKSPACE_ID
---

# Carabase Core

You are connected to a Carabase personal knowledge system. This skill handles connection setup, health verification, and provides the foundation that the other Carabase skills build on.

## Connection Configuration

Two environment variables must be set:

- **`CARABASE_HOST`** — Base URL of the Carabase instance (e.g., `http://localhost:3000` or a Tailnet address like `http://100.x.y.z:3000`). No trailing slash.
- **`CARABASE_WORKSPACE_ID`** — UUID of the target workspace.

Every REST API request to Carabase MUST include:
```
x-workspace-id: <CARABASE_WORKSPACE_ID>
```

## Health Check

To verify the connection is working, make a GET request:

```
GET {CARABASE_HOST}/api/v1/health
Headers:
  x-workspace-id: {CARABASE_WORKSPACE_ID}
```

A healthy response returns HTTP 200. If this fails:
1. Confirm `CARABASE_HOST` is reachable (try curl or fetch to the base URL)
2. Confirm `CARABASE_WORKSPACE_ID` is a valid UUID for an existing workspace
3. Check that the Carabase server is running

## MCP Server Connection

Carabase exposes an MCP server for richer tool-based interactions. To connect via MCP:

- **Transport**: SSE (Server-Sent Events)
- **Endpoint**: `GET {CARABASE_HOST}/mcp/sse`
- The MCP server is workspace-scoped — the workspace ID is baked in at server creation.

### MCP Setup for OpenClaw

Add the Carabase MCP server to your agent's MCP configuration:

```json
{
  "mcpServers": {
    "carabase": {
      "url": "{CARABASE_HOST}/mcp/sse",
      "transport": "sse"
    }
  }
}
```

Once connected, the following MCP tools become available:
- `commit_to_folio` — Add content to a folio
- `search_semantic` — Vector search across all artifacts
- `query_graph` — Knowledge graph lookup
- `read_artifact` — Read uploaded file content
- `create_log_entry` — Write to the daily timeline
- `read_folio_map` — Get folio overview (About + Timeline)
- `update_folio_section` — Patch folio sections

## Related Skills

Use these companion skills for specific operations:

- **carabase-tasks** — Create, list, filter, and toggle tasks
- **carabase-knowledge** — Search content, query the knowledge graph, manage folios and artifacts
- **carabase-daily** — Read and write daily notes, create log entries

## REST API Conventions

All Carabase REST endpoints follow these patterns:

- Base path: `{CARABASE_HOST}/api/v1/`
- Content-Type: `application/json` for POST/PATCH bodies
- Date format: `YYYY-MM-DD` (e.g., `2026-03-30`)
- All requests require the `x-workspace-id` header
- Document content uses TipTap/ProseMirror JSON block format

## Standard Request Template

When making any Carabase REST call, use this pattern:

```bash
curl -X {METHOD} "{CARABASE_HOST}/api/v1/{endpoint}" \
  -H "Content-Type: application/json" \
  -H "x-workspace-id: {CARABASE_WORKSPACE_ID}" \
  -d '{body}'
```

Or with fetch:

```javascript
const response = await fetch(`${CARABASE_HOST}/api/v1/${endpoint}`, {
  method: '{METHOD}',
  headers: {
    'Content-Type': 'application/json',
    'x-workspace-id': CARABASE_WORKSPACE_ID
  },
  body: JSON.stringify(payload)
});
```
