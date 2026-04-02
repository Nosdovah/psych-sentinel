import { createClient } from "@libsql/client/web";

const url = import.meta.env.VITE_TURSO_URL;
const authToken = import.meta.env.VITE_TURSO_TOKEN;

export const db = createClient({
  url: url,
  authToken: authToken,
});

export async function initDb() {
  try {
    // Migration: Table refresh to include remediation_json for historical view
    // Agent B: Final Schema Migration
    await db.execute("DROP TABLE IF EXISTS psychology_logs");
    
    await db.execute(`
      CREATE TABLE IF NOT EXISTS psychology_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        thought_text TEXT NOT NULL,
        ttp_category TEXT,
        severity REAL,
        risk_score REAL DEFAULT 0,
        pressure_snapshot REAL DEFAULT 0,
        remediation_json TEXT, -- JSON string array of steps
        type TEXT DEFAULT 'threat',
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("Turso: psychology_logs table (v3) initialized with remediation storage.");
  } catch (error) {
    console.error("Turso: Initialization failed:", error);
  }
}

export async function saveLog(text, category, severity, riskScore = 0, pressure = 0, remediation = [], type = 'threat') {
  try {
    await db.execute({
      sql: "INSERT INTO psychology_logs (thought_text, ttp_category, severity, risk_score, pressure_snapshot, remediation_json, type) VALUES (?, ?, ?, ?, ?, ?, ?)",
      args: [text, category, severity, riskScore, pressure, JSON.stringify(remediation), type],
    });
  } catch (error) {
    console.error("Turso: Save failed:", error);
  }
}

export async function deleteLog(id) {
  try {
    await db.execute({
      sql: "DELETE FROM psychology_logs WHERE id = ?",
      args: [id],
    });
    console.log(`Turso: Log ${id} deleted.`);
  } catch (error) {
    console.error(`Turso: Delete log ${id} failed:`, error);
  }
}

export async function getHistoricalLogs() {
  try {
    const res = await db.execute("SELECT * FROM psychology_logs ORDER BY id DESC LIMIT 50");
    return res.rows;
  } catch (error) {
    console.error("Turso: Failed to fetch historical logs:", error);
    return [];
  }
}

export async function getHistoricalMetrics() {
  try {
    const successRes = await db.execute("SELECT COUNT(*) as count FROM psychology_logs WHERE type = 'success'");
    const threatRes = await db.execute("SELECT COUNT(*) as count FROM psychology_logs WHERE type = 'threat'");
    const pressureRes = await db.execute("SELECT pressure_snapshot FROM psychology_logs ORDER BY id DESC LIMIT 1");
    
    return {
      success: successRes.rows[0]?.count || 0,
      threats: threatRes.rows[0]?.count || 0,
      lastPressure: pressureRes.rows[0] ? Number(pressureRes.rows[0].pressure_snapshot) : 0
    };
  } catch (error) {
    console.warn("Turso: Fetch failed:", error);
    return { success: 0, threats: 0, lastPressure: 0 };
  }
}
