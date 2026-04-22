import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { pool } from "./client.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationFilePath = path.join(__dirname, "migrations", "001_initial.sql");

export async function runMigrations(): Promise<void> {
  const sql = await readFile(migrationFilePath, "utf8");

  try {
    await pool.query(sql);
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
