import "dotenv/config";
import cors from "cors";
import express from "express";
import { pool, initDb, closeDb } from "./db.js";
import {
  createSession,
  createUser,
  deleteSession,
  findUserByCredentials,
  normalizeCredentials,
  requireAuth
} from "./auth.js";
import { getAssistantReply } from "./ai.js";

const app = express();
const port = Number(process.env.PORT || 3001);

app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173"
  })
);
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/auth/register", async (req, res) => {
  const credentials = normalizeCredentials(req.body);

  if (credentials.error) {
    return res.status(400).json({ error: credentials.error });
  }

  try {
    const user = await createUser(credentials.username, credentials.password);
    const session = await createSession(user.id);
    res.status(201).json({ user, token: session.token, expiresAt: session.expiresAt });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ error: "Username is already taken" });
    }

    console.error(error);
    res.status(500).json({ error: "Could not create user" });
  }
});

app.post("/auth/login", async (req, res) => {
  const credentials = normalizeCredentials(req.body);

  if (credentials.error) {
    return res.status(400).json({ error: credentials.error });
  }

  const user = await findUserByCredentials(credentials.username, credentials.password);

  if (!user) {
    return res.status(401).json({ error: "Invalid username or password" });
  }

  const session = await createSession(user.id);
  res.json({ user, token: session.token, expiresAt: session.expiresAt });
});

app.post("/auth/logout", requireAuth, async (req, res) => {
  await deleteSession(req.token);
  res.status(204).send();
});

app.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.get("/messages", requireAuth, async (req, res) => {
  const result = await pool.query(
    `
      select role, content, created_at as "createdAt"
      from chat_messages
      where user_id = $1
      order by id asc
      limit 100
    `,
    [req.user.id]
  );

  res.json({ messages: result.rows });
});

app.post("/chat", requireAuth, async (req, res) => {
  const content = String(req.body.message ?? "").trim();

  if (!content) {
    return res.status(400).json({ error: "Message is required" });
  }

  const history = await pool.query(
    `
      select role, content
      from chat_messages
      where user_id = $1
      order by id desc
      limit 20
    `,
    [req.user.id]
  );

  const messages = [...history.rows.reverse(), { role: "user", content }];

  try {
    await pool.query("insert into chat_messages (user_id, role, content) values ($1, $2, $3)", [
      req.user.id,
      "user",
      content
    ]);

    const reply = await getAssistantReply(messages);

    await pool.query("insert into chat_messages (user_id, role, content) values ($1, $2, $3)", [
      req.user.id,
      "assistant",
      reply
    ]);

    res.json({ reply });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "Could not get assistant reply" });
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: "Unexpected server error" });
});

await initDb();

const server = app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});

async function shutdown() {
  server.close(async () => {
    await closeDb();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
