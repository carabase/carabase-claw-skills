---
name: carabase-knowledge
description: Search content semantically, query the knowledge graph, browse and manage folios, read artifacts, and work with memories in Carabase.
metadata:
  version: "2.0.0"
  requires_env:
    - CARABASE_HOST
    - CARABASE_WORKSPACE_ID
  depends_on:
    - carabase-core
---

# Carabase Knowledge

Search, explore, and manage knowledge in a Carabase workspace. This skill covers semantic search, the knowledge graph, folios (project knowledge collections), artifacts (uploaded files), and memories (distilled insights).

**Primary interface**: MCP tools
**Fallback**: REST API at `{CARABASE_HOST}/api/v1/`

---

## Semantic Search

### search_semantic (MCP)

Vector similarity search across all content — daily notes, folio text, and artifact extracted text. This is the broadest search tool and the best starting point when you do not know where information lives.

```
Tool: search_semantic
Arguments:
  query: "OAuth authentication flow"        (required — natural language search query)
```

**Returns**: Ranked list of matching content excerpts with source references (daily note date, folio name, artifact ID).

**Examples**:

Find implementation details:
```json
{
  "query": "Redis caching layer implementation"
}
```

Find decisions about a topic:
```json
{
  "query": "why we chose PostgreSQL over ClickHouse"
}
```

Find mentions of a person or project:
```json
{
  "query": "Alice's work on the auth service"
}
```

**REST fallback**: There is no direct REST search endpoint. When MCP is unavailable, approximate search by:
1. Listing folios and scanning their About/Timeline text
2. Reading artifacts and searching their extracted text
3. Querying the knowledge graph for entity matches

---

## Knowledge Graph

Carabase maintains a graph of entities (people, projects, concepts, organizations, tools, topics) connected by typed edges (relationships). The graph is automatically enriched as entities are mentioned in daily notes.

### query_graph (MCP)

Look up an entity in the knowledge graph and return its relationships. Includes the entity's type, metadata, and a summary.

```
Tool: query_graph
Arguments:
  entity: "Acme Project"                    (required — entity name to look up)
```

**Returns**: The entity with its type, metadata (including readme summary), and all connected edges.

**Examples**:

Look up a project:
```json
{
  "entity": "Acme Project"
}
```

Look up a person:
```json
{
  "entity": "Alice Chen"
}
```

Look up a concept:
```json
{
  "entity": "OAuth 2.0"
}
```

**Response includes**:
- Entity name, type, and metadata
- `readme_summary` — first 500 characters of the entity's description
- All edges with relationship types and connected entity names

---

### list_entities (MCP)

Browse knowledge graph entities with optional type and name filters. Useful for discovery when you do not know exact entity names.

```
Tool: list_entities
Arguments:
  type: "project"                           (optional — filter by entity type)
  query: "backend"                          (optional — search filter on entity name)
  limit: 20                                 (optional — max results, default 20)
```

**Entity types**: `person`, `project`, `concept`, `organization`, `tool`, `topic`

**Returns**: Entity list with name, type, and connection count (number of edges).

**Examples**:

List all projects:
```json
{
  "type": "project"
}
```

Search for entities matching a term:
```json
{
  "query": "auth"
}
```

List people:
```json
{
  "type": "person",
  "limit": 50
}
```

### REST Fallback for Graph

**List entities:**
```
GET {CARABASE_HOST}/api/v1/entities
Headers:
  x-workspace-id: {CARABASE_WORKSPACE_ID}
```

**Get entity detail with edges:**
```
GET {CARABASE_HOST}/api/v1/entities/{entityId}
Headers:
  x-workspace-id: {CARABASE_WORKSPACE_ID}
```

Response:
```json
{
  "entity": {
    "id": "entity-uuid",
    "name": "Acme Project",
    "type": "project",
    "metadata": {},
    "edges": [
      {
        "id": "edge-uuid",
        "sourceId": "entity-uuid",
        "targetId": "other-entity-uuid",
        "type": "involves",
        "targetName": "Alice Chen"
      }
    ]
  }
}
```

**List all edges:**
```
GET {CARABASE_HOST}/api/v1/edges
Headers:
  x-workspace-id: {CARABASE_WORKSPACE_ID}
```

### Graph Exploration Patterns

**Find connections between two entities:**
1. `query_graph(entity: "Entity A")` — get A's edges
2. `query_graph(entity: "Entity B")` — get B's edges
3. Look for shared target/source entities (common neighbors)

**Map a project's people:**
1. `query_graph(entity: "Project Name")`
2. Filter edges to types: "involves", "owned_by", "contributed_by"
3. Each connected entity is a person or team associated with the project

**Discover the full graph landscape:**
1. `list_entities()` — see all entities
2. Group by type for an overview
3. Drill into specific entities with `query_graph`

---

## Folios

Folios are named knowledge collections — like project folders. Each has an About section, Timeline (activity log), and Commits (content snapshots).

### list_folios (MCP)

Browse available folios in the workspace. Helps discover context before using `read_folio_map` or `commit_to_folio`.

```
Tool: list_folios
Arguments:
  query: "backend"                          (optional — search filter on folio name)
```

**Returns**: Folio list with name, created/updated dates, and commit count.

**Examples**:

List all folios:
```json
{}
```

Search for folios:
```json
{
  "query": "API"
}
```

---

### read_folio_map (MCP)

Get a folio's About section and Timeline overview. Use this to understand a project's context before committing content or making decisions.

```
Tool: read_folio_map
Arguments:
  folio_name: "Backend"                     (required — name of the folio)
```

**Returns**: The folio's About text and a summary of its Timeline entries.

**Example**:
```json
{
  "folio_name": "Backend"
}
```

---

### commit_to_folio (MCP)

Append a commit entry to a folio's timeline. Use this to record significant updates, decisions, or deliverables.

```
Tool: commit_to_folio
Arguments:
  folio_name: "Backend"                     (required — target folio name)
  content: "Implemented Redis caching..."   (required — the content to commit)
```

**Examples**:

Record a deliverable:
```json
{
  "folio_name": "Backend",
  "content": "Implemented Redis caching layer for session management. Reduced p95 latency by 40%."
}
```

Record a decision:
```json
{
  "folio_name": "Planning",
  "content": "Decided to use PostgreSQL for analytics pipeline instead of ClickHouse. Rationale: operational simplicity, team familiarity, and sufficient performance for current scale."
}
```

---

### update_folio_section (MCP)

Modify a specific section of a folio. Currently supports updating the About section.

```
Tool: update_folio_section
Arguments:
  folio_name: "Backend"                     (required — target folio name)
  action: "update_about"                    (required — the update action)
  content: "New about text..."              (required — the new content)
```

**Available actions:**

| Action | Description |
|---|---|
| `update_about` | Replace the folio's About section text |

**Example**:
```json
{
  "folio_name": "Backend",
  "action": "update_about",
  "content": "Backend services powering the core API. Built with Node.js, Fastify, and PostgreSQL. Now includes Redis caching layer."
}
```

### REST Fallback for Folios

**List folios:**
```
GET {CARABASE_HOST}/api/v1/folios
Headers:
  x-workspace-id: {CARABASE_WORKSPACE_ID}
```

**Create a folio:**
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

**Get folio detail:**
```
GET {CARABASE_HOST}/api/v1/folios/{folioId}
Headers:
  x-workspace-id: {CARABASE_WORKSPACE_ID}
```

**Update a folio:**
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

---

## Artifacts

Artifacts are uploaded files (PDF, CSV, images, etc.) with extracted text content. The extraction pipeline processes uploaded files and stores searchable text.

### read_artifact (MCP)

Read the extracted text content of an uploaded file.

```
Tool: read_artifact
Arguments:
  artifact_id: "a1b2c3d4-..."              (required — UUID of the artifact)
  max_tokens: 5000                          (optional — limits response size)
```

**Returns**: Extracted text content of the artifact.

**Examples**:

Read full artifact text:
```json
{
  "artifact_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

Read with token limit (for large documents):
```json
{
  "artifact_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "max_tokens": 3000
}
```

**Tip**: Use `max_tokens` for large files (PDFs, long CSVs) to avoid overwhelming your context window. Start with a smaller limit and request more if needed.

### REST Fallback for Artifacts

**Get artifact metadata:**
```
GET {CARABASE_HOST}/api/v1/artifacts/{id}
Headers:
  x-workspace-id: {CARABASE_WORKSPACE_ID}
```

Response:
```json
{
  "artifact": {
    "id": "uuid",
    "filename": "report.pdf",
    "mimeType": "application/pdf",
    "size": 245000,
    "createdAt": "2026-03-30T10:00:00Z"
  }
}
```

**Get extracted text:**
```
GET {CARABASE_HOST}/api/v1/artifacts/{id}/content
Headers:
  x-workspace-id: {CARABASE_WORKSPACE_ID}
```

**Upload an artifact:**
```
POST {CARABASE_HOST}/api/v1/artifacts/upload
Headers:
  x-workspace-id: {CARABASE_WORKSPACE_ID}
Content-Type: multipart/form-data
Body: file field with the uploaded file
```

---

## Memories

Memories are distilled insights extracted from daily notes over time or created explicitly. They capture important decisions, conclusions, patterns, and learnings that should persist beyond the daily note where they originated.

### search_memories (MCP)

Search distilled memories via vector similarity. Separate from `search_semantic` — this searches only the memories collection, not all content.

```
Tool: search_memories
Arguments:
  query: "database decision"                (required — search query)
  limit: 5                                  (optional — max results, default 5)
```

**Returns**: Ranked list of matching memories with content and creation date.

**Examples**:

Search for past decisions:
```json
{
  "query": "technology choices for analytics"
}
```

Search for patterns:
```json
{
  "query": "deployment process lessons learned"
}
```

---

### create_memory (MCP)

Store a distilled insight or decision as a persistent memory. The memory is embedded for vector search and becomes findable via `search_memories`.

```
Tool: create_memory
Arguments:
  content: "The team decided to use..."     (required — the memory text)
  source: "daily-note:2026-03-30"           (optional — provenance reference)
```

**Returns**: Confirmation with the created memory ID.

**Examples**:

Store a decision:
```json
{
  "content": "The team decided to use PostgreSQL for the new analytics pipeline instead of ClickHouse due to operational simplicity and team familiarity.",
  "source": "daily-note:2026-03-30"
}
```

Store a learned pattern:
```json
{
  "content": "Deployments on Fridays have a 3x higher rollback rate. Team agreed to freeze Friday deploys starting April.",
  "source": "daily-note:2026-03-28"
}
```

Store an insight without a specific source:
```json
{
  "content": "The auth service handles approximately 50k token validations per minute at peak. This is the current scaling bottleneck."
}
```

### REST Fallback for Memories

**List memories:**
```
GET {CARABASE_HOST}/api/v1/memories
Headers:
  x-workspace-id: {CARABASE_WORKSPACE_ID}
```

**Create a memory:**
```
POST {CARABASE_HOST}/api/v1/memories
Headers:
  Content-Type: application/json
  x-workspace-id: {CARABASE_WORKSPACE_ID}
Body:
{
  "content": "The memory text here."
}
```

---

## Common Workflows

### "Find documents about X"

1. Call `search_semantic(query: "X")` to find relevant content across all sources.
2. Review results — note which folios, daily notes, and artifacts appear.
3. For folio results: call `read_folio_map` on relevant folios for full context.
4. For artifact results: call `read_artifact` on referenced documents.
5. Present a synthesized answer with source references.

Example flow:
```
User: "Find documents about our authentication architecture"

Agent:
  → search_semantic(query: "authentication architecture")
  → Results reference Backend folio and artifact "auth-design-v2.pdf"
  → read_folio_map(folio_name: "Backend")
  → read_artifact(artifact_id: "a1b2...", max_tokens: 5000)
  → "Found relevant content in 3 sources:
     1. Backend folio — describes OAuth 2.0 flow with PKCE...
     2. Auth Design v2 PDF — detailed architecture diagram and sequence flows...
     3. Daily note from Mar 15 — meeting notes about token rotation strategy..."
```

### "Who is connected to Y?"

1. Call `query_graph(entity: "Y")` to get the entity and its edges.
2. Parse edges to identify connected people, projects, and concepts.
3. For deeper context, call `query_graph` on the connected entities.

Example flow:
```
User: "Who is connected to the Acme Project?"

Agent:
  → query_graph(entity: "Acme Project")
  → Returns edges: involves→Alice, involves→Bob, uses→PostgreSQL, blocked_by→Legal Review
  → "The Acme Project involves Alice and Bob, uses PostgreSQL, and is currently blocked by Legal Review."
```

### "What folios exist?"

1. Call `list_folios()` to browse all folios.
2. Present the list with names and activity indicators (commit count, last updated).
3. If the user asks about a specific folio, call `read_folio_map` for details.

Example flow:
```
User: "What projects are tracked in Carabase?"

Agent:
  → list_folios()
  → "You have 6 folios:
     - Backend (12 commits, last updated today)
     - Frontend (8 commits, last updated Mar 28)
     - Planning (5 commits, last updated Mar 27)
     - DevOps (3 commits, last updated Mar 25)
     - Design (2 commits, last updated Mar 20)
     - Hiring (1 commit, last updated Mar 15)"
```

### Research a Topic

1. `search_semantic` with the topic query
2. Review top results — note which folios and artifacts appear
3. `read_folio_map` on relevant folios for project context
4. `query_graph` on key entities for relationship context
5. `read_artifact` for any referenced documents
6. `search_memories` for past decisions and insights related to the topic
7. Synthesize findings

### Onboard to a Project

1. `list_folios` — find the project folio
2. `read_folio_map` — read its About and Timeline
3. `query_graph` — look up the project entity and its connections
4. `search_semantic` — find recent activity related to the project
5. `search_memories` — find key decisions about the project
6. Summarize the project: purpose, people involved, recent activity, key decisions

### Knowledge Audit

1. `list_entities` — list all entities, group by type
2. `list_folios` — list all folios
3. Cross-reference: identify entities without folio associations
4. `search_memories` — check for orphaned insights
5. Report gaps in the knowledge graph and suggest improvements

### Store a Key Decision

1. When a significant decision is made during a conversation or extracted from notes:
2. Call `create_memory` with a clear statement of the decision and rationale.
3. Call `commit_to_folio` to record the decision against the relevant project.
4. Both actions ensure the decision is discoverable via different search paths.
