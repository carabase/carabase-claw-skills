# Carabase REST API Reference

Base URL: `{CARABASE_HOST}/api/v1`

All requests require the header:
```
x-workspace-id: {CARABASE_WORKSPACE_ID}
```

All request/response bodies are `application/json`.

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

### List Tasks

```
GET /api/v1/tasks
```

**Response:**
```json
{
  "tasks": [
    {
      "id": "string",
      "text": "string",
      "checked": false,
      "date": "YYYY-MM-DD",
      "folios": ["string"],
      "tags": ["string"],
      "timestamp": "hh:mm AM/PM",
      "nodeIndex": 0
    }
  ]
}
```

| Field | Type | Description |
|---|---|---|
| `id` | string | Unique task identifier |
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
  "date": "YYYY-MM-DD",
  "nodeIndex": 0,
  "checked": true
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `date` | string | Yes | Date of the daily note containing the task |
| `nodeIndex` | number | Yes | Node index from the list tasks response |
| `checked` | boolean | Yes | New completion state |

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
      "name": "string",
      "about": "string",
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
  "name": "string",
  "about": "string"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | Yes | Folio display name |
| `about` | string | No | Description / about text |

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
    "name": "string",
    "about": "string",
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
  "name": "string",
  "about": "string"
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
      "name": "string",
      "type": "string",
      "metadata": {}
    }
  ]
}
```

| Field | Type | Description |
|---|---|---|
| `id` | string | Entity UUID |
| `name` | string | Entity display name |
| `type` | string | Entity type (e.g., "person", "project", "concept", "tool") |
| `metadata` | object | Additional entity metadata |

### Get Entity Detail

```
GET /api/v1/entities/:entityId
```

**Response:**
```json
{
  "entity": {
    "id": "uuid",
    "name": "string",
    "type": "string",
    "metadata": {},
    "edges": [
      {
        "id": "uuid",
        "sourceId": "uuid",
        "targetId": "uuid",
        "type": "string",
        "targetName": "string"
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
      "type": "string"
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
      "content": "string",
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
  "content": "string"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `content` | string | Yes | The memory text |

---

## Artifacts

### Get Artifact Metadata

```
GET /api/v1/artifacts/:id
```

**Response:**
```json
{
  "artifact": {
    "id": "uuid",
    "filename": "string",
    "mimeType": "string",
    "size": 0,
    "createdAt": "ISO-8601"
  }
}
```

### Get Artifact Content

```
GET /api/v1/artifacts/:id/content
```

Returns the extracted text content of the artifact as a string.

### Upload Artifact

```
POST /api/v1/artifacts/upload
Content-Type: multipart/form-data
```

Send the file as a multipart form upload.

---

## Block Format Reference

Daily note documents use TipTap/ProseMirror JSON format. Key node types:

### logCard
Top-level wrapper for timestamped entries.
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
Note: All `attrs` values are strings, including JSON arrays.

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
