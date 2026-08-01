const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json({ limit: "50mb" })); // support large file uploads as base64

const fs = require("fs");
let connectionString = process.env.DATABASE_URL;

// Auto-correct local DB URL to Docker DB host in production containers
if ((fs.existsSync("/.dockerenv") || process.platform !== "darwin") && connectionString && (connectionString.includes("localhost:5433") || connectionString.includes("127.0.0.1:5433"))) {
  console.log("Rewriting localhost:5433 database URL to internal Docker service db:5432");
  connectionString = connectionString.replace("localhost:5433", "db:5432").replace("127.0.0.1:5433", "db:5432");
}

// Run database migrations in the background asynchronously to ensure instant port binding
// for health checks and prevent container boot blocking on Avel Cloud / Coolify.
try {
  const { fork } = require("child_process");
  const migrationPath = path.join(__dirname, "migrate.cjs");
  if (fs.existsSync(migrationPath)) {
    console.log("Forking database migration script in background...");
    const migrator = fork(migrationPath, [], {
      env: { ...process.env, DATABASE_URL: connectionString }
    });
    migrator.on("exit", (code) => {
      console.log(`Background migration process exited with code ${code}`);
    });
    migrator.on("error", (err) => {
      console.error("Background migration process error:", err);
    });
  } else {
    console.log("Migration script not found, skipping background migration.");
  }
} catch (err) {
  console.error("Failed to start background migration fork:", err);
}

// Initialize PostgreSQL pool
const pool = new Pool({
  connectionString: connectionString,
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
});

// Whitelisted tables for security
const TABLE_WHITELIST = [
  "rk_project",
  "rk_sections",
  "rk_tasks",
  "rk_stakeholders",
  "rk_subtasks",
  "rk_superadmins",
  "rk_task_dependencies",
  "rk_team",
  "rk_documents",
];

// Helper to sanitize identifiers (column and table names) to prevent SQL injection
function sanitizeIdentifier(name) {
  if (!/^[a-zA-Z0-9_]+$/.test(name)) {
    throw new Error(`Invalid database identifier: ${name}`);
  }
  return `"${name}"`;
}

// Helper to lookup a user's role on a project
async function getUserRole(email, projectId) {
  if (!email) return null;

  // 1. Check if user is a super admin
  const adminRes = await pool.query("SELECT 1 FROM rk_superadmins WHERE lower(email) = lower($1)", [
    email,
  ]);
  if (adminRes.rows.length > 0) {
    return "Admin";
  }

  if (!projectId) return null;

  // 2. Check team membership for the project
  const teamRes = await pool.query(
    "SELECT role FROM rk_team WHERE project_id = $1 AND lower(email) = lower($2)",
    [projectId, email],
  );
  if (teamRes.rows.length > 0) {
    return teamRes.rows[0].role || "Staff"; // Default to Staff if empty
  }

  return null;
}

// Extract project ID from request body where possible
function extractProjectId(reqBody) {
  const { table, rpc, data, filters } = reqBody;
  if (rpc === "vault_document" && data) return data.p_project_id;
  if (data && data.project_id) return data.project_id;
  if (filters) {
    const pFilter = filters.find(
      (f) => f.field === "project_id" || (f.field === "id" && table === "rk_project"),
    );
    if (pFilter && pFilter.op === "eq") return pFilter.value;
  }
  return null;
}

// Fallback database lookup for project ID using a record's UUID
async function lookupProjectId(table, id) {
  if (!id) return null;
  try {
    if (table === "rk_project") return id;
    if (
      table === "rk_sections" ||
      table === "rk_tasks" ||
      table === "rk_stakeholders" ||
      table === "rk_team" ||
      table === "rk_documents"
    ) {
      const res = await pool.query(`SELECT project_id FROM "${table}" WHERE id = $1`, [id]);
      return res.rows[0]?.project_id || null;
    }
    if (table === "rk_subtasks") {
      const res = await pool.query(
        `SELECT t.project_id FROM rk_subtasks s JOIN rk_tasks t ON t.id = s.task_id WHERE s.id = $1`,
        [id],
      );
      return res.rows[0]?.project_id || null;
    }
    if (table === "rk_task_dependencies") {
      const res = await pool.query(
        `SELECT t.project_id FROM rk_task_dependencies d JOIN rk_tasks t ON t.id = d.task_id WHERE d.id = $1`,
        [id],
      );
      return res.rows[0]?.project_id || null;
    }
  } catch (err) {
    console.error("Error looking up project ID from DB:", err);
  }
  return null;
}

// 1. Generic Database Query Proxy (replaces direct Supabase client requests)
app.post("/api/db", async (req, res) => {
  const { table, rpc, action, data, filters, order, limit, single } = req.body;
  const userEmail = req.headers["x-user-email"];
  console.log(
    `[API DB] Request from ${userEmail}: table=${table}, rpc=${rpc}, action=${action}, data=${JSON.stringify(data)}, filters=${JSON.stringify(filters)}`,
  );

  // Check simple authentication
  if (!userEmail) {
    return res
      .status(401)
      .json({ data: null, error: { message: "Unauthorized: Missing user email header" } });
  }

  try {
    // Determine Project ID for RLS/RBAC checks
    let projectId = extractProjectId(req.body);
    if (!projectId && filters) {
      const idFilter = filters.find((f) => f.field === "id");
      if (idFilter && idFilter.op === "eq") {
        projectId = await lookupProjectId(table, idFilter.value);
      }
    }

    // Role-based Access Control authorization check
    let allowed = false;

    if (action === "select" || rpc === "get_user_projects") {
      if (table === "rk_superadmins") {
        allowed = true; // Anyone can check admin lists
      } else if (rpc === "get_user_projects") {
        // Enforce that the user can only query their own projects list
        if (data && data.p_email && data.p_email.toLowerCase() === userEmail.toLowerCase()) {
          allowed = true;
        }
      } else if (table === "rk_project" && !projectId) {
        allowed = true; // get_user_projects RPC filters internally
      } else {
        const role = await getUserRole(userEmail, projectId);
        allowed = role === "Admin" || role === "PM" || role === "Staff";
      }
    } else {
      // Write action (insert, update, delete)
      const role = await getUserRole(userEmail, projectId);

      if (role === "Admin") {
        allowed = true;
      } else if (role === "PM") {
        // PM can write anything, except deleting or archiving the project itself
        if (
          table === "rk_project" &&
          (action === "delete" || (data && data.is_archived !== undefined))
        ) {
          allowed = false;
        } else {
          allowed = true;
        }
      } else if (role === "Staff") {
        // Staff can only:
        // - Toggle checklist items (update rk_subtasks)
        // - Update task progress (update rk_tasks, but only percent_complete, actual_start, actual_duration)
        if (table === "rk_subtasks" && action === "update") {
          allowed = true;
        } else if (table === "rk_tasks" && action === "update") {
          const keys = Object.keys(data);
          const allowedStaffColumns = ["percent_complete", "actual_start", "actual_duration"];
          const changingForbidden = keys.some((k) => !allowedStaffColumns.includes(k));
          allowed = !changingForbidden;
        } else if (rpc === "update_task_secure") {
          const { p_activity, p_owner, p_plan_start, p_plan_duration, p_section_id } = data;
          const isChangingForbidden =
            p_activity || p_owner || p_plan_start || p_plan_duration || p_section_id;
          allowed = !isChangingForbidden;
        } else {
          allowed = false;
        }
      } else {
        // No role: can only insert into rk_project to create a new project
        if (table === "rk_project" && action === "insert") {
          allowed = true;
        } else {
          allowed = false;
        }
      }
    }

    if (!allowed) {
      console.log(
        `Forbidden database access attempt: table=${table}, rpc=${rpc}, action=${action} by ${userEmail}`,
      );
      return res.status(403).json({
        data: null,
        error: { message: "Forbidden: Insufficient privileges for this operation." },
      });
    }
    // A. Handle RPC Calls
    if (rpc) {
      console.log(`Executing RPC: ${rpc} for ${userEmail}`);
      let result = null;

      if (rpc === "get_user_projects") {
        const dbRes = await pool.query("SELECT * FROM get_user_projects($1)", [data.p_email]);
        result = dbRes.rows;
      } else if (rpc === "update_task_secure") {
        await pool.query("SELECT update_task_secure($1, $2, $3, $4, $5, $6, $7, $8, $9)", [
          data.p_id,
          data.p_activity,
          data.p_owner,
          data.p_plan_start,
          data.p_plan_duration,
          data.p_actual_start,
          data.p_actual_duration,
          data.p_percent_complete,
          data.p_section_id,
        ]);
        result = null;
      } else if (rpc === "update_subtask_secure") {
        await pool.query("SELECT update_subtask_secure($1, $2, $3)", [
          data.p_id,
          data.p_title,
          data.p_assignee,
        ]);
        result = null;
      } else if (rpc === "vault_document") {
        const { p_project_id, p_name, p_path, p_type, p_size, p_email } = data;

        // Start transaction
        const client = await pool.connect();
        try {
          await client.query("BEGIN");

          // Insert metadata
          const metaRes = await client.query(
            `INSERT INTO rk_documents (project_id, name, storage_path, content_type, size_bytes, created_by)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [p_project_id, p_name, p_path, p_type, p_size, p_email],
          );
          const document = metaRes.rows[0];

          // Fetch uploaded file from temp storage and insert into permanent storage
          const tempRes = await client.query(
            "SELECT content FROM rk_storage_temp WHERE storage_path = $1",
            [p_path],
          );

          if (tempRes.rows.length > 0) {
            const content = tempRes.rows[0].content;
            await client.query(
              "INSERT INTO rk_document_content (document_id, content) VALUES ($1, $2)",
              [document.id, content],
            );
            // Clean up temp
            await client.query("DELETE FROM rk_storage_temp WHERE storage_path = $1", [p_path]);
          }

          await client.query("COMMIT");
          result = document;
        } catch (err) {
          await client.query("ROLLBACK");
          throw err;
        } finally {
          client.release();
        }
      } else {
        return res
          .status(400)
          .json({ data: null, error: { message: `Unknown RPC function: ${rpc}` } });
      }

      return res.json({ data: result, error: null });
    }

    // B. Handle Standard Table Queries
    if (!TABLE_WHITELIST.includes(table)) {
      return res
        .status(400)
        .json({ data: null, error: { message: `Table not permitted: ${table}` } });
    }

    const safeTable = sanitizeIdentifier(table);
    const values = [];

    // SELECT
    if (action === "select") {
      let sql = `SELECT * FROM ${safeTable}`;

      if (filters && filters.length > 0) {
        const clauses = [];
        for (const f of filters) {
          const safeCol = sanitizeIdentifier(f.field);
          if (f.op === "eq") {
            values.push(f.value);
            clauses.push(`${safeCol} = $${values.length}`);
          } else if (f.op === "in") {
            values.push(f.value); // array parameter
            clauses.push(`${safeCol} = ANY($${values.length})`);
          } else {
            return res
              .status(400)
              .json({ data: null, error: { message: `Unsupported filter operator: ${f.op}` } });
          }
        }
        sql += ` WHERE ` + clauses.join(" AND ");
      }

      if (order && order.length > 0) {
        const orderClauses = order.map((o) => {
          return `${sanitizeIdentifier(o.field)} ${o.ascending ? "ASC" : "DESC"}`;
        });
        sql += ` ORDER BY ` + orderClauses.join(", ");
      }

      if (limit) {
        sql += ` LIMIT ${parseInt(limit)}`;
      }

      const dbRes = await pool.query(sql, values);
      let result = dbRes.rows;
      if (single) {
        result = dbRes.rows.length > 0 ? dbRes.rows[0] : null;
      }
      return res.json({ data: result, error: null });
    }

    // INSERT
    if (action === "insert") {
      const isArray = Array.isArray(data);
      const rows = isArray ? data : [data];

      if (rows.length === 0) {
        return res.json({ data: [], error: null });
      }

      const keys = Object.keys(rows[0]);
      if (keys.length === 0) {
        return res.status(400).json({ data: null, error: { message: "Insert data is empty" } });
      }

      const cols = keys.map(sanitizeIdentifier).join(", ");
      
      const values = [];
      const placeholderRows = [];
      let valIdx = 1;
      
      for (const row of rows) {
        const rowPlaceholders = [];
        for (const k of keys) {
          values.push(row[k]);
          rowPlaceholders.push(`$${valIdx++}`);
        }
        placeholderRows.push(`(${rowPlaceholders.join(", ")})`);
      }

      const sql = `INSERT INTO ${safeTable} (${cols}) VALUES ${placeholderRows.join(", ")} RETURNING *`;
      const dbRes = await pool.query(sql, values);
      
      let result = dbRes.rows;
      if (single && !isArray) {
        result = dbRes.rows.length > 0 ? dbRes.rows[0] : null;
      }
      return res.json({ data: result, error: null });
    }

    // UPDATE
    if (action === "update") {
      const keys = Object.keys(data);
      if (keys.length === 0) {
        return res.status(400).json({ data: null, error: { message: "Update patch is empty" } });
      }

      const setClauses = [];
      for (const k of keys) {
        values.push(data[k]);
        setClauses.push(`${sanitizeIdentifier(k)} = $${values.length}`);
      }

      let sql = `UPDATE ${safeTable} SET ${setClauses.join(", ")}`;

      if (filters && filters.length > 0) {
        const clauses = [];
        for (const f of filters) {
          const safeCol = sanitizeIdentifier(f.field);
          if (f.op === "eq") {
            values.push(f.value);
            clauses.push(`${safeCol} = $${values.length}`);
          } else if (f.op === "in") {
            values.push(f.value);
            clauses.push(`${safeCol} = ANY($${values.length})`);
          } else {
            return res
              .status(400)
              .json({ data: null, error: { message: `Unsupported filter operator: ${f.op}` } });
          }
        }
        sql += ` WHERE ` + clauses.join(" AND ");
      }

      sql += ` RETURNING *`;

      const dbRes = await pool.query(sql, values);
      const result = single ? dbRes.rows[0] : dbRes.rows;
      return res.json({ data: result, error: null });
    }

    // DELETE
    if (action === "delete") {
      let sql = `DELETE FROM ${safeTable}`;

      if (filters && filters.length > 0) {
        const clauses = [];
        for (const f of filters) {
          const safeCol = sanitizeIdentifier(f.field);
          if (f.op === "eq") {
            values.push(f.value);
            clauses.push(`${safeCol} = $${values.length}`);
          } else if (f.op === "in") {
            values.push(f.value);
            clauses.push(`${safeCol} = ANY($${values.length})`);
          } else {
            return res
              .status(400)
              .json({ data: null, error: { message: `Unsupported filter operator: ${f.op}` } });
          }
        }
        sql += ` WHERE ` + clauses.join(" AND ");
      }

      sql += ` RETURNING *`;

      const dbRes = await pool.query(sql, values);
      return res.json({ data: dbRes.rows, error: null });
    }

    return res
      .status(400)
      .json({ data: null, error: { message: `Unsupported database action: ${action}` } });
  } catch (err) {
    console.error("Database query error:", err);
    return res.status(500).json({ data: null, error: { message: err.message } });
  }
});

// 2. Storage Upload (uploads base64 file to temporary table)
app.post("/api/storage/upload", async (req, res) => {
  const { bucket, path: storagePath, name, type, size, fileData } = req.body;
  const userEmail = req.headers["x-user-email"];

  if (!userEmail) {
    return res.status(401).send("Unauthorized");
  }

  // Extract project ID from storage path (e.g. "project-uuid/filename")
  const projectId = storagePath.split("/")[0];

  try {
    const role = await getUserRole(userEmail, projectId);
    if (role !== "Admin" && role !== "PM") {
      return res.status(403).send("Forbidden: Only PMs and Admins can upload documents.");
    }

    // Create temp storage table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.rk_storage_temp (
        storage_path text PRIMARY KEY,
        content text NOT NULL,
        created_at timestamp with time zone DEFAULT now()
      );
    `);

    // Insert file data into temp storage
    await pool.query(
      `INSERT INTO rk_storage_temp (storage_path, content) 
       VALUES ($1, $2) 
       ON CONFLICT (storage_path) DO UPDATE SET content = EXCLUDED.content`,
      [storagePath, fileData],
    );

    console.log(`Uploaded file to temp storage: ${storagePath}`);
    res.json({ success: true });
  } catch (err) {
    console.error("Storage upload error:", err);
    res.status(500).send(err.message);
  }
});

// 3. Storage Download (downloads file from Postgres and sends binary buffer)
app.get("/api/storage/download", async (req, res) => {
  const { bucket, path: storagePath } = req.query;
  const userEmail = req.headers["x-user-email"];

  if (!userEmail) {
    return res.status(401).send("Unauthorized");
  }

  try {
    // Fetch document metadata and project ID
    const metaRes = await pool.query(
      "SELECT id, name, content_type, project_id FROM rk_documents WHERE storage_path = $1",
      [storagePath],
    );

    if (metaRes.rows.length === 0) {
      return res.status(404).send("Document metadata not found");
    }

    const document = metaRes.rows[0];

    // Enforce project access for downloads
    const role = await getUserRole(userEmail, document.project_id);
    if (role !== "Admin" && role !== "PM" && role !== "Staff") {
      return res.status(403).send("Forbidden: Access denied to this project's files.");
    }

    // Fetch document content
    const contentRes = await pool.query(
      "SELECT content FROM rk_document_content WHERE document_id = $1",
      [document.id],
    );

    if (contentRes.rows.length === 0) {
      return res.status(404).send("Document content not found");
    }

    const base64Content = contentRes.rows[0].content;
    const fileBuffer = Buffer.from(base64Content, "base64");

    res.setHeader("Content-Type", document.content_type || "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(document.name)}"`,
    );
    res.send(fileBuffer);
  } catch (err) {
    console.error("Storage download error:", err);
    res.status(500).send(err.message);
  }
});

// 4. Storage Remove
app.post("/api/storage/remove", async (req, res) => {
  const { bucket, paths } = req.body;
  const userEmail = req.headers["x-user-email"];

  if (!userEmail) {
    return res.status(401).send("Unauthorized");
  }

  try {
    for (const p of paths) {
      const projectId = p.split("/")[0];
      const role = await getUserRole(userEmail, projectId);
      if (role !== "Admin" && role !== "PM") {
        return res.status(403).send("Forbidden: Only PMs and Admins can remove documents.");
      }

      // Cascading delete handles rk_document_content automatically via FK constraint
      await pool.query("DELETE FROM rk_documents WHERE storage_path = $1", [p]);
      await pool.query("DELETE FROM rk_storage_temp WHERE storage_path = $1", [p]);
    }
    res.json({ success: true });
  } catch (err) {
    console.error("Storage remove error:", err);
    res.status(500).send(err.message);
  }
});

// 5. Serve static client files in production
app.use(express.static(path.join(__dirname, "dist")));

// SPA catch-all — must come after all API routes and static middleware.
// Serves index.html for every GET request that doesn't match an API route
// or a static asset, so TanStack Router can handle client-side navigation.
// Using app.use() instead of app.get("*") for Express 4/5 compatibility
// (bare "*" doesn't match paths containing "/" in Express 5).
app.use((req, res, next) => {
  if (req.method !== "GET") return next();
  // Don't intercept API or storage routes
  if (req.path.startsWith("/api/") || req.path.startsWith("/storage/")) return next();
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});


// Start server on multiple fallback ports to resolve any deployment port mismatch
// (Avel Cloud, Docker, app.yaml on 8080, local dev on 3010).
// Handles EADDRINUSE/EACCES errors gracefully to prevent crashing.
const listenPorts = new Set([3000, 3010, 8080]);
if (process.env.PORT) {
  const envPort = parseInt(process.env.PORT, 10);
  if (!isNaN(envPort)) {
    listenPorts.add(envPort);
  }
}

for (const p of listenPorts) {
  const server = app.listen(p, () => {
    console.log(`Server listening on port ${p}`);
  });
  server.on("error", (err) => {
    console.warn(`Port listener on port ${p} failed or was already in use:`, err.message);
  });
}

