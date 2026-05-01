# PostgreSQL MCP Server

An MCP (Model Context Protocol) server that connects to a local PostgreSQL database, enabling AI assistants to query and manage your database.

## Tools Provided

| Tool | Description |
|------|-------------|
| **query** | Execute read-only SQL (SELECT, SHOW, EXPLAIN) |
| **execute** | Execute write SQL (INSERT, UPDATE, DELETE, CREATE, ALTER, DROP) |
| **list_tables** | List all tables in a schema |
| **describe_table** | Show columns, types, keys, and indexes for a table |
| **list_schemas** | List all user schemas in the database |

## Resources

- **schema-overview** (`postgres://schema/overview`) — Full database schema overview in Markdown

## Dynamic Connection via Headers

This server supports dynamic PostgreSQL connections. You can provide database credentials via HTTP headers in the initial SSE connection request. This allows a single deployed instance of the server to serve multiple different databases.

### Supported Headers

| Header | Description | Default |
|--------|-------------|---------|
| `x-pg-host` | PostgreSQL Host | `PG_HOST` or `localhost` |
| `x-pg-port` | PostgreSQL Port | `PG_PORT` or `5432` |
| `x-pg-user` | PostgreSQL User | `PG_USER` or `postgres` |
| `x-pg-password` | PostgreSQL Password | `PG_PASSWORD` or `postgres` |
| `x-pg-database` | PostgreSQL Database | `PG_DATABASE` or `postgres` |
| `x-pg-ssl` | Use SSL (`true`/`false`) | `PG_SSL` or `false` |
| `x-pg-ca-cert` | CA Certificate | `PG_CA_CERT` |

---

## Configuration in Antigravity / Cursor (VS Code)

To use this server with **Antigravity** or **Cursor**, add the following to your `mcp_config.json` (usually found in `%APPDATA%\antigravity\` or your IDE's MCP settings):

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://postgree-mcp-dfadduf9bsdvdwa9.eastasia-01.azurewebsites.net/sse",
        "--header", "x-pg-host: pg-168600c0-aeiyankhan2-d42e.g.aivencloud.com",
        "--header", "x-pg-port: 26768",
        "--header", "x-pg-user: avnadmin",
        "--header", "x-pg-password: YOUR_PASSWORD",
        "--header", "x-pg-database: defaultdb",
        "--header", "x-pg-ssl: true"
      ]
    }
  }
}
```

---

## Configuration in Claude Code CLI

If you use the **Claude Code CLI**, you can add this server using the following command:

### 1. Install Claude Code (if not already installed)
```bash
npm install -g @anthropic-ai/claude-code
```

### 2. Add the PostgreSQL MCP Server
Run this command in your terminal:

```bash
claude mcp add postgres -- npx mcp-remote https://postgree-mcp-dfadduf9bsdvdwa9.eastasia-01.azurewebsites.net/sse \
  --header "x-pg-host: pg-168600c0-aeiyankhan2-d42e.g.aivencloud.com" \
  --header "x-pg-port: 26768" \
  --header "x-pg-user: avnadmin" \
  --header "x-pg-password: YOUR_PASSWORD" \
  --header "x-pg-database: defaultdb" \
  --header "x-pg-ssl: true"
```

---

## Configuration in Claude Desktop

Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://postgree-mcp-dfadduf9bsdvdwa9.eastasia-01.azurewebsites.net/sse",
        "--header", "x-pg-host: pg-168600c0-aeiyankhan2-d42e.g.aivencloud.com",
        "--header", "x-pg-port: 26768",
        "--header", "x-pg-user: avnadmin",
        "--header", "x-pg-password: YOUR_PASSWORD",
        "--header", "x-pg-database: defaultdb",
        "--header", "x-pg-ssl: true"
      ]
    }
  }
}
```

---

## Local Setup (For Development)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure default database (Optional)

You can still use a `.env` file for local development:

```env
PG_HOST=localhost
PG_PORT=5432
PG_USER=postgres
PG_PASSWORD=your_password_here
PG_DATABASE=your_database_name
```

### 3. Build and Run

```bash
npm run build
npm start
```


## Usage Examples

Once configured, you can ask the AI assistant things like:

- "List all tables in my database"
- "Describe the users table"
- "SELECT * FROM orders WHERE created_at > '2025-01-01'"
- "Create a new table called products"

