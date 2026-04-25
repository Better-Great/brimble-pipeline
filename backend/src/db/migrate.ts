import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { pool } from "./client.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = process.env.MIGRATIONS_DIR || path.join(__dirname, "migrations");

async function readMigrationFiles(dir: string): Promise<Array<{ name: string; sql: string }>> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  if (files.length === 0) {
    throw new Error(`No SQL migration files found in ${dir}`);
  }

  const migrations: Array<{ name: string; sql: string }> = [];
  for (const file of files) {
    const sql = await readFile(path.join(dir, file), "utf8");
    migrations.push({ name: file, sql });
  }
  return migrations;
}

export async function runMigrations(): Promise<void> {
  const migrations = await readMigrationFiles(migrationsDir);
  try {
    for (const migration of migrations) {
      await pool.query(migration.sql);
      console.info(`Migration applied: ${migration.name}`);
    }
    console.info("Migrations completed successfully.");
  } catch (error) {
    console.error("Migration run failed:", error);
    throw error;
  }
}

const isEntrypoint = process.argv[1]
  ? path.resolve(process.argv[1]) === __filename
  : false;

if (isEntrypoint) {
  runMigrations()
    .then(async () => {
      await pool.end();
    })
    .catch(async (error) => {
      console.error(error);
      await pool.end();
      process.exitCode = 1;
    });
}
