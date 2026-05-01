import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";
import { Pool, PoolConfig } from "pg";
import express from "express";
import cors from "cors";
import * as dotenv from "dotenv";

dotenv.config();

// ── PostgreSQL Connection Helper ────────────────────────────────────

const getPoolConfigFromHeaders = (headers: any): PoolConfig => {
  const host = headers["x-pg-host"] || process.env.PG_HOST || "localhost";
  const port = parseInt(headers["x-pg-port"] || process.env.PG_PORT || "5432", 10);
  const user = headers["x-pg-user"] || process.env.PG_USER || "postgres";
  const password = headers["x-pg-password"] || process.env.PG_PASSWORD || "postgres";
  const database = headers["x-pg-database"] || process.env.PG_DATABASE || "postgres";
  const caCert = headers["x-pg-ca-cert"] || process.env.PG_CA_CERT;
  const sslHeader = headers["x-pg-ssl"] || process.env.PG_SSL;

  return {
    host,
    port,
    user,
    password,
    database,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: caCert
      ? { ca: caCert }
      : sslHeader === "true"
        ? { rejectUnauthorized: false }
        : false,
  };
};

// ── MCP Server Factory ───────────────────────────────────────────────

const createMcpServer = (pool: Pool) => {
  const server = new McpServer({
    name: "postgres-mcp-server",
    version: "1.0.0",
  });

  // ── Tool: query ──────────────────────────────────────────────────────
  // Execute a read-only SQL query (SELECT, SHOW, EXPLAIN, etc.)

  server.tool(
    "query",
    "Execute a read-only SQL query against the PostgreSQL database. Use this for SELECT, SHOW, EXPLAIN statements.",
    {
      sql: z.string().describe("The SQL query to execute (read-only)"),
    },
    async ({ sql }) => {
      const client = await pool.connect();
      try {
        // Wrap in a read-only transaction for safety
        await client.query("BEGIN TRANSACTION READ ONLY");
        const result = await client.query(sql);
        await client.query("COMMIT");

        const rows = result.rows;
        const fields = result.fields.map((f) => f.name);

        // Format output as a readable table
        let text = `Columns: ${fields.join(", ")}\n`;
        text += `Rows returned: ${rows.length}\n\n`;

        if (rows.length > 0) {
          // Build simple text table
          rows.forEach((row, i) => {
            text += `--- Row ${i + 1} ---\n`;
            fields.forEach((field) => {
              text += `  ${field}: ${JSON.stringify(row[field])}\n`;
            });
          });
        }

        return { content: [{ type: "text", text }] };
      } catch (err: any) {
        await client.query("ROLLBACK").catch(() => {});
        return {
          content: [{ type: "text", text: `Error: ${err.message}` }],
          isError: true,
        };
      } finally {
        client.release();
      }
    },
  );

  // ── Tool: execute ────────────────────────────────────────────────────
  // Execute a write SQL statement (INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, etc.)

  server.tool(
    "execute",
    "Execute a write SQL statement (INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, etc.) against the PostgreSQL database.",
    {
      sql: z.string().describe("The SQL statement to execute"),
    },
    async ({ sql }) => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await client.query(sql);
        await client.query("COMMIT");

        const text = `Statement executed successfully.\nRows affected: ${result.rowCount}`;
        return { content: [{ type: "text", text }] };
      } catch (err: any) {
        await client.query("ROLLBACK").catch(() => {});
        return {
          content: [{ type: "text", text: `Error: ${err.message}` }],
          isError: true,
        };
      } finally {
        client.release();
      }
    },
  );

  // ── Tool: list_tables ────────────────────────────────────────────────

  server.tool(
    "list_tables",
    "List all tables in the current database (public schema by default).",
    {
      schema: z
        .string()
        .optional()
        .default("public")
        .describe("The schema to list tables from (default: public)"),
    },
    async ({ schema }) => {
      const client = await pool.connect();
      try {
        const result = await client.query(
          `SELECT table_name, table_type
           FROM information_schema.tables
           WHERE table_schema = $1
           ORDER BY table_name`,
          [schema],
        );

        if (result.rows.length === 0) {
          return {
            content: [
              { type: "text", text: `No tables found in schema "${schema}".` },
            ],
          };
        }

        let text = `Tables in schema "${schema}":\n\n`;
        result.rows.forEach((row) => {
          text += `  - ${row.table_name} (${row.table_type})\n`;
        });

        return { content: [{ type: "text", text }] };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: `Error: ${err.message}` }],
          isError: true,
        };
      } finally {
        client.release();
      }
    },
  );

  // ── Tool: describe_table ─────────────────────────────────────────────

  server.tool(
    "describe_table",
    "Describe the columns and types of a specific table.",
    {
      table: z.string().describe("The table name to describe"),
      schema: z
        .string()
        .optional()
        .default("public")
        .describe("The schema the table belongs to (default: public)"),
    },
    async ({ table, schema }) => {
      const client = await pool.connect();
      try {
        const result = await client.query(
          `SELECT column_name, data_type, is_nullable, column_default, character_maximum_length
           FROM information_schema.columns
           WHERE table_schema = $1 AND table_name = $2
           ORDER BY ordinal_position`,
          [schema, table],
        );

        if (result.rows.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `Table "${schema}.${table}" not found or has no columns.`,
              },
            ],
          };
        }

        let text = `Table: ${schema}.${table}\n\n`;
        text += `${"Column".padEnd(30)} ${"Type".padEnd(25)} ${"Nullable".padEnd(10)} Default\n`;
        text += `${"─".repeat(30)} ${"─".repeat(25)} ${"─".repeat(10)} ${"─".repeat(20)}\n`;

        result.rows.forEach((row) => {
          const type = row.character_maximum_length
            ? `${row.data_type}(${row.character_maximum_length})`
            : row.data_type;
          text += `${(row.column_name as string).padEnd(30)} ${type.padEnd(25)} ${row.is_nullable.padEnd(10)} ${row.column_default || ""}\n`;
        });

        // Also fetch primary key info
        const pkResult = await client.query(
          `SELECT kcu.column_name
           FROM information_schema.table_constraints tc
           JOIN information_schema.key_column_usage kcu
             ON tc.constraint_name = kcu.constraint_name
             AND tc.table_schema = kcu.table_schema
           WHERE tc.constraint_type = 'PRIMARY KEY'
             AND tc.table_schema = $1
             AND tc.table_name = $2
           ORDER BY kcu.ordinal_position`,
          [schema, table],
        );

        if (pkResult.rows.length > 0) {
          const pkCols = pkResult.rows.map((r) => r.column_name).join(", ");
          text += `\nPrimary Key: ${pkCols}`;
        }

        // Fetch foreign keys
        const fkResult = await client.query(
          `SELECT
             kcu.column_name,
             ccu.table_schema AS foreign_table_schema,
             ccu.table_name AS foreign_table_name,
             ccu.column_name AS foreign_column_name
           FROM information_schema.table_constraints tc
           JOIN information_schema.key_column_usage kcu
             ON tc.constraint_name = kcu.constraint_name
             AND tc.table_schema = kcu.table_schema
           JOIN information_schema.constraint_column_usage ccu
             ON ccu.constraint_name = tc.constraint_name
             AND ccu.table_schema = tc.table_schema
           WHERE tc.constraint_type = 'FOREIGN KEY'
             AND tc.table_schema = $1
             AND tc.table_name = $2`,
          [schema, table],
        );

        if (fkResult.rows.length > 0) {
          text += `\n\nForeign Keys:\n`;
          fkResult.rows.forEach((row) => {
            text += `  - ${row.column_name} → ${row.foreign_table_schema}.${row.foreign_table_name}(${row.foreign_column_name})\n`;
          });
        }

        // Fetch indexes
        const indexResult = await client.query(
          `SELECT indexname, indexdef
           FROM pg_indexes
           WHERE schemaname = $1 AND tablename = $2
           ORDER BY indexname`,
          [schema, table],
        );

        if (indexResult.rows.length > 0) {
          text += `\nIndexes:\n`;
          indexResult.rows.forEach((row) => {
            text += `  - ${row.indexname}: ${row.indexdef}\n`;
          });
        }

        return { content: [{ type: "text", text }] };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: `Error: ${err.message}` }],
          isError: true,
        };
      } finally {
        client.release();
      }
    },
  );

  // ── Tool: list_schemas ───────────────────────────────────────────────

  server.tool(
    "list_schemas",
    "List all schemas in the current database.",
    {},
    async () => {
      const client = await pool.connect();
      try {
        const result = await client.query(
          `SELECT schema_name
           FROM information_schema.schemata
           WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
           ORDER BY schema_name`,
        );

        let text = `Schemas:\n`;
        result.rows.forEach((row) => {
          text += `  - ${row.schema_name}\n`;
        });
        return { content: [{ type: "text", text }] };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: `Error: ${err.message}` }],
          isError: true,
        };
      } finally {
        client.release();
      }
    },
  );

  // ── Resource: Database schema overview ───────────────────────────────

  server.resource(
    "schema-overview",
    "postgres://schema/overview",
    async (uri) => {
      const client = await pool.connect();
      try {
        const result = await client.query(
          `SELECT t.table_schema, t.table_name, t.table_type,
                  string_agg(c.column_name || ' ' || c.data_type, ', ' ORDER BY c.ordinal_position) as columns
           FROM information_schema.tables t
           LEFT JOIN information_schema.columns c
             ON t.table_schema = c.table_schema AND t.table_name = c.table_name
           WHERE t.table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
           GROUP BY t.table_schema, t.table_name, t.table_type
           ORDER BY t.table_schema, t.table_name`,
        );

        let text = `# Database Schema Overview\n\n`;
        let currentSchema = "";
        result.rows.forEach((row) => {
          if (row.table_schema !== currentSchema) {
            currentSchema = row.table_schema;
            text += `\n## Schema: ${currentSchema}\n\n`;
          }
          text += `### ${row.table_name} (${row.table_type})\n`;
          text += `Columns: ${row.columns || "(none)"}\n\n`;
        });

        return {
          contents: [{ uri: uri.href, mimeType: "text/markdown", text }],
        };
      } catch (err: any) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/plain",
              text: `Error: ${err.message}`,
            },
          ],
        };
      } finally {
        client.release();
      }
    },
  );
  return server;
};

// ── Express + SSE Transport ───────────────────────────────────────────

const PORT = parseInt(process.env.PORT || "9000", 10);
const app = express();
app.use(cors());

// Store active transports so we can route messages back
const transports: Record<string, { transport: SSEServerTransport; pool: Pool }> = {};

// SSE endpoint — clients connect here to receive events
app.get("/sse", async (req, res) => {
  const poolConfig = getPoolConfigFromHeaders(req.headers);
  const sessionPool = new Pool(poolConfig);

  const transport = new SSEServerTransport("/messages", res);
  const server = createMcpServer(sessionPool);

  transports[transport.sessionId] = { transport, pool: sessionPool };

  res.on("close", async () => {
    const session = transports[transport.sessionId];
    if (session) {
      await session.pool.end().catch((err) => console.error("Error closing pool:", err));
      delete transports[transport.sessionId];
    }
  });

  await server.connect(transport);
});

// Message endpoint — clients POST JSON-RPC messages here
app.post("/messages", async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const session = transports[sessionId];
  if (!session) {
    res.status(400).json({ error: "Invalid or missing sessionId" });
    return;
  }
  await session.transport.handlePostMessage(req, res);
});

app.listen(PORT, () => {
  console.log(`PostgreSQL MCP Server running at http://localhost:${PORT}`);
  console.log(`  SSE endpoint:     http://localhost:${PORT}/sse`);
  console.log(`  Message endpoint:  http://localhost:${PORT}/messages`);
  console.log(`  Connection data will be read from "x-pg-*" headers.`);
});

