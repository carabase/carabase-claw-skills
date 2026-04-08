# carabase-claw-skills

OpenClaw AgentSkill templates for interacting with a [Carabase](https://github.com/carabase/carabase-host) instance. These skills let any OpenClaw-compatible agent manage tasks, search knowledge, write daily logs, and more against a running Carabase workspace.

> **Looking for Claude Desktop integration?** See [carabase-claude-skills](https://github.com/carabase/carabase-claude-skills) instead.

## Skills

| Skill | Description |
|---|---|
| **carabase-core** | Connection setup, health check, MCP config |
| **carabase-tasks** | Create, list, filter, and toggle tasks |
| **carabase-knowledge** | 6 canonical retrieval tools (semantic, graph, metadata, entity-resolution, router, hypothesis verification) + Doctor-RAG hint repair + lazy artifact resources + folio/artifact/memory management |
| **carabase-daily** | Read and write daily notes, create log entries |

## Installation

Copy the skill directories into your OpenClaw workspace skills folder:

```bash
git clone https://github.com/carabase/carabase-claw-skills.git

# Copy all skills at once
cp -r carabase-claw-skills/carabase-* ~/.openclaw/workspace/skills/
```

Or copy individual skills:

```bash
cp -r carabase-claw-skills/carabase-core ~/.openclaw/workspace/skills/
cp -r carabase-claw-skills/carabase-tasks ~/.openclaw/workspace/skills/
cp -r carabase-claw-skills/carabase-knowledge ~/.openclaw/workspace/skills/
cp -r carabase-claw-skills/carabase-daily ~/.openclaw/workspace/skills/
```

## Configuration

Set these environment variables (or configure in your OpenClaw workspace settings):

| Variable | Required | Description |
|---|---|---|
| `CARABASE_HOST` | Yes | Base URL of your Carabase instance (e.g. `http://localhost:3000`) |
| `CARABASE_WORKSPACE_ID` | Yes | UUID of the workspace to operate on |

All REST API calls require the `x-workspace-id` header, which the skills populate from `CARABASE_WORKSPACE_ID`.

## Compatibility

| Skill version | Requires `carabase-host` |
|---|---|
| 2.1.x | ≥ Phase 15 (PR #64) — canonical `carabase_*` tool surface, Doctor-RAG hints, FLARE verification |
| 2.0.x | Phase 10 or earlier — legacy `search_semantic` / `query_graph` only |

## Usage Examples

**Task management**
```
"List my unchecked tasks for this week"
"Create a task 'Review PR #42' in the Backend folio"
"Mark the deploy task from yesterday as done"
```

**Knowledge search**
```
"Search my knowledge base for authentication patterns"
"What entities are connected to the Acme project?"
"Show me the about section of the Backend folio"
```

**Daily notes**
```
"Read today's daily note"
"Log that I finished the migration script, tag it #deploy"
```

## Related

- [carabase-host](https://github.com/carabase/carabase-host) — the self-hosted backend
- [carabase-claude-skills](https://github.com/carabase/carabase-claude-skills) — Claude Desktop MCP server

## License

MIT
