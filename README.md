# carabase-claw-skills

OpenClaw AgentSkill templates for interacting with a [Carabase](https://carabase.io) instance. Carabase is a self-hosted personal knowledge system with daily notes, folios, a knowledge graph, artifacts, and memories — all accessible via REST API and MCP.

These skills let any OpenClaw-compatible agent manage tasks, search knowledge, write daily logs, and more against a running Carabase workspace.

## Skills

| Skill | Description |
|---|---|
| **carabase-core** | Connection setup, health check, MCP config, and references to all other skills |
| **carabase-tasks** | Create, list, filter, and toggle tasks extracted from daily notes |
| **carabase-knowledge** | Semantic search, knowledge graph queries, folio management, artifact reading |
| **carabase-daily** | Read and write daily notes, create log entries, inject content blocks |

## Installation

Copy the skill directories into your OpenClaw workspace skills folder:

```bash
# Clone the repo
git clone https://github.com/carabase/carabase-claw-skills.git

# Copy individual skills
cp -r carabase-claw-skills/carabase-core ~/.openclaw/workspace/skills/
cp -r carabase-claw-skills/carabase-tasks ~/.openclaw/workspace/skills/
cp -r carabase-claw-skills/carabase-knowledge ~/.openclaw/workspace/skills/
cp -r carabase-claw-skills/carabase-daily ~/.openclaw/workspace/skills/
```

Or copy all four at once:

```bash
cp -r carabase-claw-skills/carabase-* ~/.openclaw/workspace/skills/
```

## Configuration

Set these environment variables (or configure them in your OpenClaw workspace settings):

| Variable | Required | Description |
|---|---|---|
| `CARABASE_HOST` | Yes | Base URL of your Carabase instance (e.g., `http://localhost:3000`) |
| `CARABASE_WORKSPACE_ID` | Yes | UUID of the workspace to operate on |

All REST API calls require the `x-workspace-id` header, which the skills populate from `CARABASE_WORKSPACE_ID`.

## Usage Examples

### Task management
```
"List my unchecked tasks for this week"
"Create a task 'Review PR #42' in the Backend folio"
"Mark the deploy task from yesterday as done"
```

### Knowledge search
```
"Search my knowledge base for authentication patterns"
"What entities are connected to the Acme project?"
"Show me the about section of the Backend folio"
```

### Daily notes
```
"Read today's daily note"
"Log that I finished the migration script, tag it #deploy"
"Add a note about the meeting with design team to the Frontend folio"
```

### Core / setup
```
"Check if Carabase is healthy"
"Set up the MCP connection to Carabase"
```

## Docs

- [docs/api-reference.md](docs/api-reference.md) — Full REST API reference
- [docs/mcp-tools.md](docs/mcp-tools.md) — MCP tool reference and usage

## Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b my-skill-improvement`)
3. Edit or add skill SKILL.md files
4. Test against a running Carabase instance
5. Submit a pull request

Keep skills focused, practical, and well-documented. Each SKILL.md should be self-contained — an agent reading only that file should be able to use the skill without external context.

## License

MIT — see [LICENSE](LICENSE).
