/**
 * Minimal `pg` surface the integration harness needs.
 *
 * `pg` ships without TypeScript types and `@types/pg` is not a dependency of
 * this project, so the few members used here are declared locally instead of
 * pulling in another package (and because `noImplicitAny` would reject the
 * untyped import).
 */

export interface PgConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export interface PgQueryResult {
  rows: Array<Record<string, unknown>>;
  rowCount: number | null;
}

export interface PgClient {
  connect(): Promise<void>;
  query(sql: string, params?: unknown[]): Promise<PgQueryResult>;
  end(): Promise<void>;
}

interface PgClientConstructor {
  new (config: PgConfig & { connectionTimeoutMillis?: number }): PgClient;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports -- pg ships no types (see header)
const { Client } = require('pg') as { Client: PgClientConstructor };

export function createPgClient(config: PgConfig & { connectionTimeoutMillis?: number }): PgClient {
  return new Client(config);
}
