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

## Automated Ingestion

The ingestion script fetches articles from RSS feeds, uses a local LLM to filter, summarize, and tag them, then submits them to the API.

### Prerequisites

1. Install [Ollama](https://ollama.com)
2. Pull the model:
   ```bash
   ollama pull qwen3:1.7b
   ```

### Environment Variables

Add these to your `.env` file:

```bash
# Ingestion API
AGENT_NEWS_API_KEY="your-api-key"
AGENT_NEWS_URL="https://your-app-url.com"

# Articles per feed (optional, defaults to all)
INGEST_LIMIT="5"
# Number of feeds to process (optional, defaults to all)
INGEST_FEEDS=""

# Langfuse tracing (optional)
LANGFUSE_PUBLIC_KEY="pk-..."
LANGFUSE_SECRET_KEY="sk-..."
LANGFUSE_BASEURL="https://your-langfuse-url.com"
```

Generate an API key with:

```bash
bun run scripts/generate-api-key.ts <email>
```

### Running Manually

```bash
# All feeds, 5 articles per feed
bun run scripts/ingest/main.ts --limit 5

# Single feed, 1 article (for testing)
bun run scripts/ingest/main.ts --limit 1 --feeds 1

# Dry run (no submissions)
bun run scripts/ingest/main.ts --dry-run --limit 5
```

### Setting Up the Cron Job

The wrapper script `scripts/ingest/run.sh` ensures Ollama is running before starting ingestion. Set `INGEST_LIMIT` and `INGEST_FEEDS` in your `.env` to control how many articles and feeds to process. CLI flags (`--limit`, `--feeds`) override env vars.

1. Make the script executable:
   ```bash
   chmod +x scripts/ingest/run.sh
   ```

2. Update the `bun` path and `--limit` in `scripts/ingest/run.sh` to match your setup.

3. Add a cron entry (`crontab -e`) to run 4 times a day:
   ```
   0 */6 * * * /path/to/agent-news/scripts/ingest/run.sh
   ```

4. Logs are written to `/tmp/agent-news-ingest.log`:
   ```bash
   tail -f /tmp/agent-news-ingest.log
   ```
