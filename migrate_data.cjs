const { Client } = require("pg");
require("dotenv").config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const dbUrl = process.env.DATABASE_URL;

async function fetchRemoteTable(table) {
  const url = `${supabaseUrl}/rest/v1/${table}?select=*`;
  const res = await fetch(url, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch table ${table}: ${res.statusText} - ${text}`);
  }
  return res.json();
}

async function run() {
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  console.log("Connected to local database.");

  // Truncate tables in reverse dependency order
  const tables = [
    "rk_task_dependencies",
    "rk_subtasks",
    "rk_tasks",
    "rk_sections",
    "rk_stakeholders",
    "rk_team",
    "rk_documents",
    "rk_document_content",
    "rk_project",
    "rk_superadmins",
  ];

  console.log("Truncating local tables...");
  for (const t of tables) {
    try {
      await client.query(`TRUNCATE TABLE public.${t} CASCADE;`);
    } catch (err) {
      console.warn(`Warning truncating ${t}:`, err.message);
    }
  }

  // Fetch and insert data in forward order
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
    console.log(`Migrating data for table ${table}...`);
    let rows;
    try {
      rows = await fetchRemoteTable(table);
    } catch (err) {
      console.error(`Error fetching remote table ${table}:`, err.message);
      continue;
    }
    
    console.log(`Found ${rows.length} rows on remote.`);
    if (rows.length === 0) continue;

    const keys = Object.keys(rows[0]);
    const cols = keys.map((k) => `"${k}"`).join(", ");
    
    for (const row of rows) {
      const vals = keys.map((k) => row[k]);
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
      const query = `INSERT INTO public.${table} (${cols}) VALUES (${placeholders});`;
      try {
        await client.query(query, vals);
      } catch (err) {
        console.error(`Error inserting row into ${table}:`, err.message, "\nQuery:", query, "\nValues:", vals);
      }
    }
    console.log(`Successfully migrated ${rows.length} rows into ${table}.`);
  }

  // Ensure default admin exists
  await client.query(`
    INSERT INTO public.rk_superadmins (email) 
    VALUES ('admin@rukisha.co.rw') 
    ON CONFLICT (email) DO NOTHING;
  `);

  await client.end();
  console.log("Migration complete!");
}

run().catch(console.error);
