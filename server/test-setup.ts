process.env.JWT_SECRET = process.env.JWT_SECRET ?? "vitest-jwt-secret";
process.env.NODE_ENV = "test";
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://mintsprout:mintsprout@127.0.0.1:5432/mintsprout";
