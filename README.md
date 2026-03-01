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

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure your database connection

Edit the `.env` file with your PostgreSQL credentials:

```env
PG_HOST=localhost
PG_PORT=5432
PG_USER=postgres
PG_PASSWORD=your_password_here
PG_DATABASE=your_database_name
```

### 3. Build

```bash
npm run build
```

### 4. Configure in VS Code (Copilot / Claude Desktop)

Add this to your MCP settings:

**VS Code** (`.vscode/settings.json` or User Settings):

```json
{
  "mcp": {
    "servers": {
      "postgres": {
        "command": "node",
        "args": ["c:\\Users\\Admin\\Desktop\\postgree mco\\dist\\index.js"],
        "env": {
          "PG_HOST": "localhost",
          "PG_PORT": "5432",
          "PG_USER": "postgres",
          "PG_PASSWORD": "your_password",
          "PG_DATABASE": "your_database"
        }
      }
    }
  }
}
```

**Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "postgres": {
      "command": "node",
      "args": ["c:\\Users\\Admin\\Desktop\\postgree mco\\dist\\index.js"],
      "env": {
        "PG_HOST": "localhost",
        "PG_PORT": "5432",
        "PG_USER": "postgres",
        "PG_PASSWORD": "your_password",
        "PG_DATABASE": "your_database"
      }
    }
  }
}
```

## Usage Examples

Once configured, you can ask the AI assistant things like:

- "List all tables in my database"
- "Describe the users table"
- "SELECT * FROM orders WHERE created_at > '2025-01-01'"
- "Create a new table called products"
