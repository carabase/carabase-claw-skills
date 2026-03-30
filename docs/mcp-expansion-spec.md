# MCP Tool Expansion Spec — Carabase Agent Integration

**Author**: Lex (via OpenClaw)  
**Date**: 2026-03-30  
**Status**: Draft  
**Repo**: ntherkelsen/Dugout.ai  

---

## Summary

Carabase's MCP server currently exposes 7 tools. This spec proposes **8 new tools** and **2 tool upgrades** to make Carabase a first-class agent workspace — enabling any MCP-connected agent (OpenClaw, Claude Desktop, Cursor, etc.) to fully manage tasks, read daily notes, browse folios, and interact with the knowledge graph without REST API workarounds.

---

## Current State

### Existing MCP Tools (7)

| Tool | Purpose | Gap |
|---|---|---|
| `commit_to_folio` | Add content to a folio | ✅ Good |
| `search_semantic` | Vector search across artifacts | ✅ Good |
| `query_graph` | Entity relationship lookup | 🟡 No entity listing |
| `read_artifact` | Read uploaded file content | ✅ Good |
| `create_log_entry` | Write to daily timeline | 🟡 Creates log cards only, no tasks |
| `read_folio_map` | Get folio About + Timeline | 🟡 No folio listing |
| `update_folio_section` | Patch folio About/Timeline | ✅ Good |

### What Agents Can't Do Today

1. **Create tasks** — Must GET daily note JSON, manually construct TipTap block, PATCH the entire document back. Fragile and format-dependent.
2. **List/filter tasks** — REST endpoint exists but no MCP tool. Agent must know the REST API and workspace ID header convention.
3. **Read daily notes** — Can only get raw TipTap JSON (deeply nested block tree). No human-readable rendering.
4. **List folios** — `read_folio_map` requires knowing the exact folio name. No discovery tool.
5. **List entities** — `query_graph` requires knowing entity names. No browse/discovery.
6. **Create memories** — REST endpoint exists, no MCP tool.

---

## Proposed New Tools

### P0 — Critical (Task Management)

#### 1. `create_task`

Create a task in the user's daily note. Injects a properly formatted `taskList` > `taskItem` block, optionally wrapped in a `logCard` for folio/tag context.

```typescript
{
  name: "create_task",
  params: {
    text: z.string().describe("Task description"),
    folio: z.string().optional().describe("Folio to tag the task with"),
    tags: z.array(z.string()).optional().describe("Tags (e.g., ['urgent', 'legal'])"),
    date: z.string().optional().describe("Target date (YYYY-MM-DD). Defaults to today."),
  }
}
```

**Implementation**: 
- Resolve folio name → ID (fuzzy match, same pattern as `create_log_entry`)
- Build `logCard` block with `taskList` > `taskItem` child
- Use `injectBlockAndBroadcast()` to append to the daily note
- Block format:

```json
{
  "type": "logCard",
  "attrs": {
    "timestamp": "<HH:MM AM/PM>",
    "visibility": "PRIVATE",
    "tags": "<JSON array>",
    "folios": "<JSON array>",
    "customers": "[]",
    "abandoned": "false"
  },
  "content": [{
    "type": "taskList",
    "content": [{
      "type": "taskItem",
      "attrs": { "checked": false },
      "content": [{
        "type": "paragraph",
        "content": [{ "type": "text", "text": "<task text>" }]
      }]
    }]
  }]
}
```

**Return**: Confirmation with task text, date, folio, and tags.

---

#### 2. `list_tasks`

Retrieve tasks across daily notes with optional filters.

```typescript
{
  name: "list_tasks",
  params: {
    checked: z.boolean().optional().describe("Filter by completion status"),
    folio: z.string().optional().describe("Filter by folio name"),
    tag: z.string().optional().describe("Filter by tag"),
    date_from: z.string().optional().describe("Start date (YYYY-MM-DD)"),
    date_to: z.string().optional().describe("End date (YYYY-MM-DD)"),
    limit: z.number().optional().default(20).describe("Max results"),
  }
}
```

**Implementation**: 
- Reuse `extractTasks()` from `routes/tasks.ts` (extract to shared util)
- Apply filters post-extraction
- Sort: unchecked first, then by date descending

**Return**: Formatted task list with ID, text, status, date, folio, tags.

---

#### 3. `toggle_task`

Check or uncheck a task by its composite ID.

```typescript
{
  name: "toggle_task",
  params: {
    task_id: z.string().describe("Task ID in format 'YYYY-MM-DD:nodeIndex'"),
    checked: z.boolean().describe("New checked state"),
  }
}
```

**Implementation**: 
- Parse `task_id` → `date` + `nodeIndex`
- Reuse `toggleTaskInDoc()` from `routes/tasks.ts`
- Save and broadcast via SSE

**Return**: Confirmation with task text and new state.

---

### P1 — Important (Discovery & Context)

#### 4. `list_folios`

Browse available folios in the workspace.

```typescript
{
  name: "list_folios",
  params: {
    query: z.string().optional().describe("Optional search filter"),
  }
}
```

**Implementation**: 
- Query `folios` table, filter by `ilike` if query provided
- Return name, created/updated dates, commit count

**Return**: Formatted folio list. Helps agents discover context before using `read_folio_map` or `commit_to_folio`.

---

#### 5. `read_daily_note`

Read a daily note as human-readable markdown (not raw TipTap JSON).

```typescript
{
  name: "read_daily_note",
  params: {
    date: z.string().optional().describe("Date to read (YYYY-MM-DD). Defaults to today."),
  }
}
```

**Implementation**: 
- Fetch daily note by date
- Walk the TipTap document tree and render to markdown:
  - `logCard` → timestamp header + content
  - `taskList`/`taskItem` → `- [ ]` / `- [x]` checkboxes
  - `heading` → `##` / `###`
  - `paragraph` → plain text
  - `bulletList`/`orderedList` → `- ` / `1. `
  - `folioMention` → `~FolioName`
  - `tagMention` → `#tag`
  - `mention` → `@name`
- Cap output at ~8000 chars with truncation notice

**Return**: Readable markdown representation of the day's notes.

**Note**: This is probably the highest-impact P1 tool. Without it, agents get a wall of nested JSON that burns context and requires custom parsing logic.

---

#### 6. `list_entities`

Browse knowledge graph entities.

```typescript
{
  name: "list_entities",
  params: {
    type: z.enum(["person", "project", "concept", "organization", "tool", "topic"])
      .optional().describe("Filter by entity type"),
    query: z.string().optional().describe("Search filter on entity name"),
    limit: z.number().optional().default(20),
  }
}
```

**Implementation**: 
- Query `entities` table with optional type/name filters
- Include edge count per entity for relevance signal

**Return**: Entity list with name, type, and connection count.

---

### P2 — Nice to Have (Memory & Artifacts)

#### 7. `create_memory`

Store a distilled insight or memory.

```typescript
{
  name: "create_memory",
  params: {
    content: z.string().describe("The memory/insight to store"),
    source: z.string().optional().describe("Where this came from (e.g., 'daily-note:2026-03-30')"),
  }
}
```

**Implementation**: Insert into `memories` table, trigger embedding.

---

#### 8. `search_memories`

Search distilled memories (separate from artifact search).

```typescript
{
  name: "search_memories",
  params: {
    query: z.string().describe("Search query"),
    limit: z.number().optional().default(5),
  }
}
```

**Implementation**: Vector search against memories table.

---

## Proposed Tool Upgrades

### Upgrade 1: `create_log_entry` → support task blocks

Add an optional `as_task: boolean` parameter to `create_log_entry`. When true, the injected block uses `taskList` > `taskItem` instead of plain text content.

This is a lighter alternative to a standalone `create_task` if you want to avoid tool proliferation — but a dedicated `create_task` is cleaner for agent ergonomics.

**Recommendation**: Add `create_task` as a separate tool AND add `as_task` to `create_log_entry` for flexibility.

### Upgrade 2: `query_graph` → include entity metadata

Currently returns only edges. Add the entity's `readme_summary` (first 500 chars) and `type` to the response so agents don't need a follow-up call for basic context.

---

## Implementation Notes

### Shared Utilities (Refactor)

Several functions in `routes/tasks.ts` should be extracted to `services/task-utils.ts`:
- `extractTasks()` — used by both REST endpoint and `list_tasks` MCP tool
- `toggleTaskInDoc()` — used by both REST endpoint and `toggle_task` MCP tool
- `extractTextFromNode()` — useful for `read_daily_note` renderer

### TipTap → Markdown Renderer

`read_daily_note` needs a document tree → markdown converter. This should live in `services/document-renderer.ts` and handle all current node types:

```
logCard, heading, paragraph, bulletList, orderedList, listItem,
taskList, taskItem, blockquote, codeBlock, horizontalRule,
text, mention, folioMention, tagMention
```

This renderer would also be useful for:
- Email digests / notification previews
- Export functionality
- Search indexing (better than raw JSON)

### Registration

All new tools register in `createMcpServer()` in `services/mcp-server.ts`, following the existing `withLlmErrors` wrapper pattern.

---

## Priority & Effort Estimates

| Tool | Priority | Effort | Dependencies |
|---|---|---|---|
| `create_task` | P0 | Small | `injectBlockAndBroadcast` (exists) |
| `list_tasks` | P0 | Small | Extract `extractTasks` to shared util |
| `toggle_task` | P0 | Small | Extract `toggleTaskInDoc` to shared util |
| `list_folios` | P1 | Tiny | Simple DB query |
| `read_daily_note` | P1 | Medium | New TipTap→Markdown renderer |
| `list_entities` | P1 | Tiny | Simple DB query + count |
| `create_memory` | P2 | Small | Existing memory insert pattern |
| `search_memories` | P2 | Small | Existing vector search pattern |

**Total estimated effort**: ~1–2 days for all P0+P1 tools. P2 is gravy.

---

## Testing

Each tool should be testable via the MCP SSE endpoint:
1. Connect to `/mcp/sse`
2. Call tool with test parameters
3. Verify via REST API that the side effect occurred (e.g., task appears in `GET /api/v1/tasks`)

Agent-level testing: install the `carabase-claw-skills` and verify end-to-end flows:
- "Create a task" → `create_task` MCP call → task visible in UI
- "What did I do today?" → `read_daily_note` → readable summary
- "List my projects" → `list_folios` → folio names returned

---

## Open Questions

1. **Bulk task creation** — Should `create_task` accept an array of tasks? (Useful for meeting action items.) Recommendation: start single, add batch later.
2. **Task deletion** — Not specced. Tasks live inside daily note blocks so "deleting" means removing a block from the doc tree. Worth adding or just let users toggle to checked?
3. **Sub-tasks** — TipTap supports nested task lists. Should `create_task` support `parent_task_id`? Recommendation: defer.
4. **Notifications** — Should `create_task` optionally notify connected clients beyond SSE? (e.g., push notification to Tauri app)
