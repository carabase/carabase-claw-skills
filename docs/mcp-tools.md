# Carabase MCP Tools Reference

Carabase exposes an MCP (Model Context Protocol) server for agent tool calls.

## Connection

- **Transport**: SSE (Server-Sent Events)
- **Endpoint**: `GET {CARABASE_HOST}/mcp/sse`
- The server is workspace-scoped — no workspace ID header is needed for MCP calls.

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

## Tools

### commit_to_folio

Add a commit entry to a folio's timeline.

**Arguments:**
| Name | Type | Required | Description |
|---|---|---|---|
| `folio_name` | string | Yes | Name of the target folio |
| `content` | string | Yes | The content to commit |

**Example:**
```json
{
  "folio_name": "Backend",
  "content": "Implemented Redis caching layer for session management. Reduced p95 latency by 40%."
}
```

**Use when**: You want to record a significant update, decision, or deliverable against a project/folio.

---

### search_semantic

Vector similarity search across all content — daily notes, folio text, and artifact extracted text.

**Arguments:**
| Name | Type | Required | Description |
|---|---|---|---|
| `query` | string | Yes | Natural language search query |

**Example:**
```json
{
  "query": "OAuth authentication flow implementation"
}
```

**Returns**: Ranked list of matching content excerpts with source references.

**Use when**: You need to find information across the workspace without knowing exactly where it lives.

---

### query_graph

Look up an entity in the knowledge graph and return its relationships.

**Arguments:**
| Name | Type | Required | Description |
|---|---|---|---|
| `entity` | string | Yes | Entity name to look up |

**Example:**
```json
{
  "entity": "Acme Project"
}
```

**Returns**: The entity with its type, metadata, and all connected edges (relationships to other entities).

**Use when**: You want to understand how a person, project, concept, or tool relates to other things in the workspace.

---

### read_artifact

Read the extracted text content of an uploaded file.

**Arguments:**
| Name | Type | Required | Description |
|---|---|---|---|
| `artifact_id` | string | Yes | UUID of the artifact |
| `max_tokens` | number | No | Maximum tokens to return (truncates if needed) |

**Example:**
```json
{
  "artifact_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "max_tokens": 5000
}
```

**Returns**: Extracted text content of the artifact (PDF, CSV, etc.).

**Use when**: You need to read the contents of an uploaded document. Use `max_tokens` for large files to avoid overwhelming context.

---

### create_log_entry

Write a timestamped entry to today's daily note timeline.

**Arguments:**
| Name | Type | Required | Description |
|---|---|---|---|
| `content` | string | Yes | The log entry text (supports markdown) |
| `folio` | string | No | Folio name to associate the entry with |
| `tags` | string[] | No | Tags for the entry |

**Example:**
```json
{
  "content": "Deployed v2.3.1 to production. All health checks passing.",
  "folio": "Backend",
  "tags": ["deploy", "production"]
}
```

**Returns**: Confirmation of the created entry.

**Use when**: You want to quickly log an event, note, or update to the daily timeline. This is the simplest way to write to a daily note.

**Task creation**: To create a task via this tool, use checkbox markdown syntax:
```json
{
  "content": "- [ ] Review PR #42\n- [ ] Update deployment docs",
  "folio": "Backend",
  "tags": ["todo"]
}
```

---

### read_folio_map

Get an overview of a folio including its About section and Timeline.

**Arguments:**
| Name | Type | Required | Description |
|---|---|---|---|
| `folio_name` | string | Yes | Name of the folio to read |

**Example:**
```json
{
  "folio_name": "Backend"
}
```

**Returns**: The folio's About text and a summary of its Timeline entries.

**Use when**: You need context about a project or topic before taking action. Good for orienting yourself before committing content or making decisions.

---

### update_folio_section

Modify a specific section of a folio.

**Arguments:**
| Name | Type | Required | Description |
|---|---|---|---|
| `folio_name` | string | Yes | Name of the folio to update |
| `action` | string | Yes | The update action to perform |
| Additional args vary by action | | | |

**Actions:**

#### `update_about`
Update the folio's About section.
```json
{
  "folio_name": "Backend",
  "action": "update_about",
  "content": "Backend services powering the core API. Built with Node.js and PostgreSQL."
}
```

**Use when**: You need to modify a specific part of a folio rather than just appending a commit.

---

## Tool Selection Guide

| Goal | Tool |
|---|---|
| Find information across the workspace | `search_semantic` |
| Understand entity relationships | `query_graph` |
| Read an uploaded document | `read_artifact` |
| Log an event or note | `create_log_entry` |
| Get project/folio context | `read_folio_map` |
| Record a project update | `commit_to_folio` |
| Modify folio metadata | `update_folio_section` |

## MCP vs REST

MCP tools are generally preferred when available because:
- They handle workspace scoping automatically
- They provide a simpler interface (no header management)
- They integrate natively with agent tool-calling flows

Fall back to REST when:
- MCP server is not connected
- You need fine-grained control over document structure (e.g., building specific block types)
- You need to perform operations not covered by MCP tools (e.g., listing all folios, uploading artifacts)
