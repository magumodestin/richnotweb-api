// Run once:  node create-table.js
// Creates the `users` table in the database defined in your .env
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
      ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined
    });

    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        name       VARCHAR(150) NOT NULL,
        email      VARCHAR(255) NOT NULL UNIQUE,
        password   VARCHAR(255) NOT NULL,
        role       VARCHAR(20) NOT NULL DEFAULT 'student',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const [rows] = await conn.query("SHOW TABLES");
    console.log("Done. Tables in", process.env.DB_NAME + ":", rows.map(r => Object.values(r)[0]));
    await conn.end();
  } catch (err) {
    console.error("Failed:", err.message);
    process.exit(1);
  }
})();
