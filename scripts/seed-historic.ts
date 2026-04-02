/**
 * Seed Historic Badges
 *
 * Reads the seed.sql file and executes it against the Supabase database
 * to populate historic event badges (e.g., legendary concerts, milestone shows).
 *
 * Usage:
 *   npx tsx scripts/seed-historic.ts
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main(): Promise<void> {
  console.log("=== Seed Historic Badges ===");
  console.log("");

  const seedPath = resolve(__dirname, "..", "supabase", "seed.sql");

  let sql: string;
  try {
    sql = readFileSync(seedPath, "utf-8");
  } catch {
    console.error(`Could not read seed file at: ${seedPath}`);
    process.exit(1);
  }

  console.log(`Read seed file: ${seedPath}`);
  console.log(`SQL length: ${sql.length} characters`);
  console.log("");

  // Split the SQL into individual statements and execute them
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  console.log(`Found ${statements.length} SQL statements.`);
  console.log("");

  let success = 0;
  let failed = 0;

  for (const statement of statements) {
    const { error } = await supabase.rpc("exec_sql", {
      query: statement + ";",
    });

    if (error) {
      console.error(`Failed: ${statement.substring(0, 80)}...`);
      console.error(`  Error: ${error.message}`);
      failed++;
    } else {
      success++;
    }
  }

  console.log("");
  console.log(`Results: ${success} succeeded, ${failed} failed`);
  console.log("=== Seeding complete ===");

  if (failed > 0) {
    process.exit(1);
  }
}

main();
