---
name: carabase-tasks
description: Create, list, filter, and toggle tasks in Carabase. Tasks live inside daily note documents as taskItem blocks and are extracted at query time.
metadata:
  version: "1.0.0"
  requires_env:
    - CARABASE_HOST
    - CARABASE_WORKSPACE_ID
  depends_on:
    - carabase-core
---

# Carabase Tasks

Manage tasks in a Carabase workspace. Tasks in Carabase are not stored in a separate table — they are `taskItem` nodes inside `taskList` blocks within daily note documents. The API extracts them at query time.

## Connection

All requests require:
- Base URL: `{CARABASE_HOST}/api/v1`
- Header: `x-workspace-id: {CARABASE_WORKSPACE_ID}`

## List Tasks

Retrieve all tasks, optionally filtered.

```
GET {CARABASE_HOST}/api/v1/tasks
Headers:
  x-workspace-id: {CARABASE_WORKSPACE_ID}
```

**Response:**
```json
{
  "tasks": [
    {
      "id": "unique-task-id",
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

### Filtering Tasks

After fetching the full task list, filter client-side:

- **By date range**: Compare the `date` field (YYYY-MM-DD format)
- **By folio**: Check if the target folio name is in the `folios` array
- **By completion**: Filter on `checked` (true/false)
- **By tag**: Check if the target tag is in the `tags` array
- **By text**: Substring or regex match on `text`

**Example — unchecked tasks for a specific folio:**
```javascript
const allTasks = response.tasks;
const filtered = allTasks.filter(t =>
  !t.checked && t.folios.includes("Backend")
);
```

**Example — tasks from this week:**
```javascript
const weekAgo = new Date();
weekAgo.setDate(weekAgo.getDate() - 7);
const weekStr = weekAgo.toISOString().split('T')[0];
const thisWeek = allTasks.filter(t => t.date >= weekStr);
```

## Toggle Task Completion

Mark a task as checked or unchecked.

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

The `date` and `nodeIndex` fields uniquely identify a task within the daily note document tree. Both come from the list tasks response.

## Create a Task

Creating a task is a multi-step process because tasks live inside daily note documents:

### Step 1: Get Today's Daily Note

```
GET {CARABASE_HOST}/api/v1/daily-notes/{date}
Headers:
  x-workspace-id: {CARABASE_WORKSPACE_ID}
```

This returns the existing note or auto-creates one. The response includes:
```json
{
  "id": "note-uuid",
  "date": "2026-03-30",
  "documentState": [ ...blocks... ],
  "updatedAt": "2026-03-30T14:25:00Z"
}
```

### Step 2: Build the Task Block

Construct a `logCard` block containing a `taskList` with one or more `taskItem` nodes:

```json
{
  "type": "logCard",
  "attrs": {
    "timestamp": "{current_time_formatted}",
    "visibility": "PRIVATE",
    "tags": "{json_array_of_tags}",
    "folios": "{json_array_of_folio_names}",
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
                { "type": "text", "text": "The task description here" }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

**Important details:**
- `timestamp` — Format as `hh:mm AM/PM` (e.g., `02:15 PM`). Use the current time.
- `tags` — JSON-encoded string array: `"[\"todo\"]"`. Always include `"todo"` for tasks.
- `folios` — JSON-encoded string array: `"[\"ProjectName\"]"`. Use the folio name the task belongs to, or `"[]"` for unassociated tasks.
- `customers` — JSON-encoded string array, typically `"[]"`.
- `abandoned` — String `"false"`.

All `attrs` values are **strings**, including the JSON arrays.

### Step 3: Append to Document and Save

Take the existing `documentState` array, append the new logCard block, and PATCH the note:

```
PATCH {CARABASE_HOST}/api/v1/daily-notes/{date}
Headers:
  Content-Type: application/json
  x-workspace-id: {CARABASE_WORKSPACE_ID}
Body:
{
  "documentState": [ ...existing_blocks..., new_logCard_block ]
}
```

### Create Multiple Tasks at Once

To create multiple tasks in one operation, add multiple `taskItem` nodes inside a single `taskList`:

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

## MCP Alternative

If connected to the Carabase MCP server, you can create log entries with tasks using:

```
Tool: create_log_entry
Arguments:
  content: "- [ ] The task description"
  folio: "ProjectName"    (optional)
  tags: ["todo"]          (optional)
```

This is simpler than the REST approach but offers less control over block structure. Use REST when you need precise control over the document, MCP when you want convenience.

## Workflow Patterns

### Morning Task Review
1. List all tasks, filter to unchecked
2. Group by folio
3. Present to user with dates and context

### End-of-Day Cleanup
1. List tasks for today
2. Identify any completed but untoggled tasks
3. Toggle them as checked
4. Create carry-forward tasks for tomorrow if needed

### Project Task Audit
1. List all tasks filtered to a specific folio
2. Separate checked vs unchecked
3. Report completion rate and outstanding items
