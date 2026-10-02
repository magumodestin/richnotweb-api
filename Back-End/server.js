require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();

app.use(express.json());
app.use(cors({
  origin: [
    "http://localhost",              // XAMPP (Apache)
    "http://localhost:5500",         // VS Code Live Server
    "http://127.0.0.1:5500",
    "https://richnotweb.vercel.app"  // deployed frontend
  ]
}));

// ---------- Database ----------
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  waitForConnections: true,
  connectionLimit: 5
});

// ---------- Helpers ----------
function makeToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

// Table columns: id, name, email, password, role, created_at
// The frontend expects UserID / FirstName / LastName / Email / Role,
// so we convert here. The password hash is never sent to the browser.
function publicUser(user) {
  const parts = String(user.name || "").trim().split(/\s+/);
  const firstName = parts.shift() || "";
  const lastName = parts.join(" ");
  return {
    UserID: user.id,
    FirstName: firstName,
    LastName: lastName,
    Email: user.email,
    Role: user.role
  };
}

const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

// ---------- Routes ----------
app.get("/api/ping", (req, res) => res.json({ ok: true }));

app.get("/api/dbcheck", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    const [t] = await pool.query("SHOW TABLES");
    res.json({
      ok: true,
      tables: t.map((r) => Object.values(r)[0]),
      jwtSecretSet: Boolean(process.env.JWT_SECRET)
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      code: err.code,
      message: err.message,
      jwtSecretSet: Boolean(process.env.JWT_SECRET)
    });
  }
});

// REGISTER
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: "Please enter a valid email" });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const cleanRole = role === "lecturer" ? "lecturer" : "student";
    const cleanEmail = email.trim().toLowerCase();

    // Email already used?
    const [existing] = await pool.query(
      "SELECT id FROM users WHERE email = ?", [cleanEmail]
    );
    if (existing.length > 0) {
      return res.status(409).json({ message: "This email is already registered" });
    }

    // Hash the password — never store it as plain text
    const passwordHash = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
      [name.trim(), cleanEmail, passwordHash, cleanRole]
    );

    const [rows] = await pool.query(
      "SELECT * FROM users WHERE id = ?", [result.insertId]
    );
    const user = rows[0];

    res.status(201).json({ user: publicUser(user), token: makeToken(user) });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ message: "Server error. Please try again." });
  }
});

// LOGIN
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const [rows] = await pool.query(
      "SELECT * FROM users WHERE email = ?", [email.trim().toLowerCase()]
    );
    const user = rows[0];

    // Same message for both cases so attackers can't tell which emails exist
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    res.json({ user: publicUser(user), token: makeToken(user) });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error. Please try again." });
  }
});

// ---------- Protected routes ----------
// Checks the token sent in the "Authorization: Bearer <token>" header
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Not logged in" });
  }
  try {
    req.auth = jwt.verify(token, process.env.JWT_SECRET); // { id, role }
    next();
  } catch (err) {
    return res.status(401).json({ message: "Session expired. Please log in again." });
  }
}

// Returns the logged-in user, read fresh from the database
app.get("/api/me", requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM users WHERE id = ?", [req.auth.id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ user: publicUser(rows[0]) });
  } catch (err) {
    console.error("Me error:", err);
    res.status(500).json({ message: "Server error. Please try again." });
  }
});

// ---------- Start ----------
// Run the server only when started with `node server.js` (local use).
// On Vercel the exported app is used instead.
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`RichNotes API running on http://localhost:${PORT}`));
}

module.exports = app;
