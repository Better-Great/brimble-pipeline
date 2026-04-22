import { Pool, type QueryResult, type QueryResultRow } from "pg";

const connectionString = process.env.POSTGRES_URL;

if (!connectionString) {
  throw new Error("POSTGRES_URL is required to initialize the database pool.");
}

export const pool = new Pool({
  connectionString,
});

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  try {
    return await pool.query<T>(text, params);
  } catch (error) {
    console.error("Database query failed:", {
      text,
      params,
      error,
    });
    throw error;
  }
}

export async function updateDeployment(
  id: string,
  fields: Partial<{
    name: string;
    status: string;
    source_type: "git" | "upload" | null;
    source_url: string | null;
    image_tag: string | null;
    container_id: string | null;
    container_port: number | null;
    url: string | null;
    error_message: string | null;
  }>,
): Promise<void> {
  const keys = Object.keys(fields) as Array<keyof typeof fields>;
  if (keys.length === 0) {
    return;
  }

  const sets = keys.map((key, index) => `${key} = $${index + 1}`);
  const values = keys.map((key) => fields[key]);
  sets.push(`updated_at = NOW()`);

  await query(
    `UPDATE deployments
     SET ${sets.join(", ")}
     WHERE id = $${keys.length + 1}`,
    [...values, id],
  );
}
