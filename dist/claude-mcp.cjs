#!/usr/bin/env node
"use strict";

// src/claude-mcp.ts
var import_mcp = require("@modelcontextprotocol/sdk/server/mcp.js");
var import_stdio = require("@modelcontextprotocol/sdk/server/stdio.js");
var import_zod = require("zod");
var BASE_URL = process.env.CARABASE_HOST || "http://localhost:3000";
var WORKSPACE_ID = process.env.CARABASE_WORKSPACE_ID;
var API_KEY = process.env.CARABASE_API_KEY;
if (!WORKSPACE_ID) {
  console.error(
    "CARABASE_WORKSPACE_ID is required. Set it in your Claude Desktop config."
  );
  process.exit(1);
}
function headers() {
  const h = {
    "Content-Type": "application/json",
    "x-workspace-id": WORKSPACE_ID
  };
  if (API_KEY) {
    h["Authorization"] = `Bearer ${API_KEY}`;
  }
  return h;
}
async function apiGet(path) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GET ${path} failed (${res.status}): ${body}`);
  }
  return res.json();
}
async function apiPost(path, body) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`POST ${path} failed (${res.status}): ${text}`);
  }
  return res.json();
}
async function apiPatch(path, body) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PATCH ${path} failed (${res.status}): ${text}`);
  }
  return res.json();
}
function textResult(data) {
  return {
    content: [
      {
        type: "text",
        text: typeof data === "string" ? data : JSON.stringify(data, null, 2)
      }
    ]
  };
}
function errorResult(msg) {
  return {
    content: [{ type: "text", text: msg }],
    isError: true
  };
}
var server = new import_mcp.McpServer(
  {
    name: "carabase",
    version: "0.1.0"
  },
  {
    capabilities: { tools: {} },
    instructions: "Carabase personal knowledge assistant \u2014 manages daily notes, tasks, project folios, knowledge graph, semantic search, and memories. All data stays on the user's self-hosted infrastructure."
  }
);
server.tool(
  "search_semantic",
  "Semantic vector search across all Carabase content \u2014 daily notes, folio commits, and uploaded artifacts. Returns the most relevant chunks ranked by similarity.",
  {
    query: import_zod.z.string().describe("Natural language search query"),
    limit: import_zod.z.number().optional().default(5).describe("Max results to return (default 5, max 20)")
  },
  async ({ query, limit }) => {
    try {
      const data = await apiPost("/api/v1/harvest/search", { query, limit });
      return textResult(data);
    } catch (e) {
      return errorResult(`search_semantic failed: ${e.message}`);
    }
  }
);
server.tool(
  "query_graph",
  "Look up an entity in the knowledge graph and return its relationships. Understands people, projects, concepts, organizations, tools, and topics.",
  {
    entity: import_zod.z.string().describe("Entity name to search for (e.g. 'Sarah Chen', 'Project Atlas')")
  },
  async ({ entity }) => {
    try {
      const entities = await apiGet(
        `/api/v1/entities?search=${encodeURIComponent(entity)}&limit=5`
      );
      const list = Array.isArray(entities) ? entities : entities.entities ?? [];
      if (list.length === 0) {
        return textResult(`No entity found matching "${entity}". Try broader search terms.`);
      }
      const target = list[0];
      const detail = await apiGet(`/api/v1/entities/${target.id}`);
      return textResult(detail);
    } catch (e) {
      return errorResult(`query_graph failed: ${e.message}`);
    }
  }
);
server.tool(
  "commit_to_folio",
  "Append a commit entry to a folio's timeline. Creates the folio if it does not exist. Use to save notes, meeting minutes, or project updates.",
  {
    folio_name: import_zod.z.string().describe("Name of the folio (e.g. 'Backend', 'Q3 Roadmap')"),
    content: import_zod.z.string().describe("The content to commit \u2014 a note, summary, or update")
  },
  async ({ folio_name, content }) => {
    try {
      const foliosData = await apiGet(
        `/api/v1/folios?search=${encodeURIComponent(folio_name)}`
      );
      const folioList = Array.isArray(foliosData) ? foliosData : foliosData.folios ?? [];
      let folioId;
      if (folioList.length > 0) {
        folioId = folioList[0].id;
      } else {
        const created = await apiPost("/api/v1/folios", {
          name: folio_name
        });
        folioId = created.id;
      }
      const result = await apiPost(`/api/v1/folios/${folioId}/commits`, {
        message: content
      });
      return textResult(result);
    } catch (e) {
      return errorResult(`commit_to_folio failed: ${e.message}`);
    }
  }
);
server.tool(
  "read_artifact",
  "Read the extracted text content of an uploaded file artifact (PDF, CSV, DOCX, etc.). Content is truncated to protect context window size.",
  {
    artifact_id: import_zod.z.string().describe("UUID of the file artifact"),
    max_tokens: import_zod.z.number().optional().default(8e3).describe("Max tokens to return (default 8000)")
  },
  async ({ artifact_id, max_tokens }) => {
    try {
      const data = await apiGet(
        `/api/v1/artifacts/${artifact_id}/content?max_tokens=${max_tokens}`
      );
      return textResult(data);
    } catch (e) {
      return errorResult(`read_artifact failed: ${e.message}`);
    }
  }
);
server.tool(
  "read_folio_map",
  "Get a folio's About section and Timeline overview. Use to understand project context before committing content.",
  {
    folio_name: import_zod.z.string().describe("Name of the folio to read")
  },
  async ({ folio_name }) => {
    try {
      const foliosData = await apiGet(
        `/api/v1/folios?search=${encodeURIComponent(folio_name)}`
      );
      const list = Array.isArray(foliosData) ? foliosData : foliosData.folios ?? [];
      if (list.length === 0) {
        return textResult(`No folio found matching "${folio_name}".`);
      }
      const detail = await apiGet(`/api/v1/folios/${list[0].id}`);
      return textResult(detail);
    } catch (e) {
      return errorResult(`read_folio_map failed: ${e.message}`);
    }
  }
);
server.tool(
  "read_daily_note",
  "Read a daily note as human-readable markdown. Returns the full day's timeline with timestamp headers, task checkboxes, and folio/tag annotations.",
  {
    date: import_zod.z.string().optional().describe("Date in YYYY-MM-DD format (defaults to today)")
  },
  async ({ date }) => {
    try {
      const d = date || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
      const data = await apiGet(`/api/v1/daily-notes/${d}/text`);
      return textResult(data);
    } catch (e) {
      return errorResult(`read_daily_note failed: ${e.message}`);
    }
  }
);
server.tool(
  "create_log_entry",
  "Write a timestamped entry to today's daily note timeline. Supports markdown; use '- [ ]' syntax to create tasks inline.",
  {
    content: import_zod.z.string().describe("Entry text (supports markdown)"),
    folio: import_zod.z.string().optional().describe("Folio name to associate"),
    tags: import_zod.z.array(import_zod.z.string()).optional().describe("Tags for the entry (e.g. ['deploy', 'production'])")
  },
  async ({ content, folio, tags }) => {
    try {
      const data = await apiPost("/api/v1/daily-notes/inject", {
        type: "logCard",
        content,
        folio,
        tags
      });
      return textResult(data);
    } catch (e) {
      return errorResult(`create_log_entry failed: ${e.message}`);
    }
  }
);
server.tool(
  "create_task",
  "Create a task in the user's daily note. Builds a properly formatted task block and injects it into the specified date's note.",
  {
    text: import_zod.z.string().describe("Task description"),
    folio: import_zod.z.string().optional().describe("Folio name to associate"),
    tags: import_zod.z.array(import_zod.z.string()).optional().describe("Tags for the task (e.g. ['urgent', 'review'])"),
    date: import_zod.z.string().optional().describe("Target date YYYY-MM-DD (defaults to today)")
  },
  async ({ text, folio, tags, date }) => {
    try {
      const data = await apiPost("/api/v1/tasks", {
        text,
        folio,
        tags,
        date
      });
      return textResult(data);
    } catch (e) {
      return errorResult(`create_task failed: ${e.message}`);
    }
  }
);
server.tool(
  "list_tasks",
  "Retrieve tasks across daily notes with filtering. Returns tasks sorted by unchecked first, then by date descending.",
  {
    checked: import_zod.z.boolean().optional().describe("Filter by completion status"),
    folio: import_zod.z.string().optional().describe("Filter by folio name"),
    tag: import_zod.z.string().optional().describe("Filter by tag"),
    date_from: import_zod.z.string().optional().describe("Start date YYYY-MM-DD"),
    date_to: import_zod.z.string().optional().describe("End date YYYY-MM-DD"),
    limit: import_zod.z.number().optional().default(20).describe("Max results (default 20)")
  },
  async ({ checked, folio, tag, date_from, date_to, limit }) => {
    try {
      const params = new URLSearchParams();
      if (checked !== void 0) params.set("checked", String(checked));
      if (folio) params.set("folio", folio);
      if (tag) params.set("tag", tag);
      if (date_from) params.set("date_from", date_from);
      if (date_to) params.set("date_to", date_to);
      if (limit) params.set("limit", String(limit));
      const data = await apiGet(`/api/v1/tasks?${params.toString()}`);
      return textResult(data);
    } catch (e) {
      return errorResult(`list_tasks failed: ${e.message}`);
    }
  }
);
server.tool(
  "toggle_task",
  "Check or uncheck a task by its composite ID (format: YYYY-MM-DD:nodeIndex).",
  {
    task_id: import_zod.z.string().describe("Task ID in format YYYY-MM-DD:nodeIndex"),
    checked: import_zod.z.boolean().describe("New completion state")
  },
  async ({ task_id, checked }) => {
    try {
      const data = await apiPatch("/api/v1/tasks", { task_id, checked });
      return textResult(data);
    } catch (e) {
      return errorResult(`toggle_task failed: ${e.message}`);
    }
  }
);
server.tool(
  "list_folios",
  "Browse all available folios (knowledge collections) in the workspace.",
  {
    query: import_zod.z.string().optional().describe("Optional search filter on folio name")
  },
  async ({ query }) => {
    try {
      const path = query ? `/api/v1/folios?search=${encodeURIComponent(query)}` : "/api/v1/folios";
      const data = await apiGet(path);
      return textResult(data);
    } catch (e) {
      return errorResult(`list_folios failed: ${e.message}`);
    }
  }
);
server.tool(
  "list_entities",
  "Browse knowledge graph entities with optional type and search filters.",
  {
    type: import_zod.z.string().optional().describe(
      "Filter by type: person, project, concept, organization, tool, topic"
    ),
    query: import_zod.z.string().optional().describe("Search filter on entity name"),
    limit: import_zod.z.number().optional().default(20).describe("Max results (default 20)")
  },
  async ({ type, query, limit }) => {
    try {
      const params = new URLSearchParams();
      if (type) params.set("type", type);
      if (query) params.set("search", query);
      if (limit) params.set("limit", String(limit));
      const data = await apiGet(`/api/v1/entities?${params.toString()}`);
      return textResult(data);
    } catch (e) {
      return errorResult(`list_entities failed: ${e.message}`);
    }
  }
);
server.tool(
  "search_memories",
  "Search distilled memories (past decisions, insights, patterns) via vector similarity.",
  {
    query: import_zod.z.string().describe("Search query"),
    limit: import_zod.z.number().optional().default(5).describe("Max results (default 5)")
  },
  async ({ query, limit }) => {
    try {
      const params = new URLSearchParams({
        search: query,
        limit: String(limit ?? 5)
      });
      const data = await apiGet(`/api/v1/memories?${params.toString()}`);
      return textResult(data);
    } catch (e) {
      return errorResult(`search_memories failed: ${e.message}`);
    }
  }
);
server.tool(
  "create_memory",
  "Store a distilled insight or decision as a persistent memory. Use when a significant decision, pattern, or insight emerges that should persist beyond its original context.",
  {
    content: import_zod.z.string().describe("The memory/insight text"),
    source: import_zod.z.string().optional().describe("Provenance reference (e.g. 'daily-note:2026-03-30')")
  },
  async ({ content, source }) => {
    try {
      const data = await apiPost("/api/v1/memories", { content, source });
      return textResult(data);
    } catch (e) {
      return errorResult(`create_memory failed: ${e.message}`);
    }
  }
);
server.tool(
  "update_folio_section",
  "Modify a specific section of a folio, such as its About text.",
  {
    folio_name: import_zod.z.string().describe("Name of the folio to update"),
    action: import_zod.z.string().describe("The update action (e.g. 'update_about')"),
    content: import_zod.z.string().describe("The new content for the section")
  },
  async ({ folio_name, action, content }) => {
    try {
      const foliosData = await apiGet(
        `/api/v1/folios?search=${encodeURIComponent(folio_name)}`
      );
      const list = Array.isArray(foliosData) ? foliosData : foliosData.folios ?? [];
      if (list.length === 0) {
        return textResult(`No folio found matching "${folio_name}".`);
      }
      const data = await apiPatch(`/api/v1/folios/${list[0].id}`, {
        action,
        content
      });
      return textResult(data);
    } catch (e) {
      return errorResult(`update_folio_section failed: ${e.message}`);
    }
  }
);
async function main() {
  const transport = new import_stdio.StdioServerTransport();
  await server.connect(transport);
}
main().catch((err) => {
  console.error("Carabase MCP server failed to start:", err);
  process.exit(1);
});
