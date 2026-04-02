import { createClient } from "@libsql/client/web";

const url = import.meta.env.VITE_TURSO_URL;
const authToken = import.meta.env.VITE_TURSO_TOKEN;

export const db = createClient({
  url: url,
  authToken: authToken,
});

export async function initDb() {
  try {
    // Agent B: Persistent Layer Implementation
    // We removed the DROP TABLE command to ensure historical logs survive between sessions.
    
    await db.execute(`
      CREATE TABLE IF NOT EXISTS psychology_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        thought_text TEXT NOT NULL,
        ttp_category TEXT,
        severity REAL,
        risk_score REAL DEFAULT 0,
        pressure_snapshot REAL DEFAULT 0,
        type TEXT DEFAULT 'threat',
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("Turso: psychology_logs table initialized & persistent.");
  } catch (error) {
    console.error("Turso: Initialization failed:", error);
  }
}

export async function saveLog(text, category, severity, riskScore = 0, pressure = 0, type = 'threat') {
  try {
    await db.execute({
      sql: "INSERT INTO psychology_logs (thought_text, ttp_category, severity, risk_score, pressure_snapshot, type) VALUES (?, ?, ?, ?, ?, ?)",
      args: [text, category, severity, riskScore, pressure, type],
    });
  } catch (error) {
    console.error("Turso: Save failed:", error);
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
      lastPressure: pressureRes.rows[0] ? pressureRes.rows[0].pressure_snapshot : 0
    };
  } catch (error) {
    console.warn("Turso: Fetch failed:", error);
    return { success: 0, threats: 0, lastPressure: 0 };
  }
}
