---
name: carabase-core
description: Set up and verify connection to a Carabase instance. Health checks, MCP server configuration, complete tool inventory, and references to task, knowledge, and daily note skills.
metadata:
  version: "2.1.0"
  requires_env:
    - CARABASE_HOST
    - CARABASE_WORKSPACE_ID
---

# Carabase Core

You are connected to a **Carabase** personal knowledge system — a self-hosted, privacy-first workspace with daily notes, folios (project knowledge collections), a knowledge graph, artifacts, memories, and task management. Everything runs on the user's own hardware over a Tailscale mesh network.

This skill handles connection setup, health verification, and serves as the index to all Carabase capabilities.

---

## Connection Configuration

Two environment variables must be set:

- **`CARABASE_HOST`** — Base URL of the Carabase instance (e.g., `http://localhost:3000` or a Tailnet address like `http://100.x.y.z:3000`). No trailing slash.
- **`CARABASE_WORKSPACE_ID`** — UUID of the target workspace.

Every REST API request to Carabase MUST include:
```
x-workspace-id: <CARABASE_WORKSPACE_ID>
```

---

## Health Check

Verify the connection is working:

```
GET {CARABASE_HOST}/api/v1/health
Headers:
  x-workspace-id: {CARABASE_WORKSPACE_ID}
```

A healthy response returns HTTP 200. If this fails:
1. Confirm `CARABASE_HOST` is reachable (try curl or fetch to the base URL).
2. Confirm `CARABASE_WORKSPACE_ID` is a valid UUID for an existing workspace.
3. Check that the Carabase server process is running on the host machine.
4. If connecting over Tailscale, confirm both machines are on the same tailnet and the host's IP/MagicDNS name is correct.

---

## MCP Server Connection (Primary Interface)

Carabase exposes an MCP (Model Context Protocol) server. **MCP tools are the preferred interface** for all agent interactions — they handle workspace scoping automatically, provide simpler parameter passing, and integrate natively with tool-calling flows.

- **Transport**: SSE (Server-Sent Events)
- **Endpoint**: `GET {CARABASE_HOST}/mcp/sse`
- The MCP server is workspace-scoped — the workspace ID is baked in at server creation; no `x-workspace-id` header is needed for MCP calls.

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

> Tools follow the canonical `carabase_*` naming. Legacy `search_semantic` / `query_graph` are still registered as deprecated aliases — see **carabase-knowledge** for the full surface (6 canonical retrieval tools, Doctor-RAG hint repair, FLARE hypothesis verification, lazy `carabase://artifact/{id}` resources).

---

## Complete MCP Tool Inventory

The host exposes **6 canonical retrieval tools** plus the task / daily-note / folio / artifact / memory tools below. Legacy `search_semantic` and `query_graph` remain as deprecated aliases.

### Canonical Retrieval (P0)

| Tool | Purpose | Skill Reference |
|---|---|---|
| `carabase_search_semantic` | Vector similarity search across all content. Returns lazy `carabase://artifact/{id}` URIs. | carabase-knowledge |
| `carabase_search_graph` | Look up an entity and walk its relationships (depth 1–3). | carabase-knowledge |
| `carabase_find_entity_candidates` | Multi-strategy entity-name resolver (exact / alias / substring). | carabase-knowledge |
| `carabase_query_metadata` | Filter by tag, date range, source, or entity. | carabase-knowledge |
| `carabase_route_and_execute` | Hand a natural-language query to the router; it picks the strategies. | carabase-knowledge |
| `carabase_verify_hypothesis` | FLARE-style claim verification. Returns `corroborated` / `contradicted` / `mixed` / `inconclusive`. | carabase-knowledge |

All canonical tools append `[hint: …]` / `[trace: …]` trailers to empty-state and error responses — **read them and act on them** (Doctor-RAG hint repair). See carabase-knowledge for details.

### Task Management (P0)

| Tool | Purpose | Skill Reference |
|---|---|---|
| `create_task` | Create a task in a daily note with optional folio/tag context | carabase-tasks |
| `list_tasks` | List and filter tasks across daily notes by status, folio, tag, date range | carabase-tasks |
| `toggle_task` | Check or uncheck a task by its composite ID | carabase-tasks |

### Daily Notes (P1)

| Tool | Purpose | Skill Reference |
|---|---|---|
| `create_log_entry` | Write a timestamped entry to today's daily note | carabase-daily |
| `read_daily_note` | Read a daily note as human-readable markdown | carabase-daily |

### Knowledge Browsing

| Tool | Purpose | Skill Reference |
|---|---|---|
| `list_entities` | Browse and filter knowledge graph entities | carabase-knowledge |

> For search, use the canonical retrieval tools above, not the deprecated `search_semantic` / `query_graph` aliases.

### Folio Management

| Tool | Purpose | Skill Reference |
|---|---|---|
| `list_folios` | Browse available folios in the workspace | carabase-knowledge |
| `read_folio_map` | Get a folio's About section and Timeline overview | carabase-knowledge |
| `commit_to_folio` | Append a commit entry to a folio's timeline | carabase-knowledge |
| `update_folio_section` | Modify a specific section of a folio (e.g., About text) | carabase-knowledge |

### Artifacts & Memories

| Tool | Purpose | Skill Reference |
|---|---|---|
| `read_artifact` | Read the extracted text of an uploaded file | carabase-knowledge |
| `search_memories` | Search distilled memories via vector similarity | carabase-knowledge |
| `create_memory` | Store a distilled insight or decision as a memory | carabase-knowledge |

---

## REST API (Fallback Interface)

When MCP tools do not cover a use case (e.g., uploading artifacts, creating folios, fine-grained document manipulation), fall back to the REST API.

### Base URL

```
{CARABASE_HOST}/api/v1/
```

### Standard Request Pattern

```bash
curl -X {METHOD} "{CARABASE_HOST}/api/v1/{endpoint}" \
  -H "Content-Type: application/json" \
  -H "x-workspace-id: {CARABASE_WORKSPACE_ID}" \
  -d '{body}'
```

### Key REST Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/v1/health` | Health check |
| GET | `/api/v1/tasks` | List all tasks |
| POST | `/api/v1/tasks` | Create a task |
| PATCH | `/api/v1/tasks` | Toggle a task's checked state |
| GET | `/api/v1/daily-notes/:date` | Get daily note (auto-creates if absent) |
| GET | `/api/v1/daily-notes/:date/text` | Get daily note as rendered text |
| PATCH | `/api/v1/daily-notes/:date` | Update daily note document |
| POST | `/api/v1/daily-notes/inject` | Inject a block into today's daily note |
| GET | `/api/v1/folios` | List all folios |
| POST | `/api/v1/folios` | Create a folio |
| GET | `/api/v1/folios/:folioId` | Get folio detail |
| PATCH | `/api/v1/folios/:folioId` | Update a folio |
| GET | `/api/v1/entities` | List knowledge graph entities |
| GET | `/api/v1/entities/:entityId` | Get entity with edges |
| GET | `/api/v1/edges` | List all graph edges |
| GET | `/api/v1/memories` | List memories |
| POST | `/api/v1/memories` | Create a memory |
| GET | `/api/v1/artifacts/:id` | Get artifact metadata |
| GET | `/api/v1/artifacts/:id/content` | Get artifact extracted text |
| POST | `/api/v1/artifacts/upload` | Upload an artifact (multipart/form-data) |

### Conventions

- **Content-Type**: `application/json` for POST/PATCH bodies
- **Date format**: `YYYY-MM-DD` (e.g., `2026-03-30`)
- **All requests** require the `x-workspace-id` header
- **Document content** uses TipTap/ProseMirror JSON block format

---

## Related Skills

Use these companion skills for specific workflows:

- **carabase-tasks** — Create, list, filter, and toggle tasks. Covers MCP tools `create_task`, `list_tasks`, `toggle_task` and REST fallback patterns.
- **carabase-daily** — Read and write daily notes, create log entries, inject content blocks. Covers MCP tools `read_daily_note`, `create_log_entry` and REST patterns for document manipulation.
- **carabase-knowledge** — The 6 canonical retrieval tools (`carabase_search_semantic`, `carabase_search_graph`, `carabase_find_entity_candidates`, `carabase_query_metadata`, `carabase_route_and_execute`, `carabase_verify_hypothesis`), Doctor-RAG hint repair, lazy `carabase://artifact/{id}` resources, plus `list_entities`, `list_folios`, `read_folio_map`, `commit_to_folio`, `update_folio_section`, `read_artifact`, `search_memories`, `create_memory`.

---

## Quick Decision Guide

| User wants to... | Use this tool | Skill |
|---|---|---|
| Create a task / todo | `create_task` | carabase-tasks |
| See open tasks | `list_tasks` | carabase-tasks |
| Mark a task done | `toggle_task` | carabase-tasks |
| Read today's notes | `read_daily_note` | carabase-daily |
| Log something to the timeline | `create_log_entry` | carabase-daily |
| Find information across everything | `carabase_search_semantic` | carabase-knowledge |
| Let the router decide how to search | `carabase_route_and_execute` | carabase-knowledge |
| Resolve an ambiguous entity name | `carabase_find_entity_candidates` | carabase-knowledge |
| Understand entity relationships | `carabase_search_graph` | carabase-knowledge |
| Filter by tag / date / source | `carabase_query_metadata` | carabase-knowledge |
| Verify a fact before stating it | `carabase_verify_hypothesis` | carabase-knowledge |
| Browse entities | `list_entities` | carabase-knowledge |
| Browse projects/folios | `list_folios` | carabase-knowledge |
| Get project context | `read_folio_map` | carabase-knowledge |
| Record a project update | `commit_to_folio` | carabase-knowledge |
| Update project description | `update_folio_section` | carabase-knowledge |
| Read an uploaded document | `read_artifact` | carabase-knowledge |
| Search past decisions/insights | `search_memories` | carabase-knowledge |
| Store an important insight | `create_memory` | carabase-knowledge |
