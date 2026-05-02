// ─── PostgreSQL Connection Pool ──────────────────────────────────────────────
// Singleton pool for all database queries. No ORM — raw pg with hand-written SQL.

import pg from 'pg';

// WHY: process.env instead of import.meta.env — DATABASE_URL must be read at
// runtime from the Lambda environment, not baked in at build time.
// WHY ssl: RDS requires encrypted connections (pg_hba.conf rejects plaintext).
// rejectUnauthorized:false trusts the Amazon-issued RDS certificate.
const isProduction = process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'prod';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ...(isProduction && { ssl: { rejectUnauthorized: false } }),
});

export { pool };
