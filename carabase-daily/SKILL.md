---
name: carabase-daily
description: Read and write Carabase daily notes, create timestamped log entries, and inject structured content blocks into the daily timeline.
metadata:
  version: "1.0.0"
  requires_env:
    - CARABASE_HOST
    - CARABASE_WORKSPACE_ID
  depends_on:
    - carabase-core
---

# Carabase Daily Notes

Read, write, and manage daily notes in a Carabase workspace. Daily notes are TipTap/ProseMirror block-structured documents keyed by date (YYYY-MM-DD). They contain log entries, tasks, and freeform content organized in `logCard` blocks.

## Connection

All requests require:
- Base URL: `{CARABASE_HOST}/api/v1`
- Header: `x-workspace-id: {CARABASE_WORKSPACE_ID}`

---

## Read a Daily Note

```
GET {CARABASE_HOST}/api/v1/daily-notes/{date}
Headers:
  x-workspace-id: {CARABASE_WORKSPACE_ID}
```

**Date format**: `YYYY-MM-DD` (e.g., `2026-03-30`)

**Response:**
```json
{
  "id": "note-uuid",
  "date": "2026-03-30",
  "documentState": [ ...blocks... ],
  "updatedAt": "2026-03-30T14:25:00Z"
}
```

If no note exists for the date, one is auto-created and returned.

### Rendering Block Content as Human-Readable Text

The `documentState` is an array of TipTap/ProseMirror block nodes. To present it to a user, walk the tree and render each block type:

| Block Type | Rendering |
|---|---|
| `logCard` | Section with timestamp, tags, and folios from `attrs`. Render child content indented. |
| `paragraph` | Plain text. Concatenate all child `text` nodes. |
| `taskList` | List of tasks. Render each child `taskItem`. |
| `taskItem` | `[x]` or `[ ]` prefix based on `attrs.checked`, followed by paragraph text. |
| `heading` | Prefix with `#` repeated by level (from `attrs.level`). |
| `bulletList` | Render child `listItem` nodes with `-` prefix. |
| `orderedList` | Render child `listItem` nodes with `1.`, `2.`, etc. |
| `listItem` | Render child paragraph content. |
| `codeBlock` | Wrap in triple backticks. Use `attrs.language` if present. |
| `blockquote` | Prefix lines with `>`. |

**Example rendering of a logCard:**
```
## 02:15 PM [#review] [Backend]
- [ ] Review PR #42
- [x] Update API docs
Some additional notes about the review process.
```

**Rendering algorithm:**
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
    return join("\n", renderNode(child) for child in node.content)
  if node.type == "logCard":
    header = "## " + node.attrs.timestamp
    tags = JSON.parse(node.attrs.tags)
    folios = JSON.parse(node.attrs.folios)
    if tags.length: header += " " + join(" ", "[#" + t + "]" for t in tags)
    if folios.length: header += " " + join(" ", "[" + f + "]" for f in folios)
    body = join("\n", renderNode(child) for child in node.content)
    return header + "\n" + body
  // Default: recurse into children
  if node.content:
    return join("\n", renderNode(child) for child in node.content)
  return ""
```

---

## Create a Log Entry

### Via MCP (preferred)

```
Tool: create_log_entry
Arguments:
  content: "Finished migrating the user table to the new schema."
  folio: "Backend"           (optional — associates with a folio)
  tags: ["deploy", "db"]     (optional — tags for the entry)
```

This creates a timestamped logCard in today's daily note with the given content. It's the simplest way to add entries.

### Via REST

To create a log entry via REST, follow the same append-and-patch pattern as task creation:

#### Step 1: Get Today's Note

```
GET {CARABASE_HOST}/api/v1/daily-notes/{today}
```

#### Step 2: Build a logCard Block

```json
{
  "type": "logCard",
  "attrs": {
    "timestamp": "03:45 PM",
    "visibility": "PRIVATE",
    "tags": "[\"deploy\",\"db\"]",
    "folios": "[\"Backend\"]",
    "customers": "[]",
    "abandoned": "false"
  },
  "content": [
    {
      "type": "paragraph",
      "content": [
        {
          "type": "text",
          "text": "Finished migrating the user table to the new schema."
        }
      ]
    }
  ]
}
```

**Attrs format reminders:**
- All attr values are **strings**
- `tags` and `folios` are JSON-encoded string arrays: `"[\"tag1\",\"tag2\"]"`
- `timestamp` format: `hh:mm AM/PM`
- `visibility`: `"PRIVATE"` or `"PUBLIC"`
- `abandoned`: `"false"` (string, not boolean)

#### Step 3: Append and Save

```
PATCH {CARABASE_HOST}/api/v1/daily-notes/{today}
Headers:
  Content-Type: application/json
  x-workspace-id: {CARABASE_WORKSPACE_ID}
Body:
{
  "documentState": [ ...existing_blocks..., new_logCard ]
}
```

**Critical**: Always GET the current documentState first, then append. Never overwrite with only the new block — this would delete all existing content for the day.

---

## Inject Rich Content Blocks

For content beyond simple text paragraphs, build the appropriate TipTap block structure.

### Heading + Text

```json
[
  {
    "type": "heading",
    "attrs": { "level": 3 },
    "content": [{ "type": "text", "text": "Meeting Notes" }]
  },
  {
    "type": "paragraph",
    "content": [{ "type": "text", "text": "Discussed the Q2 roadmap..." }]
  }
]
```

### Bullet List

```json
{
  "type": "bulletList",
  "content": [
    {
      "type": "listItem",
      "content": [
        {
          "type": "paragraph",
          "content": [{ "type": "text", "text": "First point" }]
        }
      ]
    },
    {
      "type": "listItem",
      "content": [
        {
          "type": "paragraph",
          "content": [{ "type": "text", "text": "Second point" }]
        }
      ]
    }
  ]
}
```

### Code Block

```json
{
  "type": "codeBlock",
  "attrs": { "language": "sql" },
  "content": [
    { "type": "text", "text": "ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT false;" }
  ]
}
```

### Composite logCard with Mixed Content

Wrap multiple content types in a single logCard:

```json
{
  "type": "logCard",
  "attrs": {
    "timestamp": "04:00 PM",
    "visibility": "PRIVATE",
    "tags": "[\"meeting\",\"roadmap\"]",
    "folios": "[\"Planning\"]",
    "customers": "[]",
    "abandoned": "false"
  },
  "content": [
    {
      "type": "heading",
      "attrs": { "level": 3 },
      "content": [{ "type": "text", "text": "Q2 Roadmap Meeting" }]
    },
    {
      "type": "paragraph",
      "content": [{ "type": "text", "text": "Key decisions from today's sync:" }]
    },
    {
      "type": "bulletList",
      "content": [
        {
          "type": "listItem",
          "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Ship v2 API by April 15" }] }]
        },
        {
          "type": "listItem",
          "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Deprecate legacy endpoints May 1" }] }]
        }
      ]
    }
  ]
}
```

---

## Workflow Patterns

### Morning Review
1. GET today's daily note
2. Render the documentState to human-readable text
3. Present a summary highlighting unchecked tasks and recent log entries

### Meeting Notes Capture
1. GET today's daily note to retrieve current documentState
2. Build a logCard with heading, paragraphs, and bullet points for the meeting notes
3. Tag with relevant tags (e.g., `["meeting", "team-name"]`)
4. Associate with relevant folio
5. Append to documentState and PATCH

### End-of-Day Summary
1. GET today's daily note
2. Parse all logCard entries
3. Summarize the day's activities, decisions, and outstanding items
4. Optionally create a memory via the knowledge skill for key decisions
5. Optionally commit a summary to the relevant folio

### Yesterday Review
1. Calculate yesterday's date in YYYY-MM-DD format
2. GET yesterday's daily note
3. Render and present — useful for standup prep
