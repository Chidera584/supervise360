#!/usr/bin/env node
/**
 * One-shot: set admin login to ADMIN_EMAIL / ADMIN_PASSWORD (defaults below).
 * Migrates from ADMIN_OLD_EMAIL if present, otherwise updates the first admin role user.
 *
 * Usage (from repo root):
 *   node scripts/legacy/set-admin-credentials.cjs
 *
 * Optional env:
 *   ADMIN_OLD_EMAIL=sharonmesigo246@gmail.com
 *   ADMIN_EMAIL=admin@gmail.com
 *   ADMIN_PASSWORD=admin1234
 *
 * Loads .env from repo root (same as other legacy scripts).
 */
const fs = require('fs');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const path = require('path');

/** Minimal .env loader (no dotenv package required). */
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
const rootEnv = path.join(__dirname, '../../.env');
const backendEnv = path.join(__dirname, '../../backend/.env');
loadEnvFile(rootEnv);
loadEnvFile(backendEnv); // overrides root — backend often holds real DB_* vars

// Root .env may only have VITE_DB_* (frontend); map to DB_* if DB_* missing
if (!process.env.DB_HOST && process.env.VITE_DB_HOST) process.env.DB_HOST = process.env.VITE_DB_HOST;
if (!process.env.DB_USER && process.env.VITE_DB_USER) process.env.DB_USER = process.env.VITE_DB_USER;
if (process.env.DB_PASSWORD === undefined && process.env.VITE_DB_PASSWORD !== undefined) {
  process.env.DB_PASSWORD = process.env.VITE_DB_PASSWORD;
}
if (!process.env.DB_NAME && process.env.VITE_DB_NAME) process.env.DB_NAME = process.env.VITE_DB_NAME;
if (!process.env.DB_PORT && process.env.VITE_DB_PORT) process.env.DB_PORT = process.env.VITE_DB_PORT;

const OLD_EMAIL =
  process.env.ADMIN_OLD_EMAIL || 'sharonmesigo246@gmail.com';
const NEW_EMAIL = process.env.ADMIN_EMAIL || 'admin@gmail.com';
const NEW_PASSWORD = process.env.ADMIN_PASSWORD || 'admin1234';
const ROUNDS = 12;

async function main() {
  const dbConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'supervise360',
    port: parseInt(process.env.DB_PORT || '3306', 10),
  };

  const connection = await mysql.createConnection(dbConfig);
  try {
    const hash = await bcrypt.hash(String(NEW_PASSWORD), ROUNDS);

    const [newRows] = await connection.execute(
      'SELECT id, email, role FROM users WHERE email = ? LIMIT 1',
      [NEW_EMAIL]
    );

    if (newRows && newRows.length > 0) {
      const u = newRows[0];
      await connection.execute(
        `UPDATE users SET password_hash = ?, role = 'admin', is_active = TRUE, email_verified = TRUE WHERE id = ?`,
        [hash, u.id]
      );
      console.log(`Updated existing account ${NEW_EMAIL} (id ${u.id}) with new password and admin role.`);
      return;
    }

    const [oldRows] = await connection.execute(
      'SELECT id, email, role FROM users WHERE email = ? LIMIT 1',
      [OLD_EMAIL]
    );

    if (oldRows && oldRows.length > 0) {
      const u = oldRows[0];
      await connection.execute(
        `UPDATE users SET email = ?, password_hash = ?, role = 'admin', is_active = TRUE, email_verified = TRUE WHERE id = ?`,
        [NEW_EMAIL, hash, u.id]
      );
      console.log(`Migrated admin: ${u.email} -> ${NEW_EMAIL} (id ${u.id}). Password updated.`);
      return;
    }

    const [admins] = await connection.execute(
      `SELECT id, email FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1`
    );

    if (admins && admins.length > 0) {
      const u = admins[0];
      await connection.execute(
        `UPDATE users SET email = ?, password_hash = ?, is_active = TRUE, email_verified = TRUE WHERE id = ?`,
        [NEW_EMAIL, hash, u.id]
      );
      console.log(`Updated first admin user ${u.email} -> ${NEW_EMAIL} (id ${u.id}). Password updated.`);
      return;
    }

    await connection.execute(
      `INSERT INTO users (first_name, last_name, email, password_hash, role, department, is_active, email_verified)
       VALUES (?, ?, ?, ?, 'admin', ?, TRUE, TRUE)`,
      ['Admin', 'User', NEW_EMAIL, hash, 'Administration']
    );
    console.log(`Created admin user ${NEW_EMAIL}.`);
  } finally {
    await connection.end();
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
