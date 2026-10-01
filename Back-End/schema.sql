-- Run in phpMyAdmin (SQL tab) with the `richnotes` database selected.
-- Matches the existing users table (id, name, email, password, role, created_at).
CREATE TABLE IF NOT EXISTS users (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(150) NOT NULL,
  email      VARCHAR(255) NOT NULL UNIQUE,
  password   VARCHAR(255) NOT NULL,
  role       VARCHAR(20) NOT NULL DEFAULT 'student',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
