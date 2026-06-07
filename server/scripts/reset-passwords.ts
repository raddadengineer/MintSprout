import bcrypt from "bcrypt";
import { inArray } from "drizzle-orm";
import { db } from "../db";
import * as schema from "../../shared/schema";

function parseArgs(argv: string[]) {
  const args = argv.slice(2);
  const out: { password?: string; users: string[] } = {
    users: ["parent", "bryson", "edison"],
  };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--users") {
      const value = args[i + 1];
      i++;
      if (value) out.users = value.split(",").map((s) => s.trim()).filter(Boolean);
      continue;
    }
    if (a === "--password") {
      out.password = args[i + 1];
      i++;
      continue;
    }
    // First positional arg = password
    if (!a.startsWith("--") && !out.password) {
      out.password = a;
    }
  }

  return out;
}

async function main() {
  const { password, users } = parseArgs(process.argv);
  const nextPassword = password ?? process.env.RESET_PASSWORD ?? "password123";

  const hash = await bcrypt.hash(nextPassword, 10);

  const updated = await db
    .update(schema.users)
    .set({ password: hash })
    .where(inArray(schema.users.username, users))
    .returning();

  console.log(
    `✅ Reset password for: ${updated.map((u) => u.username).join(", ") || "(none)"}`,
  );
  console.log(`🔐 New password: ${nextPassword}`);
}

main().catch((err) => {
  console.error("❌ Failed to reset passwords:", err);
  process.exit(1);
});

