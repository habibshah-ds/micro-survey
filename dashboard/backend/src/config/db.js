import pg from "pg";
import { config } from "./index.js";

const { Pool } = pg;

const pool = new Pool({
  connectionString: config.database.url,
  max: config.database.poolMax,
  min: config.database.poolMin,
  idleTimeoutMillis: config.database.idleTimeout,
  connectionTimeoutMillis: config.database.connectionTimeout,
});

pool.on("error", (err) => {
  console.error("Unexpected database pool error:", err);
});

export async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    if (config.nodeEnv === "development") {
      console.log(`[DB] ${text.substring(0, 50)}... (${duration}ms, ${result.rowCount} rows)`);
    }
    
    return result;
  } catch (error) {
    console.error("[DB ERROR]", error.message);
    throw error;
  }
}

export async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function testConnection() {
  try {
    const result = await pool.query("SELECT NOW()");
    console.log("✅ Database connected:", result.rows[0].now);
    return true;
  } catch (error) {
    console.error("❌ Database connection failed:", error.message);
    throw error;
  }
}

export { pool };
export default { query, transaction, pool, testConnection };
