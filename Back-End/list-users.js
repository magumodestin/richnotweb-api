require("dotenv").config();
const mysql = require("mysql2/promise");

(async () => {
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl:
        process.env.DB_SSL === "true"
          ? { rejectUnauthorized: false }
          : undefined,
    });

    const [rows] = await conn.query(
      "SELECT id, name, email, role, created_at FROM users ORDER BY id",
    );
    console.log("Total users:", rows.length);
    console.table(rows);
    await conn.end();
  } catch (err) {
    console.error("Failed:", err.message);
    process.exit(1);
  }
})();
