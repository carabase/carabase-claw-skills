---
name: carabase-tasks
description: Create, list, filter, and toggle tasks in Carabase using MCP tools and REST API. Tasks live inside daily note documents as taskItem blocks and are extracted at query time.
metadata:
  version: "2.0.0"
  requires_env:
    - CARABASE_HOST
    - CARABASE_WORKSPACE_ID
  depends_on:
    - carabase-core
---

# Carabase Tasks

Manage tasks in a Carabase workspace. Tasks in Carabase are not stored in a separate table — they are `taskItem` nodes inside `taskList` blocks within daily note `logCard` wrappers. The API extracts them at query time.

**Primary interface**: MCP tools (`create_task`, `list_tasks`, `toggle_task`)
**Fallback**: REST API at `{CARABASE_HOST}/api/v1/tasks`

---

## MCP Tools

### create_task

Create a task in the user's daily note. The server builds the correct TipTap block structure (logCard > taskList > taskItem) and injects it into the specified date's note.

```
Tool: create_task
Arguments:
  text: "Review PR #42"                    (required — task description)
  folio: "Backend"                         (optional — folio to associate)
  tags: ["review", "urgent"]               (optional — tags for the entry)
  date: "2026-03-30"                       (optional — YYYY-MM-DD, defaults to today)
```

**Returns**: Confirmation with task text, date, folio, and tags.

**Examples**:

Create a simple task:
```json
{
  "text": "Deploy hotfix to production"
}
```

Create a task associated with a folio and tagged:
```json
{
  "text": "Write integration tests for auth flow",
  "folio": "Backend",
  "tags": ["testing", "auth"]
}
```

Create a task for a future date:
```json
{
  "text": "Submit quarterly report",
  "date": "2026-04-01",
  "tags": ["admin"]
}
```

---

### list_tasks

Retrieve tasks across daily notes with optional server-side filters. Returns a formatted list sorted by unchecked first, then by date descending.

```
Tool: list_tasks
Arguments:
  checked: false                           (optional — filter by completion status)
  folio: "Backend"                         (optional — filter by folio name)
  tag: "urgent"                            (optional — filter by tag)
  date_from: "2026-03-24"                  (optional — start date, YYYY-MM-DD)
  date_to: "2026-03-30"                    (optional — end date, YYYY-MM-DD)
  limit: 20                                (optional — max results, default 20)
```

**Returns**: List of tasks, each with:
- `id` — Composite ID in format `YYYY-MM-DD:nodeIndex` (used for toggling)
- `text` — Task description
- `checked` — Completion status (true/false)
- `date` — Date of the containing daily note
- `folios` — Array of folio names from the parent logCard
- `tags` — Array of tags from the parent logCard
- `timestamp` — Time from the parent logCard (e.g., "02:15 PM")

**Examples**:

List all open tasks:
```json
{
  "checked": false
}
```

List open tasks for a specific project this week:
```json
{
  "checked": false,
  "folio": "Backend",
  "date_from": "2026-03-24",
  "date_to": "2026-03-30"
}
```

List all tasks tagged "urgent":
```json
{
  "tag": "urgent"
}
```

List completed tasks (limit 10):
```json
{
  "checked": true,
  "limit": 10
}
```

---

### toggle_task

Check or uncheck a task by its composite ID.

```
Tool: toggle_task
Arguments:
  task_id: "2026-03-30:3"                  (required — format "YYYY-MM-DD:nodeIndex")
  checked: true                            (required — new completion state)
```

**Returns**: Confirmation with task text and new state.

**Task ID format**: The `task_id` is composed of the daily note date and the node's position index in the document tree, separated by a colon: `YYYY-MM-DD:nodeIndex`. Both values come from the `list_tasks` response — the `date` field and `nodeIndex` field, or from the composite `id` field directly.

**Examples**:

Mark a task as done:
```json
{
  "task_id": "2026-03-30:3",
  "checked": true
}
```

Reopen a completed task:
```json
{
  "task_id": "2026-03-28:7",
  "checked": false
}
```

---

## REST API Fallback

Use these endpoints when MCP is not connected or when you need fine-grained control.

### POST /api/v1/tasks — Create a Task

```
POST {CARABASE_HOST}/api/v1/tasks
Headers:
  Content-Type: application/json
  x-workspace-id: {CARABASE_WORKSPACE_ID}
Body:
{
  "text": "Review PR #42",
  "folio": "Backend",
  "tags": ["review"],
  "date": "2026-03-30"
}
```

**Request Body:**
| Field | Type | Required | Description |
|---|---|---|---|
| `text` | string | Yes | Task description |
| `folio` | string | No | Folio name to associate |
| `tags` | string[] | No | Tags for the task entry |
| `date` | string | No | Target date (YYYY-MM-DD), defaults to today |

**Response:**
```json
{
  "success": true,
  "task": {
    "text": "Review PR #42",
    "date": "2026-03-30",
    "folio": "Backend",
    "tags": ["review"]
  }
}
```

### GET /api/v1/tasks — List Tasks

```
GET {CARABASE_HOST}/api/v1/tasks
GET {CARABASE_HOST}/api/v1/tasks?checked=false&folio=Backend&date_from=2026-03-24&date_to=2026-03-30
Headers:
  x-workspace-id: {CARABASE_WORKSPACE_ID}
```

**Query Parameters:**
| Parameter | Type | Description |
|---|---|---|
| `checked` | boolean | Filter by completion status |
| `folio` | string | Filter by folio name |
| `tag` | string | Filter by tag |
| `date_from` | string | Start date (YYYY-MM-DD) |
| `date_to` | string | End date (YYYY-MM-DD) |
| `limit` | number | Max results (default 50) |

**Response:**
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
    }
  ]
}
```

### PATCH /api/v1/tasks — Toggle Task

```
PATCH {CARABASE_HOST}/api/v1/tasks
Headers:
  Content-Type: application/json
  x-workspace-id: {CARABASE_WORKSPACE_ID}
Body:
{
  "date": "2026-03-30",
  "nodeIndex": 3,
  "checked": true
}
```

**Request Body:**
| Field | Type | Required | Description |
|---|---|---|---|
| `date` | string | Yes | Date of the daily note containing the task |
| `nodeIndex` | number | Yes | Node index from the list tasks response |
| `checked` | boolean | Yes | New completion state |

---

## Block Structure Reference

Tasks are embedded in the TipTap/ProseMirror document tree of daily notes:

```
dailyNote.documentState[]
  └── logCard (with timestamp, visibility, tags, folios attrs)
        └── taskList
              └── taskItem (with checked attr)
                    └── paragraph
                          └── text ("The task description")
```

All `logCard` attrs values are **strings**, including JSON arrays:
- `timestamp`: `"02:15 PM"`
- `visibility`: `"PRIVATE"`
- `tags`: `"[\"review\",\"urgent\"]"`
- `folios`: `"[\"Backend\"]"`
- `customers`: `"[]"`
- `abandoned`: `"false"`

---

## Manual Block Construction (Advanced)

When you need to build task blocks manually (e.g., for REST PATCH operations on the document tree), construct the block like this:

```json
{
  "type": "logCard",
  "attrs": {
    "timestamp": "02:15 PM",
    "visibility": "PRIVATE",
    "tags": "[\"todo\"]",
    "folios": "[\"Backend\"]",
    "customers": "[]",
    "abandoned": "false"
  },
  "content": [
    {
      "type": "taskList",
      "content": [
        {
          "type": "taskItem",
          "attrs": { "checked": false },
          "content": [
            {
              "type": "paragraph",
              "content": [
                { "type": "text", "text": "Review PR #42" }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

For multiple tasks in one logCard, add multiple `taskItem` nodes inside the `taskList`:

```json
{
  "type": "taskList",
  "content": [
    {
      "type": "taskItem",
      "attrs": { "checked": false },
      "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "First task" }] }]
    },
    {
      "type": "taskItem",
      "attrs": { "checked": false },
      "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Second task" }] }]
    }
  ]
}
```

---

## Common Workflows

### "Create a todo list"

1. Parse the user's request for task descriptions, folio, and tags.
2. Call `create_task` for each task item.
3. Confirm the tasks were created with their dates and folios.

Example flow:
```
User: "Add these tasks to the Backend folio: write unit tests, update API docs, deploy to staging"

Agent:
  → create_task(text: "Write unit tests", folio: "Backend", tags: ["todo"])
  → create_task(text: "Update API docs", folio: "Backend", tags: ["todo"])
  → create_task(text: "Deploy to staging", folio: "Backend", tags: ["todo"])
  → "Created 3 tasks in the Backend folio for today."
```

### "Show me open tasks for folio X"

1. Call `list_tasks` with `checked: false` and `folio: "X"`.
2. Format and present the results grouped by date.

Example flow:
```
User: "What's open on the Backend project?"

Agent:
  → list_tasks(checked: false, folio: "Backend")
  → Present tasks grouped by date:
    "You have 5 open Backend tasks:
     Mar 30: Review PR #42, Deploy to staging
     Mar 28: Fix rate limiter bug
     Mar 27: Write integration tests, Update API docs"
```

### "Mark task done"

1. If the user identifies the task by description, call `list_tasks` first to find the matching task and its ID.
2. Call `toggle_task` with the task's composite ID and `checked: true`.

Example flow:
```
User: "Mark the deploy task as done"

Agent:
  → list_tasks(checked: false)  // find the task
  → Found: id "2026-03-30:5", text "Deploy to staging"
  → toggle_task(task_id: "2026-03-30:5", checked: true)
  → "Marked 'Deploy to staging' as complete."
```

### Morning Task Review

1. Call `list_tasks` with `checked: false`.
2. Group tasks by folio.
3. Present a prioritized summary, highlighting any tagged "urgent".

### End-of-Day Cleanup

1. Call `list_tasks` with `date_from` and `date_to` set to today.
2. Review unchecked tasks — ask user which are done.
3. Toggle completed tasks.
4. For unfinished tasks, optionally create carry-forward tasks for tomorrow.

### Weekly Task Report

1. Call `list_tasks` with `date_from` set to 7 days ago.
2. Separate checked vs unchecked.
3. Report completion rate, outstanding items, and per-folio breakdown.
