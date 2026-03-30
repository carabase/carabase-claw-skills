---
name: carabase-daily
description: Read and write Carabase daily notes, create timestamped log entries, read notes as rendered markdown, and inject structured content blocks into the daily timeline.
metadata:
  version: "2.0.0"
  requires_env:
    - CARABASE_HOST
    - CARABASE_WORKSPACE_ID
  depends_on:
    - carabase-core
---

# Carabase Daily Notes

Read, write, and manage daily notes in a Carabase workspace. Daily notes are TipTap/ProseMirror block-structured documents keyed by date (YYYY-MM-DD). They contain log entries, tasks, and freeform content organized in `logCard` blocks with timestamps, tags, and folio associations.

**Primary interface**: MCP tools (`read_daily_note`, `create_log_entry`)
**Fallback**: REST API at `{CARABASE_HOST}/api/v1/daily-notes/`

---

## MCP Tools

### read_daily_note

Read a daily note as human-readable markdown instead of raw TipTap JSON. The server renders the document tree into a clean format with timestamp headers, task checkboxes, and folio/tag annotations.

```
Tool: read_daily_note
Arguments:
  date: "2026-03-30"                       (optional — YYYY-MM-DD, defaults to today)
```

**Returns**: Markdown-formatted representation of the day's notes. Output is capped at approximately 8000 characters with a truncation notice if exceeded.

**Rendered format example**:
```markdown
## 09:15 AM [#standup] [Backend]
Discussed deploy timeline. Targeting Friday for v2.3.1 release.

## 11:30 AM [#review] [Backend]
- [ ] Review PR #42 — auth token rotation
- [x] Update API docs for /tasks endpoint

## 02:45 PM [#meeting] [Planning]
### Q2 Roadmap Sync
Key decisions:
- Ship v2 API by April 15
- Deprecate legacy endpoints May 1
- Hire contractor for mobile work
```

**Examples**:

Read today's note:
```json
{}
```

Read yesterday's note:
```json
{
  "date": "2026-03-29"
}
```

Read a specific date:
```json
{
  "date": "2026-03-15"
}
```

---

### create_log_entry

Write a timestamped entry to today's daily note timeline. This is the simplest way to add content to a daily note.

```
Tool: create_log_entry
Arguments:
  content: "Deployed v2.3.1 to production."   (required — entry text, supports markdown)
  folio: "Backend"                             (optional — folio to associate)
  tags: ["deploy", "production"]               (optional — tags for the entry)
```

**Returns**: Confirmation of the created entry.

The server automatically:
- Generates a timestamp for the current time
- Wraps the content in a properly structured `logCard` block
- Injects the block into today's daily note
- Broadcasts the update to connected clients via SSE

**Content format**: The `content` field supports markdown-like syntax:
- Plain text becomes paragraph blocks
- `- [ ] task text` becomes task items (checkbox unchecked)
- `- [x] task text` becomes task items (checkbox checked)

**Examples**:

Simple log entry:
```json
{
  "content": "Finished migrating the user table to the new schema."
}
```

Log entry with folio and tags:
```json
{
  "content": "Deployed v2.3.1 to production. All health checks passing.",
  "folio": "Backend",
  "tags": ["deploy", "production"]
}
```

Create tasks via log entry:
```json
{
  "content": "- [ ] Review PR #42\n- [ ] Update deployment docs\n- [ ] Run load tests",
  "folio": "Backend",
  "tags": ["todo"]
}
```

Rich log entry with meeting notes:
```json
{
  "content": "### Design Review\nDiscussed the new onboarding flow. Agreed on three-step wizard approach.\n- Step 1: Account basics\n- Step 2: Workspace setup\n- Step 3: First daily note prompt",
  "folio": "Frontend",
  "tags": ["meeting", "design"]
}
```

---

## REST API Fallback

### GET /api/v1/daily-notes/:date — Get Daily Note (Raw)

Returns the daily note with its full TipTap/ProseMirror document tree.

```
GET {CARABASE_HOST}/api/v1/daily-notes/2026-03-30
Headers:
  x-workspace-id: {CARABASE_WORKSPACE_ID}
```

**Date format**: `YYYY-MM-DD`

Auto-creates the note if it does not exist.

**Response:**
```json
{
  "id": "note-uuid",
  "date": "2026-03-30",
  "documentState": [ ...blocks... ],
  "updatedAt": "2026-03-30T14:25:00Z"
}
```

### GET /api/v1/daily-notes/:date/text — Get Daily Note (Rendered Text)

Returns the daily note rendered as human-readable text, similar to what `read_daily_note` MCP tool returns.

```
GET {CARABASE_HOST}/api/v1/daily-notes/2026-03-30/text
Headers:
  x-workspace-id: {CARABASE_WORKSPACE_ID}
```

**Response:**
```json
{
  "date": "2026-03-30",
  "text": "## 09:15 AM [#standup] [Backend]\nDiscussed deploy timeline..."
}
```

### PATCH /api/v1/daily-notes/:date — Update Daily Note

Replaces the full document state. **Always GET the current state first**, modify it, then PATCH back. Never overwrite with only new content — this deletes all existing entries for the day.

```
PATCH {CARABASE_HOST}/api/v1/daily-notes/2026-03-30
Headers:
  Content-Type: application/json
  x-workspace-id: {CARABASE_WORKSPACE_ID}
Body:
{
  "documentState": [ ...existing_blocks..., new_block ]
}
```

### POST /api/v1/daily-notes/inject — Inject a Block

Append a block to today's daily note without needing to GET/modify/PATCH the full document. This is safer than the PATCH approach for simple appends.

```
POST {CARABASE_HOST}/api/v1/daily-notes/inject
Headers:
  Content-Type: application/json
  x-workspace-id: {CARABASE_WORKSPACE_ID}
Body:
{
  "block": {
    "type": "logCard",
    "attrs": {
      "timestamp": "03:45 PM",
      "visibility": "PRIVATE",
      "tags": "[\"deploy\"]",
      "folios": "[\"Backend\"]",
      "customers": "[]",
      "abandoned": "false"
    },
    "content": [
      {
        "type": "paragraph",
        "content": [
          { "type": "text", "text": "Deployed v2.3.1 to production." }
        ]
      }
    ]
  }
}
```

---

## Block Format Reference

### logCard — The Standard Wrapper

Every timestamped entry in a daily note is wrapped in a `logCard`. This is the fundamental building block.

```json
{
  "type": "logCard",
  "attrs": {
    "timestamp": "hh:mm AM/PM",
    "visibility": "PRIVATE",
    "tags": "[\"tag1\",\"tag2\"]",
    "folios": "[\"FolioName\"]",
    "customers": "[]",
    "abandoned": "false"
  },
  "content": [ ...child blocks... ]
}
```

**All `attrs` values are strings**, including the JSON arrays. This is a TipTap convention.

| Attr | Format | Description |
|---|---|---|
| `timestamp` | `"hh:mm AM/PM"` | Entry time (e.g., `"02:15 PM"`) |
| `visibility` | `"PRIVATE"` or `"PUBLIC"` | Visibility scope |
| `tags` | JSON string array | Tags (e.g., `"[\"deploy\",\"urgent\"]"`) |
| `folios` | JSON string array | Associated folios (e.g., `"[\"Backend\"]"`) |
| `customers` | JSON string array | Customer references (usually `"[]"`) |
| `abandoned` | `"true"` or `"false"` | Whether the entry was abandoned |

### Content Block Types

A logCard's `content` array can contain any of these blocks:

**paragraph** — Plain text:
```json
{
  "type": "paragraph",
  "content": [{ "type": "text", "text": "Some content here." }]
}
```

**heading** — Section header:
```json
{
  "type": "heading",
  "attrs": { "level": 3 },
  "content": [{ "type": "text", "text": "Meeting Notes" }]
}
```

**taskList / taskItem** — Checkboxes:
```json
{
  "type": "taskList",
  "content": [
    {
      "type": "taskItem",
      "attrs": { "checked": false },
      "content": [
        { "type": "paragraph", "content": [{ "type": "text", "text": "Task description" }] }
      ]
    }
  ]
}
```

**bulletList / orderedList** — Lists:
```json
{
  "type": "bulletList",
  "content": [
    {
      "type": "listItem",
      "content": [
        { "type": "paragraph", "content": [{ "type": "text", "text": "List item" }] }
      ]
    }
  ]
}
```

**codeBlock** — Code:
```json
{
  "type": "codeBlock",
  "attrs": { "language": "sql" },
  "content": [{ "type": "text", "text": "SELECT * FROM users;" }]
}
```

**blockquote** — Quotation:
```json
{
  "type": "blockquote",
  "content": [
    { "type": "paragraph", "content": [{ "type": "text", "text": "Quoted text here." }] }
  ]
}
```

### Inline Marks and Mentions

Text nodes within paragraphs can include inline marks and special mention nodes:

- **`mention`** — Person reference: renders as `@Name`
- **`folioMention`** — Folio reference: renders as `~FolioName`
- **`tagMention`** — Tag reference: renders as `#tag`

---

## Auto-Highlight Entity System

Carabase automatically detects and highlights entities mentioned in daily note content. When you write a log entry that references known entities (people, projects, tools), the system:

1. Identifies entity names in the text
2. Creates mention nodes in the document tree
3. Updates the knowledge graph with activity edges
4. Makes the content searchable via `search_semantic` and `query_graph`

This means writing natural-language log entries automatically enriches the knowledge graph. You do not need to explicitly tag entities — just mention them by name.

---

## Rendering Algorithm

When processing raw `documentState` from the REST API (not needed when using `read_daily_note` MCP tool), render blocks to human-readable text:

```
function renderNode(node):
  if node.type == "text":
    return node.text
  if node.type == "paragraph":
    return concat(renderNode(child) for child in node.content) + "\n"
  if node.type == "taskItem":
    prefix = "[x] " if node.attrs.checked else "[ ] "
    return prefix + concat(renderNode(child) for child in node.content)
  if node.type == "taskList":
    return join("\n", "- " + renderNode(child) for child in node.content)
  if node.type == "logCard":
    header = "## " + node.attrs.timestamp
    tags = JSON.parse(node.attrs.tags)
    folios = JSON.parse(node.attrs.folios)
    if tags.length: header += " " + join(" ", "[#" + t + "]" for t in tags)
    if folios.length: header += " " + join(" ", "[" + f + "]" for f in folios)
    body = join("\n", renderNode(child) for child in node.content)
    return header + "\n" + body
  if node.type == "heading":
    prefix = "#" * node.attrs.level + " "
    return prefix + concat(renderNode(child) for child in node.content) + "\n"
  if node.type == "bulletList":
    return join("\n", "- " + renderNode(child) for child in node.content)
  if node.type == "orderedList":
    return join("\n", (i+1) + ". " + renderNode(child) for i, child in enumerate(node.content))
  if node.type == "listItem":
    return concat(renderNode(child) for child in node.content)
  if node.type == "codeBlock":
    lang = node.attrs.language or ""
    code = concat(renderNode(child) for child in node.content)
    return "```" + lang + "\n" + code + "\n```\n"
  if node.type == "blockquote":
    inner = concat(renderNode(child) for child in node.content)
    return join("\n", "> " + line for line in inner.split("\n"))
  // Default: recurse
  if node.content:
    return join("\n", renderNode(child) for child in node.content)
  return ""
```

---

## Common Workflows

### "What did I work on today?"

1. Call `read_daily_note` (no arguments — defaults to today).
2. Present the rendered markdown to the user.
3. Optionally summarize: count log entries, list folios touched, highlight open tasks.

Example flow:
```
User: "What did I work on today?"

Agent:
  → read_daily_note()
  → "Here's your day so far:

     09:15 AM — Standup with Backend team. Discussed deploy timeline.
     11:30 AM — Reviewed PR #42 (auth token rotation). Still need to update API docs.
     02:45 PM — Q2 Roadmap Sync. Key decisions: ship v2 API by April 15, deprecate legacy endpoints May 1.

     You touched 2 folios (Backend, Planning) and have 1 open task."
```

### "Add a note about X"

1. Call `create_log_entry` with the content and optional folio/tags.
2. Confirm the entry was added.

Example flow:
```
User: "Add a note about the database migration — tag it deploy and associate with Backend"

Agent:
  → create_log_entry(
      content: "Completed database migration. All tables migrated to new schema, zero downtime achieved.",
      folio: "Backend",
      tags: ["deploy", "db"]
    )
  → "Logged to today's note under Backend [#deploy #db]."
```

### "Show me yesterday's log"

1. Calculate yesterday's date.
2. Call `read_daily_note` with `date` set to yesterday.
3. Present the rendered content.

Example flow:
```
User: "Show me yesterday's log"

Agent:
  → read_daily_note(date: "2026-03-29")
  → Present the rendered markdown content.
```

### Morning Review

1. Call `read_daily_note` for today (may be empty or have carryover).
2. Call `read_daily_note` for yesterday to review.
3. Call `list_tasks(checked: false)` via carabase-tasks skill for open items.
4. Present a combined summary for standup prep.

### Meeting Notes Capture

1. Call `create_log_entry` with:
   - A heading and structured content for the meeting notes
   - The relevant folio association
   - Tags like `["meeting", "team-name"]`
2. If action items emerged, use `create_task` from carabase-tasks for each.

### End-of-Day Summary

1. Call `read_daily_note` to get the full day.
2. Parse and summarize activities, decisions, and outcomes.
3. Optionally call `create_memory` (via carabase-knowledge) for key decisions worth preserving.
4. Optionally call `commit_to_folio` (via carabase-knowledge) to record project milestones.

### Inject Rich Content via REST

When you need precise control over block structure (e.g., composite entries with headings, code blocks, and lists), use `POST /api/v1/daily-notes/inject` with a fully constructed logCard block. See the Block Format Reference section above for the available block types.
