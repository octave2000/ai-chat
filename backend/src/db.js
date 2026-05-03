import pg from "pg";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

export async function initDb() {
  await pool.query(`
    create table if not exists users (
      id serial primary key,
      username text not null unique,
      password text not null,
      created_at timestamptz not null default now()
    );
  `);

  await pool.query(`
    create table if not exists sessions (
      token text primary key,
      user_id integer not null references users(id) on delete cascade,
      expires_at timestamptz not null,
      created_at timestamptz not null default now()
    );
  `);

  await pool.query(`
    create table if not exists chat_messages (
      id bigserial primary key,
      user_id integer not null references users(id) on delete cascade,
      role text not null check (role in ('user', 'assistant')),
      content text not null,
      created_at timestamptz not null default now()
    );
  `);
}

export async function closeDb() {
  await pool.end();
}
