#!/usr/bin/env node

/**
 * Carabase MCP Server for Claude Desktop
 *
 * A stdio-based MCP server that translates Claude's tool calls into
 * HTTP requests to the Carabase Host API. Claude Desktop spawns this
 * as a subprocess and communicates over stdin/stdout.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// ── Configuration ──────────────────────────────────────────────────────

const BASE_URL = process.env.CARABASE_HOST || "http://localhost:3000";
const WORKSPACE_ID = process.env.CARABASE_WORKSPACE_ID;
const API_KEY = process.env.CARABASE_API_KEY;

if (!WORKSPACE_ID) {
  console.error(
    "CARABASE_WORKSPACE_ID is required. Set it in your Claude Desktop config.",
  );
  process.exit(1);
}

// ── HTTP helpers ───────────────────────────────────────────────────────

function headers(): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    "x-workspace-id": WORKSPACE_ID!,
  };
  if (API_KEY) {
    h["Authorization"] = `Bearer ${API_KEY}`;
  }
  return h;
}

async function apiGet(path: string): Promise<unknown> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GET ${path} failed (${res.status}): ${body}`);
  }
  return res.json();
}

async function apiPost(path: string, body: unknown): Promise<unknown> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`POST ${path} failed (${res.status}): ${text}`);
  }
  return res.json();
}

async function apiPatch(path: string, body: unknown): Promise<unknown> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PATCH ${path} failed (${res.status}): ${text}`);
  }
  return res.json();
}

function textResult(data: unknown): { content: Array<{ type: "text"; text: string }> } {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof data === "string" ? data : JSON.stringify(data, null, 2),
      },
    ],
  };
}

function errorResult(msg: string): { content: Array<{ type: "text"; text: string }>; isError: true } {
  return {
    content: [{ type: "text" as const, text: msg }],
    isError: true,
  };
}

// ── MCP Server ─────────────────────────────────────────────────────────

const server = new McpServer(
  {
    name: "carabase",
    version: "0.1.0",
  },
  {
    capabilities: { tools: {} },
    instructions:
      "Carabase personal knowledge assistant — manages daily notes, tasks, " +
      "project folios, knowledge graph, semantic search, and memories. " +
      "All data stays on the user's self-hosted infrastructure.",
  },
);

// ── Tool: search_semantic ──────────────────────────────────────────────

server.tool(
  "search_semantic",
  "Semantic vector search across all Carabase content — daily notes, folio " +
    "commits, and uploaded artifacts. Returns the most relevant chunks ranked " +
    "by similarity.",
  {
    query: z.string().describe("Natural language search query"),
    limit: z
      .number()
      .optional()
      .default(5)
      .describe("Max results to return (default 5, max 20)"),
  },
  async ({ query, limit }) => {
    try {
      const data = await apiPost("/api/v1/harvest/search", { query, limit });
      return textResult(data);
    } catch (e) {
      return errorResult(`search_semantic failed: ${(e as Error).message}`);
    }
  },
);

// ── Tool: query_graph ──────────────────────────────────────────────────

server.tool(
  "query_graph",
  "Look up an entity in the knowledge graph and return its relationships. " +
    "Understands people, projects, concepts, organizations, tools, and topics.",
  {
    entity: z
      .string()
      .describe("Entity name to search for (e.g. 'Sarah Chen', 'Project Atlas')"),
  },
  async ({ entity }) => {
    try {
      // Search for matching entities
      const entities = (await apiGet(
        `/api/v1/entities?search=${encodeURIComponent(entity)}&limit=5`,
      )) as { entities?: Array<{ id: string; name: string; type: string }> } | Array<{ id: string; name: string; type: string }>;

      const list = Array.isArray(entities) ? entities : entities.entities ?? [];
      if (list.length === 0) {
        return textResult(`No entity found matching "${entity}". Try broader search terms.`);
      }

      // Get the best match and its connections
      const target = list[0];
      const detail = await apiGet(`/api/v1/entities/${target.id}`);
      return textResult(detail);
    } catch (e) {
      return errorResult(`query_graph failed: ${(e as Error).message}`);
    }
  },
);

// ── Tool: commit_to_folio ──────────────────────────────────────────────

server.tool(
  "commit_to_folio",
  "Append a commit entry to a folio's timeline. Creates the folio if it " +
    "does not exist. Use to save notes, meeting minutes, or project updates.",
  {
    folio_name: z
      .string()
      .describe("Name of the folio (e.g. 'Backend', 'Q3 Roadmap')"),
    content: z
      .string()
      .describe("The content to commit — a note, summary, or update"),
  },
  async ({ folio_name, content }) => {
    try {
      // Find folio by name
      const foliosData = (await apiGet(
        `/api/v1/folios?search=${encodeURIComponent(folio_name)}`,
      )) as { folios?: Array<{ id: string; name: string }> } | Array<{ id: string; name: string }>;

      const folioList = Array.isArray(foliosData) ? foliosData : foliosData.folios ?? [];
      let folioId: string;

      if (folioList.length > 0) {
        folioId = folioList[0].id;
      } else {
        // Create the folio
        const created = (await apiPost("/api/v1/folios", {
          name: folio_name,
        })) as { id: string };
        folioId = created.id;
      }

      const result = await apiPost(`/api/v1/folios/${folioId}/commits`, {
        message: content,
      });
      return textResult(result);
    } catch (e) {
      return errorResult(`commit_to_folio failed: ${(e as Error).message}`);
    }
  },
);

// ── Tool: read_artifact ────────────────────────────────────────────────

server.tool(
  "read_artifact",
  "Read the extracted text content of an uploaded file artifact (PDF, CSV, " +
    "DOCX, etc.). Content is truncated to protect context window size.",
  {
    artifact_id: z.string().describe("UUID of the file artifact"),
    max_tokens: z
      .number()
      .optional()
      .default(8000)
      .describe("Max tokens to return (default 8000)"),
  },
  async ({ artifact_id, max_tokens }) => {
    try {
      const data = await apiGet(
        `/api/v1/artifacts/${artifact_id}/content?max_tokens=${max_tokens}`,
      );
      return textResult(data);
    } catch (e) {
      return errorResult(`read_artifact failed: ${(e as Error).message}`);
    }
  },
);

// ── Tool: read_folio_map ───────────────────────────────────────────────

server.tool(
  "read_folio_map",
  "Get a folio's About section and Timeline overview. Use to understand " +
    "project context before committing content.",
  {
    folio_name: z.string().describe("Name of the folio to read"),
  },
  async ({ folio_name }) => {
    try {
      const foliosData = (await apiGet(
        `/api/v1/folios?search=${encodeURIComponent(folio_name)}`,
      )) as { folios?: Array<{ id: string; name: string }> } | Array<{ id: string; name: string }>;

      const list = Array.isArray(foliosData) ? foliosData : foliosData.folios ?? [];
      if (list.length === 0) {
        return textResult(`No folio found matching "${folio_name}".`);
      }

      const detail = await apiGet(`/api/v1/folios/${list[0].id}`);
      return textResult(detail);
    } catch (e) {
      return errorResult(`read_folio_map failed: ${(e as Error).message}`);
    }
  },
);

// ── Tool: read_daily_note ──────────────────────────────────────────────

server.tool(
  "read_daily_note",
  "Read a daily note as human-readable markdown. Returns the full day's " +
    "timeline with timestamp headers, task checkboxes, and folio/tag annotations.",
  {
    date: z
      .string()
      .optional()
      .describe("Date in YYYY-MM-DD format (defaults to today)"),
  },
  async ({ date }) => {
    try {
      const d = date || new Date().toISOString().slice(0, 10);
      const data = await apiGet(`/api/v1/daily-notes/${d}/text`);
      return textResult(data);
    } catch (e) {
      return errorResult(`read_daily_note failed: ${(e as Error).message}`);
    }
  },
);

// ── Tool: create_log_entry ─────────────────────────────────────────────

server.tool(
  "create_log_entry",
  "Write a timestamped entry to today's daily note timeline. Supports " +
    "markdown; use '- [ ]' syntax to create tasks inline.",
  {
    content: z.string().describe("Entry text (supports markdown)"),
    folio: z.string().optional().describe("Folio name to associate"),
    tags: z
      .array(z.string())
      .optional()
      .describe("Tags for the entry (e.g. ['deploy', 'production'])"),
  },
  async ({ content, folio, tags }) => {
    try {
      const data = await apiPost("/api/v1/daily-notes/inject", {
        type: "logCard",
        content,
        folio,
        tags,
      });
      return textResult(data);
    } catch (e) {
      return errorResult(`create_log_entry failed: ${(e as Error).message}`);
    }
  },
);

// ── Tool: create_task ──────────────────────────────────────────────────

server.tool(
  "create_task",
  "Create a task in the user's daily note. Builds a properly formatted " +
    "task block and injects it into the specified date's note.",
  {
    text: z.string().describe("Task description"),
    folio: z.string().optional().describe("Folio name to associate"),
    tags: z
      .array(z.string())
      .optional()
      .describe("Tags for the task (e.g. ['urgent', 'review'])"),
    date: z
      .string()
      .optional()
      .describe("Target date YYYY-MM-DD (defaults to today)"),
  },
  async ({ text, folio, tags, date }) => {
    try {
      const data = await apiPost("/api/v1/tasks", {
        text,
        folio,
        tags,
        date,
      });
      return textResult(data);
    } catch (e) {
      return errorResult(`create_task failed: ${(e as Error).message}`);
    }
  },
);

// ── Tool: list_tasks ───────────────────────────────────────────────────

server.tool(
  "list_tasks",
  "Retrieve tasks across daily notes with filtering. Returns tasks sorted " +
    "by unchecked first, then by date descending.",
  {
    checked: z.boolean().optional().describe("Filter by completion status"),
    folio: z.string().optional().describe("Filter by folio name"),
    tag: z.string().optional().describe("Filter by tag"),
    date_from: z.string().optional().describe("Start date YYYY-MM-DD"),
    date_to: z.string().optional().describe("End date YYYY-MM-DD"),
    limit: z
      .number()
      .optional()
      .default(20)
      .describe("Max results (default 20)"),
  },
  async ({ checked, folio, tag, date_from, date_to, limit }) => {
    try {
      const params = new URLSearchParams();
      if (checked !== undefined) params.set("checked", String(checked));
      if (folio) params.set("folio", folio);
      if (tag) params.set("tag", tag);
      if (date_from) params.set("date_from", date_from);
      if (date_to) params.set("date_to", date_to);
      if (limit) params.set("limit", String(limit));

      const data = await apiGet(`/api/v1/tasks?${params.toString()}`);
      return textResult(data);
    } catch (e) {
      return errorResult(`list_tasks failed: ${(e as Error).message}`);
    }
  },
);

// ── Tool: toggle_task ──────────────────────────────────────────────────

server.tool(
  "toggle_task",
  "Check or uncheck a task by its composite ID (format: YYYY-MM-DD:nodeIndex).",
  {
    task_id: z
      .string()
      .describe("Task ID in format YYYY-MM-DD:nodeIndex"),
    checked: z.boolean().describe("New completion state"),
  },
  async ({ task_id, checked }) => {
    try {
      const data = await apiPatch("/api/v1/tasks", { task_id, checked });
      return textResult(data);
    } catch (e) {
      return errorResult(`toggle_task failed: ${(e as Error).message}`);
    }
  },
);

// ── Tool: list_folios ──────────────────────────────────────────────────

server.tool(
  "list_folios",
  "Browse all available folios (knowledge collections) in the workspace.",
  {
    query: z
      .string()
      .optional()
      .describe("Optional search filter on folio name"),
  },
  async ({ query }) => {
    try {
      const path = query
        ? `/api/v1/folios?search=${encodeURIComponent(query)}`
        : "/api/v1/folios";
      const data = await apiGet(path);
      return textResult(data);
    } catch (e) {
      return errorResult(`list_folios failed: ${(e as Error).message}`);
    }
  },
);

// ── Tool: list_entities ────────────────────────────────────────────────

server.tool(
  "list_entities",
  "Browse knowledge graph entities with optional type and search filters.",
  {
    type: z
      .string()
      .optional()
      .describe(
        "Filter by type: person, project, concept, organization, tool, topic",
      ),
    query: z.string().optional().describe("Search filter on entity name"),
    limit: z
      .number()
      .optional()
      .default(20)
      .describe("Max results (default 20)"),
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
      return errorResult(`list_entities failed: ${(e as Error).message}`);
    }
  },
);

// ── Tool: search_memories ──────────────────────────────────────────────

server.tool(
  "search_memories",
  "Search distilled memories (past decisions, insights, patterns) via " +
    "vector similarity.",
  {
    query: z.string().describe("Search query"),
    limit: z
      .number()
      .optional()
      .default(5)
      .describe("Max results (default 5)"),
  },
  async ({ query, limit }) => {
    try {
      const params = new URLSearchParams({
        search: query,
        limit: String(limit ?? 5),
      });
      const data = await apiGet(`/api/v1/memories?${params.toString()}`);
      return textResult(data);
    } catch (e) {
      return errorResult(`search_memories failed: ${(e as Error).message}`);
    }
  },
);

// ── Tool: create_memory ────────────────────────────────────────────────

server.tool(
  "create_memory",
  "Store a distilled insight or decision as a persistent memory. Use when " +
    "a significant decision, pattern, or insight emerges that should persist " +
    "beyond its original context.",
  {
    content: z.string().describe("The memory/insight text"),
    source: z
      .string()
      .optional()
      .describe("Provenance reference (e.g. 'daily-note:2026-03-30')"),
  },
  async ({ content, source }) => {
    try {
      const data = await apiPost("/api/v1/memories", { content, source });
      return textResult(data);
    } catch (e) {
      return errorResult(`create_memory failed: ${(e as Error).message}`);
    }
  },
);

// ── Tool: update_folio_section ─────────────────────────────────────────

server.tool(
  "update_folio_section",
  "Modify a specific section of a folio, such as its About text.",
  {
    folio_name: z.string().describe("Name of the folio to update"),
    action: z
      .string()
      .describe("The update action (e.g. 'update_about')"),
    content: z.string().describe("The new content for the section"),
  },
  async ({ folio_name, action, content }) => {
    try {
      // Find folio by name
      const foliosData = (await apiGet(
        `/api/v1/folios?search=${encodeURIComponent(folio_name)}`,
      )) as { folios?: Array<{ id: string; name: string }> } | Array<{ id: string; name: string }>;

      const list = Array.isArray(foliosData) ? foliosData : foliosData.folios ?? [];
      if (list.length === 0) {
        return textResult(`No folio found matching "${folio_name}".`);
      }

      const data = await apiPatch(`/api/v1/folios/${list[0].id}`, {
        action,
        content,
      });
      return textResult(data);
    } catch (e) {
      return errorResult(`update_folio_section failed: ${(e as Error).message}`);
    }
  },
);

// ── Start the server ───────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Server is now running — Claude Desktop communicates over stdin/stdout
}

main().catch((err) => {
  console.error("Carabase MCP server failed to start:", err);
  process.exit(1);
});
