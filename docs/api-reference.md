# Carabase REST API Reference

Base URL: `{CARABASE_HOST}/api/v1`

All requests require the header:
```
x-workspace-id: {CARABASE_WORKSPACE_ID}
```

All request/response bodies are `application/json` unless otherwise noted.

---

## Health

### Check Health

```
GET /api/v1/health
```

Returns HTTP 200 if the server is running and the workspace is valid.

---

## Tasks

Tasks are extracted from daily note document trees at query time. They are `taskItem` nodes within `taskList` blocks, typically inside `logCard` wrappers.

### Create Task

```
POST /api/v1/tasks
```

**Request Body:**
```json
{
  "text": "Review PR #42",
  "folio": "Backend",
  "tags": ["review"],
  "date": "2026-03-30"
}
```

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `text` | string | Yes | — | Task description |
| `folio` | string | No | — | Folio name to associate |
| `tags` | string[] | No | — | Tags for the task entry |
| `date` | string | No | today | Target date (YYYY-MM-DD) |

**Response:**
```json
{
  "success": true,
  "task": {
    "text": "Review PR #42",
    "date": "2026-03-30",
    "folio": "Backend",
    "tags": ["review"],
    "timestamp": "02:15 PM"
  }
}
```

The server constructs the proper TipTap block structure (`logCard` > `taskList` > `taskItem`) and injects it into the specified date's daily note.

### List Tasks

```
GET /api/v1/tasks
GET /api/v1/tasks?checked=false&folio=Backend&date_from=2026-03-24&date_to=2026-03-30&tag=review&limit=20
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|---|---|---|---|
| `checked` | boolean | — | Filter by completion status |
| `folio` | string | — | Filter by folio name |
| `tag` | string | — | Filter by tag |
| `date_from` | string | — | Start date (YYYY-MM-DD) |
| `date_to` | string | — | End date (YYYY-MM-DD) |
| `limit` | number | 50 | Maximum number of results |

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

| Field | Type | Description |
|---|---|---|
| `id` | string | Composite task identifier (`YYYY-MM-DD:nodeIndex`) |
| `text` | string | Task description text |
| `checked` | boolean | Whether the task is completed |
| `date` | string | Date of the daily note containing this task (YYYY-MM-DD) |
| `folios` | string[] | Folio names from the parent logCard |
| `tags` | string[] | Tags from the parent logCard |
| `timestamp` | string | Timestamp from the parent logCard |
| `nodeIndex` | number | Position index within the document tree (used for toggling) |

### Toggle Task

```
PATCH /api/v1/tasks
```

**Request Body:**
```json
{
  "date": "2026-03-30",
  "nodeIndex": 3,
  "checked": true
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `date` | string | Yes | Date of the daily note containing the task |
| `nodeIndex` | number | Yes | Node index from the list tasks response |
| `checked` | boolean | Yes | New completion state |

**Response:**
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

---

## Daily Notes

Daily notes are TipTap/ProseMirror block-structured documents keyed by date.

### Get Daily Note

```
GET /api/v1/daily-notes/:date
```

**Parameters:**
| Parameter | Location | Type | Description |
|---|---|---|---|
| `date` | path | string | Date in YYYY-MM-DD format |

Auto-creates the note if it doesn't exist.

**Response:**
```json
{
  "id": "uuid",
  "date": "YYYY-MM-DD",
  "documentState": [],
  "updatedAt": "ISO-8601"
}
```

| Field | Type | Description |
|---|---|---|
| `id` | string | Note UUID |
| `date` | string | Note date |
| `documentState` | array | Array of TipTap/ProseMirror block nodes |
| `updatedAt` | string | Last modification timestamp (ISO 8601) |

### Get Daily Note as Text

```
GET /api/v1/daily-notes/:date/text
```

**Parameters:**
| Parameter | Location | Type | Description |
|---|---|---|---|
| `date` | path | string | Date in YYYY-MM-DD format |

Returns the daily note rendered as human-readable text instead of raw TipTap JSON.

**Response:**
```json
{
  "date": "2026-03-30",
  "text": "## 09:15 AM [#standup] [Backend]\nDiscussed deploy timeline. Targeting Friday for v2.3.1 release.\n\n## 11:30 AM [#review] [Backend]\n- [ ] Review PR #42\n- [x] Update API docs"
}
```

| Field | Type | Description |
|---|---|---|
| `date` | string | Note date |
| `text` | string | Rendered markdown-style text of the daily note |

### Update Daily Note

```
PATCH /api/v1/daily-notes/:date
```

**Parameters:**
| Parameter | Location | Type | Description |
|---|---|---|---|
| `date` | path | string | Date in YYYY-MM-DD format |

**Request Body:**
```json
{
  "documentState": []
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `documentState` | array | Yes | Complete array of block nodes (replaces the entire document) |

**Warning**: This replaces the full document. Always GET the current state first, modify it, then PATCH back.

### Inject Block into Daily Note

```
POST /api/v1/daily-notes/inject
```

Append a block to today's daily note without needing to GET/modify/PATCH the full document.

**Request Body:**
```json
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

| Field | Type | Required | Description |
|---|---|---|---|
| `block` | object | Yes | A TipTap/ProseMirror block node to append |

**Response:**
```json
{
  "success": true,
  "date": "2026-03-30"
}
```

---

## Folios

Folios are named knowledge collections with About text, Timeline, and Commits.

### List Folios

```
GET /api/v1/folios
```

**Response:**
```json
{
  "folios": [
    {
      "id": "uuid",
      "name": "Backend",
      "about": "Backend services powering the core API.",
      "createdAt": "ISO-8601",
      "updatedAt": "ISO-8601"
    }
  ]
}
```

### Create Folio

```
POST /api/v1/folios
```

**Request Body:**
```json
{
  "name": "New Project",
  "about": "Description of the project"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | Yes | Folio display name |
| `about` | string | No | Description / about text |

**Response:**
```json
{
  "folio": {
    "id": "uuid",
    "name": "New Project",
    "about": "Description of the project",
    "createdAt": "ISO-8601",
    "updatedAt": "ISO-8601"
  }
}
```

### Get Folio Detail

```
GET /api/v1/folios/:folioId
```

**Parameters:**
| Parameter | Location | Type | Description |
|---|---|---|---|
| `folioId` | path | string | Folio UUID |

**Response:**
```json
{
  "folio": {
    "id": "uuid",
    "name": "Backend",
    "about": "Backend services powering the core API.",
    "timeline": [],
    "commits": [],
    "createdAt": "ISO-8601",
    "updatedAt": "ISO-8601"
  }
}
```

### Update Folio

```
PATCH /api/v1/folios/:folioId
```

**Request Body:**
```json
{
  "name": "Updated Name",
  "about": "Updated description"
}
```

All fields are optional — only provided fields are updated.

---

## Knowledge Graph

### List Entities

```
GET /api/v1/entities
```

**Response:**
```json
{
  "entities": [
    {
      "id": "uuid",
      "name": "Acme Project",
      "type": "project",
      "metadata": {}
    }
  ]
}
```

| Field | Type | Description |
|---|---|---|
| `id` | string | Entity UUID |
| `name` | string | Entity display name |
| `type` | string | Entity type (`person`, `project`, `concept`, `organization`, `tool`, `topic`) |
| `metadata` | object | Additional entity metadata |

### Get Entity Detail

```
GET /api/v1/entities/:entityId
```

**Parameters:**
| Parameter | Location | Type | Description |
|---|---|---|---|
| `entityId` | path | string | Entity UUID |

**Response:**
```json
{
  "entity": {
    "id": "uuid",
    "name": "Acme Project",
    "type": "project",
    "metadata": {},
    "edges": [
      {
        "id": "uuid",
        "sourceId": "uuid",
        "targetId": "uuid",
        "type": "involves",
        "targetName": "Alice Chen"
      }
    ]
  }
}
```

### List Edges

```
GET /api/v1/edges
```

**Response:**
```json
{
  "edges": [
    {
      "id": "uuid",
      "sourceId": "uuid",
      "targetId": "uuid",
      "type": "involves"
    }
  ]
}
```

---

## Memories

### List Memories

```
GET /api/v1/memories
```

**Response:**
```json
{
  "memories": [
    {
      "id": "uuid",
      "content": "The team decided to use PostgreSQL for the analytics pipeline.",
      "createdAt": "ISO-8601"
    }
  ]
}
```

### Create Memory

```
POST /api/v1/memories
```

**Request Body:**
```json
{
  "content": "The memory text here."
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `content` | string | Yes | The memory text |

**Response:**
```json
{
  "memory": {
    "id": "uuid",
    "content": "The memory text here.",
    "createdAt": "ISO-8601"
  }
}
```

---

## Artifacts

### Get Artifact Metadata

```
GET /api/v1/artifacts/:id
```

**Parameters:**
| Parameter | Location | Type | Description |
|---|---|---|---|
| `id` | path | string | Artifact UUID |

**Response:**
```json
{
  "artifact": {
    "id": "uuid",
    "filename": "report.pdf",
    "mimeType": "application/pdf",
    "size": 245000,
    "createdAt": "ISO-8601"
  }
}
```

### Get Artifact Content

```
GET /api/v1/artifacts/:id/content
```

Returns the extracted text content of the artifact as a string.

**Response:**
```json
{
  "content": "Extracted text content of the document..."
}
```

### Upload Artifact

```
POST /api/v1/artifacts/upload
Content-Type: multipart/form-data
```

Send the file as a multipart form upload.

**Response:**
```json
{
  "artifact": {
    "id": "uuid",
    "filename": "report.pdf",
    "mimeType": "application/pdf",
    "size": 245000,
    "createdAt": "ISO-8601"
  }
}
```

---

## Block Format Reference

Daily note documents use TipTap/ProseMirror JSON format. Key node types:

### logCard
Top-level wrapper for timestamped entries. All `attrs` values are **strings**, including JSON arrays.

```json
{
  "type": "logCard",
  "attrs": {
    "timestamp": "hh:mm AM/PM",
    "visibility": "PRIVATE|PUBLIC",
    "tags": "[\"tag1\"]",
    "folios": "[\"FolioName\"]",
    "customers": "[]",
    "abandoned": "false"
  },
  "content": [ ...child blocks... ]
}
```

| Attr | Format | Description |
|---|---|---|
| `timestamp` | `"hh:mm AM/PM"` | Entry time |
| `visibility` | `"PRIVATE"` or `"PUBLIC"` | Visibility scope |
| `tags` | JSON string array | Tags |
| `folios` | JSON string array | Associated folios |
| `customers` | JSON string array | Customer references |
| `abandoned` | `"true"` or `"false"` | Whether abandoned |

### paragraph
```json
{
  "type": "paragraph",
  "content": [{ "type": "text", "text": "Content here" }]
}
```

### taskList / taskItem
```json
{
  "type": "taskList",
  "content": [
    {
      "type": "taskItem",
      "attrs": { "checked": false },
      "content": [
        { "type": "paragraph", "content": [{ "type": "text", "text": "Task text" }] }
      ]
    }
  ]
}
```

### heading
```json
{
  "type": "heading",
  "attrs": { "level": 1 },
  "content": [{ "type": "text", "text": "Heading text" }]
}
```

### bulletList / orderedList
```json
{
  "type": "bulletList",
  "content": [
    {
      "type": "listItem",
      "content": [
        { "type": "paragraph", "content": [{ "type": "text", "text": "Item" }] }
      ]
    }
  ]
}
```

### codeBlock
```json
{
  "type": "codeBlock",
  "attrs": { "language": "javascript" },
  "content": [{ "type": "text", "text": "const x = 1;" }]
}
```

### blockquote
```json
{
  "type": "blockquote",
  "content": [
    { "type": "paragraph", "content": [{ "type": "text", "text": "Quoted text" }] }
  ]
}
```
