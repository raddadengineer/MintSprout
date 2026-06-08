import bcrypt from "bcrypt";
import type { Child } from "@shared/schema";
import type { MemStorage } from "./storage";

/** Creates a child + login user for unit tests (MemStorage no longer seeds default children). */
export async function seedTestChild(
  storage: MemStorage,
  familyId = 1,
  name = "Test",
  age = 10,
): Promise<Child> {
  const hashedPassword = await bcrypt.hash("password123", 10);
  const user = await storage.createUser({
    username: name.toLowerCase(),
    password: hashedPassword,
    role: "child",
    familyId,
    name,
    age,
  });
  const child = await storage.createChild({
    userId: user.id,
    familyId,
    name,
    age,
  });
  await storage.createAllocationSettings({
    childId: child.id,
    spendingPercentage: 25,
    savingsPercentage: 35,
    rothIraPercentage: 20,
    brokeragePercentage: 20,
  });
  return child;
}
