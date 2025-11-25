#!/usr/bin/env node
/**
 * Apply Supabase SQL migrations without the Supabase CLI.
 *
 * Usage:
 *   SUPABASE_DB_URL="postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres" npm run db:push
 *
 * Notes:
 * - Requires `pg` (install once: npm install pg).
 * - Runs all SQL files in supabase/migrations in order.
 * - Migration files use "create table if not exists" to stay idempotent.
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) {
    console.error('SUPABASE_DB_URL is required (postgres connection string).');
    process.exit(1);
  }

  const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    console.error('Migrations directory not found:', migrationsDir);
    process.exit(1);
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('No migration files found.');
    return;
  }

  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  try {
    for (const file of files) {
      const fullPath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(fullPath, 'utf-8');
      console.log(`Applying migration: ${file}`);
      await client.query(sql);
    }
    console.log('Migrations applied successfully.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
