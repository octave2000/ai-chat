import crypto from "node:crypto";
import { pool } from "./db.js";

const SESSION_DAYS = 7;

export async function createUser(username, password) {
  const result = await pool.query(
    "insert into users (username, password) values ($1, $2) returning id, username",
    [username, password]
  );

  return result.rows[0];
}

export async function findUserByCredentials(username, password) {
  const result = await pool.query(
    "select id, username from users where username = $1 and password = $2",
    [username, password]
  );

  return result.rows[0] ?? null;
}

export async function createSession(userId) {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await pool.query(
    "insert into sessions (token, user_id, expires_at) values ($1, $2, $3)",
    [token, userId, expiresAt]
  );

  return { token, expiresAt };
}

export async function deleteSession(token) {
  await pool.query("delete from sessions where token = $1", [token]);
}

export async function requireAuth(req, res, next) {
  const header = req.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";

  if (!token) {
    return res.status(401).json({ error: "Missing bearer token" });
  }

  const result = await pool.query(
    `
      select users.id, users.username
      from sessions
      join users on users.id = sessions.user_id
      where sessions.token = $1 and sessions.expires_at > now()
    `,
    [token]
  );

  const user = result.rows[0];

  if (!user) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }

  req.user = user;
  req.token = token;
  next();
}

export function normalizeCredentials(body) {
  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");

  if (username.length < 3) {
    return { error: "Username must be at least 3 characters" };
  }

  if (password.length < 3) {
    return { error: "Password must be at least 3 characters" };
  }

  return { username, password };
}
