/**
 * An in-memory Postgres (PGlite) with every migration in supabase/migrations
 * applied, plus small stand-ins for what Supabase provides: the anon,
 * authenticated and service roles, auth.users, auth.uid() and auth.jwt().
 * Queries can run as a signed-in user, with row-level security on.
 *
 * By default the database behaves like a Supabase project with "automatically
 * expose new tables" turned off, so tests only pass if the migrations grant
 * every privilege the app needs. Options add other project settings.
 */
import fs from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

const MIGRATIONS = new URL('../../supabase/migrations/', import.meta.url)

const SUPABASE_STANDINS = `
  CREATE ROLE anon NOLOGIN;
  CREATE ROLE authenticated NOLOGIN;
  CREATE ROLE service_role NOLOGIN BYPASSRLS;
  CREATE ROLE supabase_auth_admin NOLOGIN;
  CREATE SCHEMA auth;
  CREATE TABLE auth.users (
    id uuid PRIMARY KEY,
    email text,
    is_anonymous boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
    AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE
    AS $$ SELECT nullif(current_setting('request.jwt.claims', true), '')::jsonb $$;
  GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
  GRANT EXECUTE ON FUNCTION auth.uid(), auth.jwt() TO anon, authenticated, service_role;
  CREATE SCHEMA extensions;
  CREATE SCHEMA cron;
  CREATE TABLE cron.job (jobid bigint, jobname text);
  CREATE FUNCTION cron.alter_job(job_id bigint, schedule text) RETURNS void LANGUAGE sql AS $$ SELECT $$;
  GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
`

/** Supabase's "automatically expose new tables" project setting. */
const EXPOSE_NEW_TABLES = `
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
`

/**
 * Supabase's "automatic RLS" project setting adds this SECURITY DEFINER
 * function, run by an event trigger, before any migration. The tests only
 * need the function.
 */
const AUTOMATIC_RLS = `
  CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger LANGUAGE plpgsql
    SECURITY DEFINER SET search_path = pg_catalog AS $$ BEGIN END $$;
`

export interface TestDatabase {
  db: PGlite
  /**
   * Run a query as a signed-in user (role authenticated, auth.uid() = uid).
   * Their token says whether they're anonymous, as auth.users does.
   */
  asUser<T = Record<string, unknown>>(uid: string, sql: string, params?: unknown[]): Promise<{ rows: T[]; affectedRows?: number }>
  /** Run a query as the database owner, like the service role or the SQL editor. */
  asAdmin<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[]; affectedRows?: number }>
  /**
   * Create an auth user; the sign-up trigger runs as it does in Supabase.
   * `anonymous` is an anonymous sign-in (a demo), which has no email.
   */
  addUser(id: string, email?: string | null, options?: { anonymous?: boolean; createdAt?: string }): Promise<void>
}

export async function createTestDatabase(
  options: { exposeNewTables?: boolean; automaticRls?: boolean; usersBeforeMigrations?: string[] } = {}
): Promise<TestDatabase> {
  const db = new PGlite()
  await db.exec(SUPABASE_STANDINS)
  if (options.exposeNewTables) await db.exec(EXPOSE_NEW_TABLES)
  if (options.automaticRls) await db.exec(AUTOMATIC_RLS)
  // Accounts that exist before any migration runs, e.g. a login added in the dashboard of a new project.
  for (const id of options.usersBeforeMigrations ?? []) {
    await db.query('INSERT INTO auth.users (id, email) VALUES ($1, $2)', [id, `${id.slice(0, 8)}@example.com`])
  }

  const files = fs.readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()
  for (const file of files) {
    // pg_cron, pg_net and pgcrypto aren't available here; gen_random_uuid() is built in.
    const sql = fs.readFileSync(new URL(file, MIGRATIONS), 'utf8').replace(/CREATE EXTENSION[^;]*;/gi, '')
    try {
      await db.exec(sql)
    } catch (e) {
      throw new Error(`${file}: ${(e as Error).message}`)
    }
  }

  const asUser = async <T>(uid: string, sql: string, params: unknown[] = []) => {
    const user = await db.query<{ is_anonymous: boolean }>('SELECT is_anonymous FROM auth.users WHERE id = $1', [uid])
    const claims = { sub: uid, role: 'authenticated', is_anonymous: user.rows[0]?.is_anonymous ?? false }
    await db.query(`SELECT set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claims', $2, false)`, [
      uid,
      JSON.stringify(claims),
    ])
    await db.exec('SET ROLE authenticated')
    try {
      return await db.query<T>(sql, params)
    } finally {
      // Back to no signed-in user, like the service role.
      await db.exec(
        `RESET ROLE; SELECT set_config('request.jwt.claim.sub', '', false), set_config('request.jwt.claims', '', false);`
      )
    }
  }

  const asAdmin = <T>(sql: string, params: unknown[] = []) => db.query<T>(sql, params)

  const addUser = async (
    id: string,
    email: string | null = `${id.slice(0, 8)}@example.com`,
    { anonymous = false, createdAt }: { anonymous?: boolean; createdAt?: string } = {}
  ) => {
    await db.query('INSERT INTO auth.users (id, email, is_anonymous, created_at) VALUES ($1, $2, $3, coalesce($4, now()))', [
      id,
      anonymous ? null : email,
      anonymous,
      createdAt ?? null,
    ])
  }

  return { db, asUser, asAdmin, addUser }
}
