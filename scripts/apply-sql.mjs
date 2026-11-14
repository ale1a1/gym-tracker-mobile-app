// Applies a SQL file to the Supabase database.
// Usage: node scripts/apply-sql.mjs supabase/migrations/001_init.sql
// Reads SUPABASE_DB_URL from .env.local (never commit that file).
import fs from "node:fs"
import pg from "pg"

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
    .map((line) => [line.slice(0, line.indexOf("=")).trim(), line.slice(line.indexOf("=") + 1).trim()]),
)

const file = process.argv[2]
if (!file) throw new Error("Pass the SQL file to apply")
if (!env.SUPABASE_DB_URL) throw new Error("SUPABASE_DB_URL is missing from .env.local")

const client = new pg.Client({ connectionString: env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } })
await client.connect()
try {
  await client.query(fs.readFileSync(file, "utf8"))
  const { rows } = await client.query(
    "select table_name from information_schema.tables where table_schema = 'public' order by table_name",
  )
  console.log("Applied", file, "- public tables:", rows.map((r) => r.table_name).join(", "))
} finally {
  await client.end()
}
