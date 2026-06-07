import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { MemStorage } from "./storage";

vi.mock("./db", () => ({
  supportsInteractiveTransactions: false,
  useNeonHttpDriver: false,
  pool: null,
  db: {},
}));

describe("auth credentials", () => {
  let storage: MemStorage;

  beforeEach(async () => {
    storage = new MemStorage();
    await storage.ready;
  });

  it("accepts password123 for seeded parent", async () => {
    const user = await storage.getUserByUsername("parent");
    expect(user).toBeDefined();
    const ok = await bcrypt.compare("password123", user!.password);
    expect(ok).toBe(true);
  });

  it("issues a JWT with family and role claims", async () => {
    const user = await storage.getUserByUsername("parent");
    const token = jwt.sign(
      { id: user!.id, username: user!.username, role: user!.role, familyId: user!.familyId },
      process.env.JWT_SECRET!,
      { expiresIn: "7d" },
    );
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { role: string; familyId: number };
    expect(decoded.role).toBe("parent");
    expect(decoded.familyId).toBe(user!.familyId);
  });
});
