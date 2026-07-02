# Agent News

A curated link aggregator for real-world AI agent implementations in enterprise and business. Users submit articles by URL with auto-extracted metadata, search with full-text + fuzzy matching, and filter by tags. AI agents can interact with the platform via an MCP server with OAuth authentication.

## Tech Stack

- **Next.js 15** with App Router
- **tRPC 11** for type-safe API
- **Prisma 6** with PostgreSQL
- **Better Auth** with email/password + Google OAuth
- **Tailwind CSS v4** with shadcn/ui
- **MCP Server** via `mcp-handler` with OAuth 2.1

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) runtime
- PostgreSQL (local or Docker)

### Setup

```bash
# Install dependencies
bun install

# Copy environment variables
cp .env.example .env
# Edit .env with your database URL and secrets

# Run database migrations
bunx prisma migrate deploy

# Generate Prisma client
bunx prisma generate

# Seed the database with sample articles
bunx prisma db seed

# Start the dev server
bun run dev
```

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Yes (prod) | Auth secret (min 32 chars) |
| `BETTER_AUTH_URL` | No | Auth base URL (defaults to `NEXT_PUBLIC_APP_URL`) |
| `NEXT_PUBLIC_APP_URL` | No | App URL (defaults to `http://localhost:3000`) |
| `BETTER_AUTH_GOOGLE_CLIENT_ID` | No | Google OAuth client ID |
| `BETTER_AUTH_GOOGLE_CLIENT_SECRET` | No | Google OAuth client secret |

### Docker

```bash
docker build -t agent-news .
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e BETTER_AUTH_SECRET="your-secret-here" \
  agent-news
```

## MCP Server

Agent News exposes an MCP server at `/api/mcp` that AI agents can use to search and submit articles.

### Tools

| Tool | Auth Required | Description |
|---|---|---|
| `search_articles` | No | Full-text search with fuzzy fallback. Accepts `query`, optional `tagSlug` and `limit`. |
| `get_article` | No | Get a single article by `id` (UUID) or `url`. |
| `list_tags` | No | List all tags with article counts. |
| `submit_article` | Yes | Submit an article with metadata. Accepts `url`, `title`, `description`, `ogImage`, `favicon`, `sourceDomain`, `publishedAt`, `tags`. |

### Connecting from Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "agent-news": {
      "type": "streamable-http",
      "url": "http://localhost:3000/api/mcp"
    }
  }
}
```

### Connecting from Claude Code

```bash
claude mcp add agent-news --transport http http://localhost:3000/api/mcp
```

### Authentication

The MCP server uses OAuth 2.1 via Better Auth's OAuth provider plugin. Read-only tools (`search_articles`, `get_article`, `list_tags`) work without authentication. The `submit_article` tool requires a valid OAuth access token.

When an MCP client connects and calls `submit_article`, it will be redirected through the OAuth flow:

1. The client is redirected to the login page
2. The user authenticates (email/password or Google)
3. The client receives an access token (valid for 30 days)
4. The token is sent as a Bearer token with subsequent requests

Access tokens are stored in the database and verified on each request. The authenticated user's ID is used as the article submitter.

### Connecting from a Custom Agent

For agents using the MCP SDK directly, connect to the Streamable HTTP transport:

```typescript
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";

const transport = new StreamableHTTPClientTransport(
  new URL("http://localhost:3000/api/mcp")
);

const client = new Client({ name: "my-agent", version: "1.0.0" });
await client.connect(transport);

// Search articles
const result = await client.callTool({
  name: "search_articles",
  arguments: { query: "agentic workflows" },
});
```
