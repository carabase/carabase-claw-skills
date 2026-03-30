---
name: carabase-knowledge
description: Search content semantically, query the knowledge graph, read and manage folios, commit content, and read artifacts in Carabase.
metadata:
  version: "1.0.0"
  requires_env:
    - CARABASE_HOST
    - CARABASE_WORKSPACE_ID
  depends_on:
    - carabase-core
---

# Carabase Knowledge

Search, explore, and manage knowledge in a Carabase workspace. This skill covers semantic search, the knowledge graph, folios, and artifacts.

## Connection

All requests require:
- Base URL: `{CARABASE_HOST}/api/v1`
- Header: `x-workspace-id: {CARABASE_WORKSPACE_ID}`

---

## Semantic Search

Search across all content using vector similarity.

### Via MCP (preferred)

```
Tool: search_semantic
Arguments:
  query: "authentication flow for OAuth"
```

Returns ranked results with excerpts from daily notes, folio content, and artifact text.

### Via REST (fallback)

If MCP is not connected, there is no direct REST search endpoint. Instead, combine these approaches:
1. List folios and scan their About/Timeline text
2. Read artifacts and search their extracted text
3. Query the knowledge graph for entity matches

---

## Knowledge Graph

Carabase maintains a graph of entities (people, projects, concepts, tools) connected by typed edges (relationships).

### List All Entities

```
GET {CARABASE_HOST}/api/v1/entities
Headers:
  x-workspace-id: {CARABASE_WORKSPACE_ID}
```

**Response:**
```json
{
  "entities": [
    {
      "id": "entity-uuid",
      "name": "Acme Project",
      "type": "project",
      "metadata": { ... }
    }
  ]
}
```

### Get Entity Detail

```
GET {CARABASE_HOST}/api/v1/entities/{entityId}
Headers:
  x-workspace-id: {CARABASE_WORKSPACE_ID}
```

Returns the entity with all its edges/relationships:
```json
{
  "entity": {
    "id": "entity-uuid",
    "name": "Acme Project",
    "type": "project",
    "edges": [
      {
        "id": "edge-uuid",
        "sourceId": "entity-uuid",
        "targetId": "other-entity-uuid",
        "type": "involves",
        "targetName": "Alice"
      }
    ]
  }
}
```

### List All Edges

```
GET {CARABASE_HOST}/api/v1/edges
Headers:
  x-workspace-id: {CARABASE_WORKSPACE_ID}
```

### Via MCP

```
Tool: query_graph
Arguments:
  entity: "Acme Project"
```

Returns the entity and its connected relationships. Use this for quick lookups; use the REST endpoints for comprehensive graph traversal.

### Graph Exploration Patterns

**Find connections between two entities:**
1. Query entity A to get its edges
2. Query entity B to get its edges
3. Look for shared target/source entities (common neighbors)

**Map a project's people:**
1. Query the project entity
2. Filter edges to relationship types like "involves", "owned_by", "contributed_by"
3. Fetch each connected person entity for details

---

## Folios

Folios are named knowledge collections — like project folders. Each has an About section, Timeline, and Commits.

### List All Folios

```
GET {CARABASE_HOST}/api/v1/folios
Headers:
  x-workspace-id: {CARABASE_WORKSPACE_ID}
```

### Get Folio Detail

```
GET {CARABASE_HOST}/api/v1/folios/{folioId}
Headers:
  x-workspace-id: {CARABASE_WORKSPACE_ID}
```

### Create a Folio

```
POST {CARABASE_HOST}/api/v1/folios
Headers:
  Content-Type: application/json
  x-workspace-id: {CARABASE_WORKSPACE_ID}
Body:
{
  "name": "New Project",
  "about": "Description of the project"
}
```

### Update a Folio

```
PATCH {CARABASE_HOST}/api/v1/folios/{folioId}
Headers:
  Content-Type: application/json
  x-workspace-id: {CARABASE_WORKSPACE_ID}
Body:
{
  "name": "Updated Name",
  "about": "Updated description"
}
```

### Via MCP

**Read a folio's overview:**
```
Tool: read_folio_map
Arguments:
  folio_name: "Backend"
```
Returns the folio's About text and Timeline entries.

**Commit content to a folio:**
```
Tool: commit_to_folio
Arguments:
  folio_name: "Backend"
  content: "Added new caching layer using Redis. Reduced p95 latency by 40%."
```
Appends a commit entry to the folio's timeline.

**Update a folio section:**
```
Tool: update_folio_section
Arguments:
  folio_name: "Backend"
  action: "update_about"
  content: "Backend services powering the core API. Now includes Redis caching."
```

---

## Artifacts

Artifacts are uploaded files (PDF, CSV, images, etc.) with extracted text content.

### Get Artifact Metadata

```
GET {CARABASE_HOST}/api/v1/artifacts/{id}
Headers:
  x-workspace-id: {CARABASE_WORKSPACE_ID}
```

### Get Extracted Text

```
GET {CARABASE_HOST}/api/v1/artifacts/{id}/content
Headers:
  x-workspace-id: {CARABASE_WORKSPACE_ID}
```

### Upload an Artifact

```
POST {CARABASE_HOST}/api/v1/artifacts/upload
Headers:
  x-workspace-id: {CARABASE_WORKSPACE_ID}
Body: multipart/form-data with file
```

### Via MCP

```
Tool: read_artifact
Arguments:
  artifact_id: "artifact-uuid"
  max_tokens: 5000          (optional, limits response size)
```

---

## Memories

Memories are distilled insights that Carabase extracts from daily notes over time.

### List Memories

```
GET {CARABASE_HOST}/api/v1/memories
Headers:
  x-workspace-id: {CARABASE_WORKSPACE_ID}
```

### Create a Memory

```
POST {CARABASE_HOST}/api/v1/memories
Headers:
  Content-Type: application/json
  x-workspace-id: {CARABASE_WORKSPACE_ID}
Body:
{
  "content": "The team decided to use PostgreSQL for the new analytics pipeline instead of ClickHouse due to operational simplicity."
}
```

Use memories to store important decisions, conclusions, or insights that should persist beyond the daily note where they originated.

---

## Workflow Patterns

### Research a Topic
1. `search_semantic` with the topic query
2. Review top results — note which folios and artifacts appear
3. `read_folio_map` on relevant folios for context
4. `query_graph` on key entities for relationships
5. `read_artifact` for any referenced documents

### Onboard to a Project
1. List all folios, find the project folio
2. Read its About and Timeline via `read_folio_map`
3. Query the knowledge graph for the project entity and its connections
4. Search semantically for recent activity related to the project
5. Summarize findings for the user

### Knowledge Audit
1. List all entities and group by type
2. List all folios
3. Identify entities without folio associations
4. Report gaps in the knowledge graph
