process.env.JWT_SECRET = process.env.JWT_SECRET ?? "vitest-jwt-secret";
process.env.NODE_ENV = "test";
// Satisfy db.ts imports; real connections are mocked per test file unless CI_POSTGRES is set.
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://mintsprout:mintsprout@127.0.0.1:5432/mintsprout";
}
