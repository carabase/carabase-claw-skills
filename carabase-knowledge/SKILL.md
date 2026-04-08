---
name: carabase-knowledge
description: Search content semantically, route natural-language queries, query the knowledge graph, resolve entity names, filter by metadata, verify hypotheses, and manage folios, artifacts, and memories in Carabase.
metadata:
  version: "2.1.0"
  requires_env:
    - CARABASE_HOST
    - CARABASE_WORKSPACE_ID
  depends_on:
    - carabase-core
---

# Carabase Knowledge

Search, explore, and manage knowledge in a Carabase workspace. This skill covers the six canonical retrieval tools (semantic, graph, metadata, entity-resolution, router, hypothesis verification), Doctor-RAG hint repair, lazy artifact resources, folios, artifacts, and memories.

**Primary interface**: MCP tools (canonical `carabase_*` surface)
**Fallback**: REST API at `{CARABASE_HOST}/api/v1/`

> **Compatibility**: requires `carabase-host` ≥ Phase 15 (PR #64). Earlier hosts only expose the legacy `search_semantic` / `query_graph` aliases.

---

## Canonical Retrieval Tools

The host exposes **six** first-class `carabase_*` retrieval tools. Prefer these over composing REST calls. Legacy `search_semantic` and `query_graph` still work as deprecated aliases — use the canonical names.

### carabase_search_semantic (MCP)

Vector similarity search across all content — daily notes, folio text, and artifact extracted text. The broadest search tool and the best starting point when you do not know where information lives.

```
Tool: carabase_search_semantic
Arguments:
  query: "OAuth authentication flow"   (required — natural-language query)
  limit: 5                              (optional — max results)
```

**Returns**: Ranked list of hits. Each hit includes a `carabase://artifact/<id>` resource URI for the source body. **Bodies are not inlined** — fetch them on demand via `resources/read` (see [Lazy Artifact Resources](#lazy-artifact-resources)).

**Examples**:

```json
{ "query": "Redis caching layer implementation" }
```

```json
{ "query": "why we chose PostgreSQL over ClickHouse" }
```

```json
{ "query": "Alice's work on the auth service", "limit": 10 }
```

---

### carabase_search_graph (MCP)

Look up an entity in the knowledge graph and walk its relationships to a configurable depth.

```
Tool: carabase_search_graph
Arguments:
  entity: "Acme Project"   (required — entity name)
  depth: 1                  (optional — 1–3, default 1)
```

**Returns**: The entity with its type, metadata, and edges out to `depth` hops. If the entity is not found, the response includes candidate names so you can re-query.

**Examples**:

```json
{ "entity": "Acme Project" }
```

Walk two hops out from a person to discover their project ecosystem:
```json
{ "entity": "Alice Chen", "depth": 2 }
```

---

### carabase_find_entity_candidates (MCP)

Multi-strategy entity-name resolver (exact match → alias → substring). Use this **first** whenever the user gives an ambiguous or partial name — it is cheaper than guessing wrong on `carabase_search_graph`.

```
Tool: carabase_find_entity_candidates
Arguments:
  name: "alice"   (required — partial or ambiguous name)
  limit: 5         (optional)
```

**Returns**: Ranked candidate entities with name, type, and match strategy.

**Example**:
```json
{ "name": "auth" }
```

---

### carabase_query_metadata (MCP)

Filtered metadata search — pull content by tag, date range, source, or associated entity. Use this when the user's intent is structural ("things tagged X", "notes from last week") rather than semantic.

```
Tool: carabase_query_metadata
Arguments:
  tags: ["deploy", "production"]      (optional)
  date_after: "2026-03-01"            (optional, YYYY-MM-DD)
  date_before: "2026-04-01"           (optional)
  source: "daily-note"                (optional)
  entity_name: "Acme Project"         (optional)
  limit: 20                            (optional)
```

**Examples**:

Recent deploy notes:
```json
{ "tags": ["deploy"], "date_after": "2026-03-15" }
```

Everything tied to a project this quarter:
```json
{ "entity_name": "Acme Project", "date_after": "2026-01-01" }
```

---

### carabase_route_and_execute (MCP)

The lazy escape hatch. When you don't want to compose tools yourself, hand the user's natural-language query to the router and let it classify and fan out to the right strategies.

```
Tool: carabase_route_and_execute
Arguments:
  query: "what did we decide about ClickHouse last quarter?"
  concept_root_ids: ["..."]   (optional — anchor concept ids)
```

**Returns**: A composed answer set with results from whichever strategies the router picked. Treat this as the high-recall "I don't know where to look" path.

---

### carabase_verify_hypothesis (MCP)

FLARE-style claim verification. Pass a factual claim and the host runs a corroboration sweep, returning a verdict.

```
Tool: carabase_verify_hypothesis
Arguments:
  claim: "We chose PostgreSQL over ClickHouse for analytics"
  limit: 10   (optional)
```

**Returns**:
```json
{
  "verdict": "corroborated" | "contradicted" | "mixed" | "inconclusive",
  "corroborated_by": [ ... ],
  "contradicted_by": [ ... ],
  "considered": 12
}
```

**When to use**: before stating a fact you're not 100% sure about, especially when the user is acting on your answer. Branch on `verdict`:

- `corroborated` → state the fact, cite `corroborated_by`.
- `contradicted` → do **not** state the fact; surface the contradicting evidence.
- `mixed` → present both sides, ask the user.
- `inconclusive` → say you can't verify and offer to search differently.

**Example**:
```json
{ "claim": "Friday deploys were frozen starting April 2026" }
```

---

## Doctor-RAG Hint Repair

When a canonical tool returns an empty result or an error, the host appends structured trailers to the response:

```
No results found for "Sam Rivera".
[hint: Semantic search hit zero. Try (1) dropping adjectives and re-querying, (2) calling `carabase_route_and_execute` with the same query, (3) `carabase_find_entity_candidates` if "Sam Rivera" is meant as a person name.]
[trace: searched semantic for "Sam Rivera" → 0 hits]
```

**Rules for the agent**:

1. **Always read the trailer.** Do not strip `[hint: …]` / `[trace: …]` lines from tool output before reasoning over it.
2. **Act on the hint** instead of replanning from scratch. The host has already diagnosed why you got nothing — follow the suggested next call.
3. **Surface trailers verbatim** if you're explaining your reasoning to the user.

**Hint shapes you'll see**:

| Shape | When | Typical fix |
|---|---|---|
| `semanticNoResults` | `carabase_search_semantic` returns 0 | Drop adjectives, retry, or fall back to `carabase_route_and_execute`. |
| `metadataNoResults` | `carabase_query_metadata` returns 0 | Loosen filters; widen the date window; drop a tag. |
| `graphUnknownEntity` | `carabase_search_graph` can't find the entity | Call `carabase_find_entity_candidates` with the same name. |
| `candidatesNoResults` | `carabase_find_entity_candidates` returns 0 | Try a substring or alias; fall back to semantic. |
| `generic` | Any other empty/error state | Read the trace and pick a different strategy. |

---

## Lazy Artifact Resources

Tool results from the canonical retrieval tools return resource URIs of the form:

```
carabase://artifact/{id}
```

Bodies are **not** inlined into the tool result — this keeps the agent's context lean. To read the body:

```
resources/read("carabase://artifact/a1b2c3d4-...")
```

**Notes**:

- The host may return auto-compacted bodies when format-aware compaction is enabled (Phase 13). Compaction is mime-type-aware (csv, markdown, pdf, plain, code) and lossy by design — the original is still on disk if you need the REST endpoint.
- Fetch artifacts only when you need to quote or reason over the body. For "did this exist" / "is it tagged X" questions the search-tool result is enough.

---

## Folios

Folios are named knowledge collections — like project folders. Each has an About section, Timeline (activity log), and Commits (content snapshots).

### list_folios (MCP)

Browse available folios in the workspace.

```
Tool: list_folios
Arguments:
  query: "backend"   (optional)
```

**Returns**: Folio list with name, created/updated dates, and commit count.

---

### read_folio_map (MCP)

Get a folio's About section and Timeline overview. Use this to understand a project's context before committing content or making decisions.

```
Tool: read_folio_map
Arguments:
  folio_name: "Backend"   (required)
```

---

### commit_to_folio (MCP)

Append a commit entry to a folio's timeline.

```
Tool: commit_to_folio
Arguments:
  folio_name: "Backend"
  content: "Implemented Redis caching layer..."
```

---

### update_folio_section (MCP)

Modify a specific section of a folio. Currently supports updating the About section.

```
Tool: update_folio_section
Arguments:
  folio_name: "Backend"
  action: "update_about"
  content: "New about text..."
```

| Action | Description |
|---|---|
| `update_about` | Replace the folio's About section text |

### REST Fallback for Folios

```
GET    {CARABASE_HOST}/api/v1/folios
POST   {CARABASE_HOST}/api/v1/folios
GET    {CARABASE_HOST}/api/v1/folios/{folioId}
PATCH  {CARABASE_HOST}/api/v1/folios/{folioId}
```

All require `x-workspace-id: {CARABASE_WORKSPACE_ID}`.

---

## Artifacts

Artifacts are uploaded files (PDF, CSV, images, etc.) with extracted text content.

### read_artifact (MCP)

Read the extracted text content of an uploaded file directly by id. (For artifacts surfaced through `carabase_search_semantic` results, prefer the lazy `carabase://artifact/{id}` resource read.)

```
Tool: read_artifact
Arguments:
  artifact_id: "a1b2c3d4-..."
  max_tokens: 5000   (optional)
```

### REST Fallback for Artifacts

```
GET   {CARABASE_HOST}/api/v1/artifacts/{id}
GET   {CARABASE_HOST}/api/v1/artifacts/{id}/content
POST  {CARABASE_HOST}/api/v1/artifacts/upload   (multipart/form-data)
```

---

## Memories

Memories are distilled insights — important decisions, conclusions, patterns, and learnings.

### search_memories (MCP)

Search distilled memories via vector similarity. Scoped to the memories collection only — use `carabase_search_semantic` for cross-source search.

```
Tool: search_memories
Arguments:
  query: "database decision"
  limit: 5   (optional)
```

---

### create_memory (MCP)

Store a distilled insight or decision.

```
Tool: create_memory
Arguments:
  content: "The team decided to use..."
  source: "daily-note:2026-03-30"   (optional)
```

### REST Fallback for Memories

```
GET   {CARABASE_HOST}/api/v1/memories
POST  {CARABASE_HOST}/api/v1/memories
```

---

## Entity Browsing (Legacy Helper)

### list_entities (MCP)

Browse knowledge graph entities by type or name. For ambiguous lookups prefer `carabase_find_entity_candidates`.

```
Tool: list_entities
Arguments:
  type: "project"      (optional — person | project | concept | organization | tool | topic)
  query: "backend"     (optional)
  limit: 20            (optional)
```

### REST Fallback for Graph

```
GET  {CARABASE_HOST}/api/v1/entities
GET  {CARABASE_HOST}/api/v1/entities/{entityId}
GET  {CARABASE_HOST}/api/v1/edges
```

---

## Common Workflows

### "Find documents about X"

1. `carabase_search_semantic(query: "X")`.
2. Read the `[hint: …]` / `[trace: …]` trailers if results are empty — act on them.
3. For each hit's `carabase://artifact/{id}` URI, decide whether to `resources/read` the body.
4. Synthesize an answer with source references.

### "Who is connected to Y?"

1. `carabase_find_entity_candidates(name: "Y")` if the name is ambiguous.
2. `carabase_search_graph(entity: "<resolved>", depth: 2)`.
3. Parse edges to identify connected people, projects, concepts.

### "What folios exist?"

1. `list_folios()`.
2. `read_folio_map(folio_name: …)` for any the user wants to drill into.

### Research a Topic

1. `carabase_route_and_execute(query: "<topic>")` — let the router pick strategies.
2. Or compose manually: `carabase_search_semantic` → `carabase_search_graph` → `search_memories`.
3. Pull artifact bodies lazily as needed.
4. Synthesize.

### Verify a Fact Before Answering

When you're about to state a load-bearing fact (a decision, a number, a deadline) and you're not 100% sure:

1. `carabase_verify_hypothesis(claim: "<the fact, stated declaratively>")`.
2. Branch on the verdict:
   - `corroborated` → state the fact and cite `corroborated_by`.
   - `contradicted` → retract; tell the user the evidence points the other way.
   - `mixed` → present both sides; ask the user which interpretation matches their question.
   - `inconclusive` → say you can't verify and offer a different search.

Example:
```
User: "Did we end up freezing Friday deploys?"

Agent:
  → carabase_verify_hypothesis(claim: "Friday deploys are frozen at Carabase")
  → verdict: "corroborated", corroborated_by: [memory:..., daily-note:2026-03-28]
  → "Yes — that decision was made on Mar 28 and recorded as a memory.
     Source: daily note from 2026-03-28."
```

### Onboard to a Project

1. `list_folios` → find the project folio.
2. `read_folio_map` → read its About and Timeline.
3. `carabase_find_entity_candidates(name: "<project>")` → resolve the entity.
4. `carabase_search_graph(entity: …, depth: 2)` → people and dependencies.
5. `carabase_query_metadata(entity_name: …, date_after: "<recent>")` → recent activity.
6. `search_memories(query: "<project>")` → key decisions.

### Store a Key Decision

1. `create_memory` with the decision and rationale.
2. `commit_to_folio` to record it against the relevant project.

---

## Deprecated Aliases

The host still registers `search_semantic` and `query_graph` as backwards-compatible aliases for `carabase_search_semantic` and `carabase_search_graph`. **Do not use them in new flows** — they will be removed in a future host release.
