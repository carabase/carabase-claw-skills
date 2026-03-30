# Carabase MCP Tools Reference

Carabase exposes an MCP (Model Context Protocol) server for agent tool calls. MCP tools are the preferred interface for all agent interactions — they handle workspace scoping automatically, provide simpler parameters, and integrate natively with tool-calling flows.

## Connection

- **Transport**: SSE (Server-Sent Events)
- **Endpoint**: `GET {CARABASE_HOST}/mcp/sse`
- The server is workspace-scoped — no `x-workspace-id` header is needed for MCP calls.

### Configuration

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

---

## Tool Inventory (15 tools)

| # | Tool | Category | Priority |
|---|---|---|---|
| 1 | `create_task` | Task Management | P0 |
| 2 | `list_tasks` | Task Management | P0 |
| 3 | `toggle_task` | Task Management | P0 |
| 4 | `read_daily_note` | Daily Notes | P1 |
| 5 | `create_log_entry` | Daily Notes | Existing |
| 6 | `search_semantic` | Search | Existing |
| 7 | `query_graph` | Knowledge Graph | Existing (upgraded) |
| 8 | `list_entities` | Knowledge Graph | P1 |
| 9 | `list_folios` | Folio Management | P1 |
| 10 | `read_folio_map` | Folio Management | Existing |
| 11 | `commit_to_folio` | Folio Management | Existing |
| 12 | `update_folio_section` | Folio Management | Existing |
| 13 | `read_artifact` | Artifacts | Existing |
| 14 | `search_memories` | Memories | P2 |
| 15 | `create_memory` | Memories | P2 |

---

## Task Management Tools

### 1. create_task

Create a task in the user's daily note. The server builds a properly formatted `logCard` > `taskList` > `taskItem` block and injects it into the specified date's note.

**Arguments:**
| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `text` | string | Yes | — | Task description |
| `folio` | string | No | — | Folio name to associate the task with |
| `tags` | string[] | No | — | Tags for the task entry (e.g., `["urgent", "review"]`) |
| `date` | string | No | today | Target date in YYYY-MM-DD format |

**Example call:**
```json
{
  "text": "Review PR #42 — auth token rotation",
  "folio": "Backend",
  "tags": ["review", "auth"],
  "date": "2026-03-30"
}
```

**Example response:**
```json
{
  "success": true,
  "task": {
    "text": "Review PR #42 — auth token rotation",
    "date": "2026-03-30",
    "folio": "Backend",
    "tags": ["review", "auth"],
    "timestamp": "02:15 PM"
  }
}
```

**Use when**: The user wants to create a todo, action item, or task. Prefer this over manually constructing TipTap blocks via REST.

---

### 2. list_tasks

Retrieve tasks across daily notes with server-side filtering. Returns tasks sorted by unchecked first, then by date descending.

**Arguments:**
| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `checked` | boolean | No | — | Filter by completion status |
| `folio` | string | No | — | Filter by folio name |
| `tag` | string | No | — | Filter by tag |
| `date_from` | string | No | — | Start date (YYYY-MM-DD) |
| `date_to` | string | No | — | End date (YYYY-MM-DD) |
| `limit` | number | No | 20 | Maximum number of results |

**Example call:**
```json
{
  "checked": false,
  "folio": "Backend",
  "date_from": "2026-03-24",
  "date_to": "2026-03-30"
}
```

**Example response:**
```json
{
  "tasks": [
    {
      "id": "2026-03-30:3",
      "text": "Review PR #42",
      "checked": false,
      "date": "2026-03-30",
      "folios": ["Backend"],
      "tags": ["review"],
      "timestamp": "02:15 PM",
      "nodeIndex": 3
    },
    {
      "id": "2026-03-28:7",
      "text": "Fix rate limiter bug",
      "checked": false,
      "date": "2026-03-28",
      "folios": ["Backend"],
      "tags": ["bug"],
      "timestamp": "10:00 AM",
      "nodeIndex": 7
    }
  ]
}
```

**Use when**: The user asks about their tasks, todos, open items, or needs a task overview.

---

### 3. toggle_task

Check or uncheck a task by its composite ID.

**Arguments:**
| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `task_id` | string | Yes | — | Task ID in format `YYYY-MM-DD:nodeIndex` |
| `checked` | boolean | Yes | — | New completion state |

**Example call:**
```json
{
  "task_id": "2026-03-30:3",
  "checked": true
}
```

**Example response:**
```json
{
  "success": true,
  "task": {
    "text": "Review PR #42",
    "checked": true,
    "date": "2026-03-30",
    "nodeIndex": 3
  }
}
```

**Use when**: The user wants to mark a task as done or reopen a completed task. The `task_id` comes from the `id` field in `list_tasks` responses.

---

## Daily Notes Tools

### 4. read_daily_note

Read a daily note as human-readable markdown instead of raw TipTap JSON. The server renders the document tree into a clean format with timestamp headers, task checkboxes, and folio/tag annotations.

**Arguments:**
| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `date` | string | No | today | Date to read in YYYY-MM-DD format |

**Example call:**
```json
{
  "date": "2026-03-30"
}
```

**Example response:**
```json
{
  "date": "2026-03-30",
  "content": "## 09:15 AM [#standup] [Backend]\nDiscussed deploy timeline. Targeting Friday for v2.3.1 release.\n\n## 11:30 AM [#review] [Backend]\n- [ ] Review PR #42 — auth token rotation\n- [x] Update API docs for /tasks endpoint\n\n## 02:45 PM [#meeting] [Planning]\n### Q2 Roadmap Sync\nKey decisions:\n- Ship v2 API by April 15\n- Deprecate legacy endpoints May 1"
}
```

**Use when**: The user asks what they worked on, wants to see their daily log, or needs context from a specific day. Output is capped at ~8000 characters.

---

### 5. create_log_entry

Write a timestamped entry to today's daily note timeline.

**Arguments:**
| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `content` | string | Yes | — | Entry text (supports markdown; `- [ ]` syntax creates tasks) |
| `folio` | string | No | — | Folio name to associate the entry with |
| `tags` | string[] | No | — | Tags for the entry |

**Example call:**
```json
{
  "content": "Deployed v2.3.1 to production. All health checks passing.",
  "folio": "Backend",
  "tags": ["deploy", "production"]
}
```

**Example response:**
```json
{
  "success": true,
  "entry": {
    "timestamp": "03:45 PM",
    "folio": "Backend",
    "tags": ["deploy", "production"]
  }
}
```

**Task creation shortcut**: Use checkbox markdown syntax to create tasks:
```json
{
  "content": "- [ ] Review PR #42\n- [ ] Update deployment docs",
  "folio": "Backend",
  "tags": ["todo"]
}
```

**Use when**: The user wants to log an event, add a note, or record something in today's timeline.

---

## Search Tools

### 6. search_semantic

Vector similarity search across all content — daily notes, folio text, and artifact extracted text.

**Arguments:**
| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `query` | string | Yes | — | Natural language search query |

**Example call:**
```json
{
  "query": "OAuth authentication flow implementation"
}
```

**Example response:**
```json
{
  "results": [
    {
      "score": 0.92,
      "source": "folio:Backend",
      "excerpt": "The auth service implements OAuth 2.0 with PKCE flow. Tokens are rotated every 15 minutes..."
    },
    {
      "score": 0.87,
      "source": "daily-note:2026-03-15",
      "excerpt": "Discussed token rotation strategy with Alice. Decided on 15-minute refresh window..."
    },
    {
      "score": 0.81,
      "source": "artifact:auth-design-v2.pdf",
      "excerpt": "Section 3.2 - Authentication Flow: The client initiates the PKCE challenge..."
    }
  ]
}
```

**Use when**: You need to find information across the workspace without knowing exactly where it lives.

---

## Knowledge Graph Tools

### 7. query_graph

Look up an entity in the knowledge graph and return its relationships. Includes entity metadata and a readme summary for immediate context.

**Arguments:**
| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `entity` | string | Yes | — | Entity name to look up |

**Example call:**
```json
{
  "entity": "Acme Project"
}
```

**Example response:**
```json
{
  "entity": {
    "id": "entity-uuid",
    "name": "Acme Project",
    "type": "project",
    "readme_summary": "Internal tool for managing client onboarding workflows. Built with React and Node.js...",
    "metadata": {
      "status": "active",
      "created": "2026-01-15"
    },
    "edges": [
      {
        "id": "edge-uuid",
        "type": "involves",
        "targetId": "person-uuid",
        "targetName": "Alice Chen",
        "targetType": "person"
      },
      {
        "id": "edge-uuid-2",
        "type": "uses",
        "targetId": "tool-uuid",
        "targetName": "PostgreSQL",
        "targetType": "tool"
      }
    ]
  }
}
```

**Use when**: You want to understand how a person, project, concept, or tool relates to other things.

---

### 8. list_entities

Browse knowledge graph entities with optional filters.

**Arguments:**
| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `type` | string | No | — | Filter by entity type: `person`, `project`, `concept`, `organization`, `tool`, `topic` |
| `query` | string | No | — | Search filter on entity name |
| `limit` | number | No | 20 | Maximum number of results |

**Example call:**
```json
{
  "type": "project",
  "limit": 10
}
```

**Example response:**
```json
{
  "entities": [
    {
      "name": "Acme Project",
      "type": "project",
      "edgeCount": 8
    },
    {
      "name": "Backend API",
      "type": "project",
      "edgeCount": 12
    }
  ]
}
```

**Use when**: You need to discover what entities exist before querying specific ones.

---

## Folio Management Tools

### 9. list_folios

Browse available folios in the workspace.

**Arguments:**
| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `query` | string | No | — | Search filter on folio name |

**Example call:**
```json
{
  "query": "backend"
}
```

**Example response:**
```json
{
  "folios": [
    {
      "name": "Backend",
      "commitCount": 12,
      "createdAt": "2026-01-10T08:00:00Z",
      "updatedAt": "2026-03-30T14:25:00Z"
    }
  ]
}
```

**Use when**: You need to discover what folios exist before reading or committing to one.

---

### 10. read_folio_map

Get a folio's About section and Timeline overview.

**Arguments:**
| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `folio_name` | string | Yes | — | Name of the folio to read |

**Example call:**
```json
{
  "folio_name": "Backend"
}
```

**Example response:**
```json
{
  "folio": {
    "name": "Backend",
    "about": "Backend services powering the core API. Built with Node.js, Fastify, and PostgreSQL.",
    "timeline": [
      {
        "date": "2026-03-30",
        "summary": "Implemented Redis caching layer. Reduced p95 latency by 40%."
      },
      {
        "date": "2026-03-28",
        "summary": "Fixed rate limiter race condition in /api/v1/auth endpoint."
      }
    ]
  }
}
```

**Use when**: You need project context before committing content or making decisions.

---

### 11. commit_to_folio

Append a commit entry to a folio's timeline.

**Arguments:**
| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `folio_name` | string | Yes | — | Name of the target folio |
| `content` | string | Yes | — | The content to commit |

**Example call:**
```json
{
  "folio_name": "Backend",
  "content": "Implemented Redis caching layer for session management. Reduced p95 latency by 40%."
}
```

**Example response:**
```json
{
  "success": true,
  "commit": {
    "folio": "Backend",
    "date": "2026-03-30",
    "content": "Implemented Redis caching layer for session management. Reduced p95 latency by 40%."
  }
}
```

**Use when**: You want to record a significant update, decision, or deliverable against a project.

---

### 12. update_folio_section

Modify a specific section of a folio.

**Arguments:**
| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `folio_name` | string | Yes | — | Name of the folio to update |
| `action` | string | Yes | — | The update action (e.g., `update_about`) |
| `content` | string | Yes | — | The new content for the section |

**Available actions:**
| Action | Description |
|---|---|
| `update_about` | Replace the folio's About section text |

**Example call:**
```json
{
  "folio_name": "Backend",
  "action": "update_about",
  "content": "Backend services powering the core API. Built with Node.js, Fastify, and PostgreSQL. Now includes Redis caching."
}
```

**Example response:**
```json
{
  "success": true,
  "folio": "Backend",
  "action": "update_about"
}
```

**Use when**: You need to modify a folio's metadata rather than just appending a commit.

---

## Artifact Tools

### 13. read_artifact

Read the extracted text content of an uploaded file.

**Arguments:**
| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `artifact_id` | string | Yes | — | UUID of the artifact |
| `max_tokens` | number | No | — | Maximum tokens to return (truncates if exceeded) |

**Example call:**
```json
{
  "artifact_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "max_tokens": 5000
}
```

**Example response:**
```json
{
  "artifact": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "filename": "auth-design-v2.pdf",
    "mimeType": "application/pdf"
  },
  "content": "Authentication Architecture Design v2\n\nSection 1: Overview\nThe authentication service handles all identity verification..."
}
```

**Use when**: You need to read the contents of an uploaded document. Use `max_tokens` for large files.

---

## Memory Tools

### 14. search_memories

Search distilled memories via vector similarity. Searches only the memories collection, not all content.

**Arguments:**
| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `query` | string | Yes | — | Search query |
| `limit` | number | No | 5 | Maximum number of results |

**Example call:**
```json
{
  "query": "database technology decisions",
  "limit": 5
}
```

**Example response:**
```json
{
  "memories": [
    {
      "id": "memory-uuid",
      "content": "The team decided to use PostgreSQL for the new analytics pipeline instead of ClickHouse due to operational simplicity.",
      "score": 0.91,
      "createdAt": "2026-03-28T16:00:00Z"
    },
    {
      "id": "memory-uuid-2",
      "content": "Redis selected for session caching. Evaluated Memcached but Redis won due to persistence and pub/sub features.",
      "score": 0.84,
      "createdAt": "2026-03-15T11:00:00Z"
    }
  ]
}
```

**Use when**: You want to recall past decisions, insights, or patterns.

---

### 15. create_memory

Store a distilled insight or decision as a persistent memory.

**Arguments:**
| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `content` | string | Yes | — | The memory/insight text |
| `source` | string | No | — | Provenance reference (e.g., `daily-note:2026-03-30`) |

**Example call:**
```json
{
  "content": "The team decided to use PostgreSQL for the analytics pipeline instead of ClickHouse due to operational simplicity and team familiarity.",
  "source": "daily-note:2026-03-30"
}
```

**Example response:**
```json
{
  "success": true,
  "memory": {
    "id": "memory-uuid",
    "content": "The team decided to use PostgreSQL for the analytics pipeline...",
    "createdAt": "2026-03-30T15:30:00Z"
  }
}
```

**Use when**: A significant decision, insight, or pattern emerges that should persist beyond its original context.

---

## Tool Selection Guide

| Goal | Tool |
|---|---|
| Create a task / todo | `create_task` |
| See open tasks | `list_tasks` |
| Mark a task done / reopen | `toggle_task` |
| Read today's or any day's notes | `read_daily_note` |
| Log an event or note | `create_log_entry` |
| Find information across everything | `search_semantic` |
| Understand entity relationships | `query_graph` |
| Browse entities by type | `list_entities` |
| Browse available folios | `list_folios` |
| Get project/folio context | `read_folio_map` |
| Record a project update | `commit_to_folio` |
| Modify folio metadata | `update_folio_section` |
| Read an uploaded document | `read_artifact` |
| Search past decisions/insights | `search_memories` |
| Store an important insight | `create_memory` |

## MCP vs REST

**Prefer MCP** when:
- The MCP server is connected
- You want simpler parameter passing (no headers, no workspace ID management)
- The operation is covered by one of the 15 tools above

**Fall back to REST** when:
- MCP server is not connected
- You need fine-grained control over TipTap document structure
- You need to perform operations not covered by MCP tools:
  - Creating folios (`POST /api/v1/folios`)
  - Uploading artifacts (`POST /api/v1/artifacts/upload`)
  - Getting artifact metadata (`GET /api/v1/artifacts/:id`)
  - Injecting raw blocks into daily notes (`POST /api/v1/daily-notes/inject`)
