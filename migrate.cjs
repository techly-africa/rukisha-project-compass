const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

let dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.warn("Warning: DATABASE_URL environment variable is not set. Skipping migration.");
  process.exit(0);
}


// Auto-correct local DB URL to Docker DB host in container/Linux production environments
if ((process.platform !== "darwin" || fs.existsSync("/.dockerenv")) && (dbUrl.includes("localhost:5433") || dbUrl.includes("127.0.0.1:5433"))) {
  console.log("Rewriting localhost:5433 database URL to internal Docker service db:5432");
  dbUrl = dbUrl.replace("localhost:5433", "db:5432").replace("127.0.0.1:5433", "db:5432");
}



async function run() {
  let client;
  let retries = 15;
  while (retries > 0) {
    try {
      client = new Client({ connectionString: dbUrl });
      await client.connect();
      break;
    } catch (err) {
      retries--;
      if (retries === 0) {
        console.error("Failed to connect to database after 15 attempts:", err.message);
        process.exit(1);
      }
      console.log(`Database is not ready yet. Retrying in 2 seconds... (${retries} attempts left)`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  console.log("Connected to database successfully.");

  let sql;
  try {
    sql = fs.readFileSync(path.join(__dirname, "supabase_schema_backup.sql"), "utf8");
  } catch (err) {
    console.error("Failed to read supabase_schema_backup.sql:", err.message);
    await client.end();
    process.exit(1);
  }

  // Strip Supabase specific commands
  const lines = sql.split("\n");
  const cleanedLines = lines.map((line) => {
    let cleaned = line;

    // Remove custom role restrictions from policies (e.g. TO "authenticated", "anon")
    if (cleaned.includes("CREATE POLICY") && cleaned.includes("TO ")) {
      cleaned = cleaned.replace(/TO\s+"[a-zA-Z0-9_]+"(,\s*"[a-zA-Z0-9_]+")*/gi, "");
    }

    const trimmed = cleaned.trim();
    if (trimmed.startsWith("CREATE EXTENSION")) return "-- " + cleaned;
    if (trimmed.startsWith("ALTER PUBLICATION")) return "-- " + cleaned;
    if (trimmed.includes("OWNER TO")) return "-- " + cleaned;
    if (trimmed.startsWith("ALTER DEFAULT PRIVILEGES")) return "-- " + cleaned;
    if (
      trimmed.startsWith("GRANT") &&
      (trimmed.includes("anon") ||
        trimmed.includes("authenticated") ||
        trimmed.includes("service_role"))
    ) {
      return "-- " + cleaned;
    }
    return cleaned;
  });

  const cleanedSql = cleanedLines.join("\n");

  // Try applying all at once
  try {
    console.log("Applying database schema...");
    await client.query(cleanedSql);
    console.log("Schema applied successfully.");
  } catch (err) {
    console.log("Notice: Full schema execution failed due to:", err.message);
    console.log(
      "Executing statement-by-statement fallback (ignoring duplicate relation errors)...",
    );

    // Fallback: split by semicolon and run separately
    const statements = cleanedSql.split(/;\s*$/m);
    let successCount = 0;
    let failCount = 0;

    for (const stmt of statements) {
      const cleanStmt = stmt.trim();
      if (!cleanStmt) continue;

      try {
        await client.query(cleanStmt);
        successCount++;
      } catch (stmtErr) {
        // Ignore duplicate relation or function errors
        if (stmtErr.code === "42P07" || stmtErr.code === "42723") {
          successCount++; // Count as success since it's already there
        } else {
          console.warn(`Warning executing statement: ${stmtErr.message}`);
          failCount++;
        }
      }
    }
    console.log(
      `Schema application fallback complete. Successes: ${successCount}, Ignored/Failed: ${failCount}`,
    );
  }

  // Create document content table
  try {
    console.log("Creating document content table (rk_document_content)...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.rk_document_content (
        document_id uuid PRIMARY KEY REFERENCES public.rk_documents(id) ON DELETE CASCADE,
        content text NOT NULL
      );
    `);
    console.log("Document content table ready.");
  } catch (err) {
    console.error("Failed to create document content table:", err.message);
  }

  // Create description, comments, attachments tables for tasks
  try {
    console.log("Ensuring task description, comments, and attachments tables...");
    await client.query(`
      ALTER TABLE public.rk_tasks ADD COLUMN IF NOT EXISTS description text DEFAULT '' NOT NULL;

      CREATE TABLE IF NOT EXISTS public.rk_task_comments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id uuid NOT NULL REFERENCES public.rk_tasks(id) ON DELETE CASCADE,
        author text NOT NULL,
        content text NOT NULL,
        created_at timestamp with time zone DEFAULT now() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS public.rk_task_attachments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id uuid NOT NULL REFERENCES public.rk_tasks(id) ON DELETE CASCADE,
        name text NOT NULL,
        url text NOT NULL,
        size text DEFAULT '' NOT NULL,
        created_at timestamp with time zone DEFAULT now() NOT NULL
      );
    `);
    console.log("Task description, comments, and attachments tables ready.");
  } catch (err) {
    console.error("Failed to create task comments/attachments tables:", err.message);
  }

  // Create Organizations and Org Members tables & backfill
  try {
    console.log("Ensuring organization and org members tables...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.rk_organizations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL DEFAULT 'Rukisha Africa',
        created_at timestamp with time zone DEFAULT now() NOT NULL
      );

      INSERT INTO public.rk_organizations (id, name)
      VALUES ('00000000-0000-0000-0000-000000000001', 'Rukisha Africa')
      ON CONFLICT (id) DO NOTHING;

      ALTER TABLE public.rk_project ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.rk_organizations(id);
      UPDATE public.rk_project SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;

      CREATE TABLE IF NOT EXISTS public.rk_org_members (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id uuid NOT NULL REFERENCES public.rk_organizations(id) ON DELETE CASCADE,
        email text NOT NULL,
        name text NOT NULL,
        org_role text DEFAULT 'Staff' NOT NULL,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT rk_org_members_unique UNIQUE (org_id, email)
      );

      -- Backfill org members from existing team members & superadmins
      INSERT INTO public.rk_org_members (org_id, email, name, org_role)
      SELECT DISTINCT 
        '00000000-0000-0000-0000-000000000001'::uuid,
        lower(trim(email)),
        COALESCE(nullif(trim(name), ''), split_part(trim(email), '@', 1)),
        CASE WHEN role IN ('Admin', 'PM') THEN role ELSE 'Staff' END
      FROM public.rk_team
      ON CONFLICT (org_id, email) DO UPDATE 
      SET org_role = EXCLUDED.org_role WHERE public.rk_org_members.org_role = 'Staff';

      INSERT INTO public.rk_org_members (org_id, email, name, org_role)
      SELECT DISTINCT 
        '00000000-0000-0000-0000-000000000001'::uuid,
        lower(trim(email)),
        split_part(trim(email), '@', 1),
        'Admin'
      FROM public.rk_superadmins
      ON CONFLICT (org_id, email) DO UPDATE SET org_role = 'Admin';
    `);
    console.log("Organization and org members tables ready.");
  } catch (err) {
    console.error("Failed to create organization tables:", err.message);
  }

  // Migrate existing team roles from Member to Staff
  try {
    console.log("Migrating team roles from 'Member' to 'Staff'...");
    await client.query("UPDATE public.rk_team SET role = 'Staff' WHERE role = 'Member' OR role IS NULL OR role = '';");
    console.log("Team roles updated.");
  } catch (err) {
    console.error("Failed to migrate team roles:", err.message);
  }

  // Seed super admins
  try {
    console.log("Seeding super admins...");
    await client.query(`
      INSERT INTO public.rk_superadmins (email)
      VALUES ('admin@rukisha.co.rw'), ('cbienaime@rukisha.co.rw')
      ON CONFLICT (email) DO NOTHING;
    `);
    console.log("Super admins seeded successfully.");
  } catch (err) {
    console.error("Failed to seed super admins:", err.message);
  }

  // Auto-restore project data if database is empty
  try {
    const projCheck = await client.query("SELECT count(*) FROM public.rk_project;");
    const count = parseInt(projCheck.rows[0].count, 10);
    if (count === 0) {
      console.log("No projects found in database. Auto-restoring default project dataset...");
      const seedFile = path.join(__dirname, "seed_backup_data.json");
      if (fs.existsSync(seedFile)) {
        const seedData = JSON.parse(fs.readFileSync(seedFile, "utf8"));
        const order = [
          "rk_superadmins",
          "rk_project",
          "rk_sections",
          "rk_tasks",
          "rk_subtasks",
          "rk_task_dependencies",
          "rk_stakeholders",
          "rk_team",
        ];
        for (const table of order) {
          const rows = seedData[table] || [];
          if (rows.length === 0) continue;
          const keys = Object.keys(rows[0]);
          const cols = keys.map((k) => `"${k}"`).join(", ");
          for (const row of rows) {
            const vals = keys.map((k) => row[k]);
            const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
            const query = `INSERT INTO public."${table}" (${cols}) VALUES (${placeholders}) ON CONFLICT DO NOTHING;`;
            await client.query(query, vals);
          }
          console.log(`Auto-restored ${rows.length} records into ${table}.`);
        }
      }
    }
  } catch (seedErr) {
    console.error("Error auto-restoring project data:", seedErr.message);
  }


  await client.end();
  console.log("Migration script finished.");
}

run().catch((err) => {
  console.error("Migration failed:", err.message || err);
  process.exit(0);
});

