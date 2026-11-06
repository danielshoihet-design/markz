/**
 * Prints instructions / optionally opens the migration path.
 * Schema must be run in the Supabase SQL Editor for project esqeimakebwtjaztbsuz
 * (this CLI token may not have access to that project).
 */
import { readFileSync } from "fs";
import { resolve } from "path";

const sqlPath = resolve(process.cwd(), "supabase/migrations/001_schema.sql");
const sql = readFileSync(sqlPath, "utf8");
console.log("Migration file:", sqlPath);
console.log("Bytes:", sql.length);
console.log(`
Apply steps:
1. Open https://supabase.com/dashboard/project/esqeimakebwtjaztbsuz/sql/new
2. Paste contents of supabase/migrations/001_schema.sql
3. Run the query
4. Put anon + service_role keys into .env.local
5. node scripts/bootstrap-manager.mjs you@email.com 'password' 'Your Name'
`);
