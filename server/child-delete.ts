import { eq, inArray } from "drizzle-orm";
import { db, pool, supportsInteractiveTransactions } from "./db";
import * as schema from "@shared/schema";

async function deleteChildRowsPg(
  executor: { query: (text: string, params?: unknown[]) => Promise<{ rows: { id: number }[] }> },
  childId: number,
  userId: number,
): Promise<void> {
  const jobRes = await executor.query("SELECT id FROM jobs WHERE assigned_to_id = $1", [childId]);
  const jobIds = jobRes.rows.map((r) => r.id);

  await executor.query("DELETE FROM payments WHERE child_id = $1", [childId]);
  if (jobIds.length > 0) {
    await executor.query("DELETE FROM payments WHERE job_id = ANY($1::int[])", [jobIds]);
  }
  await executor.query("DELETE FROM jobs WHERE assigned_to_id = $1", [childId]);
  await executor.query("DELETE FROM allowances WHERE child_id = $1", [childId]);
  await executor.query("DELETE FROM allocation_settings WHERE child_id = $1", [childId]);
  await executor.query("DELETE FROM learning_progress WHERE child_id = $1", [childId]);
  await executor.query("DELETE FROM achievements WHERE child_id = $1", [childId]);
  await executor.query("DELETE FROM savings_goals WHERE child_id = $1", [childId]);
  await executor.query("DELETE FROM spending_log WHERE child_id = $1", [childId]);
  await executor.query("DELETE FROM donations WHERE child_id = $1", [childId]);
  await executor.query("DELETE FROM transactions WHERE child_id = $1", [childId]);
  await executor.query("DELETE FROM approval_requests WHERE child_id = $1", [childId]);
  await executor.query("DELETE FROM children WHERE id = $1", [childId]);
  await executor.query("DELETE FROM users WHERE id = $1", [userId]);
}

export async function deleteChildCascadeDrizzle(childId: number, userId: number): Promise<boolean> {
  const jobs = await db.select({ id: schema.jobs.id }).from(schema.jobs).where(eq(schema.jobs.assignedToId, childId));
  const jobIds = jobs.map((j) => j.id);

  await db.delete(schema.payments).where(eq(schema.payments.childId, childId));
  if (jobIds.length > 0) {
    await db.delete(schema.payments).where(inArray(schema.payments.jobId, jobIds));
  }
  await db.delete(schema.jobs).where(eq(schema.jobs.assignedToId, childId));
  await db.delete(schema.allowances).where(eq(schema.allowances.childId, childId));
  await db.delete(schema.allocationSettings).where(eq(schema.allocationSettings.childId, childId));
  await db.delete(schema.learningProgress).where(eq(schema.learningProgress.childId, childId));
  await db.delete(schema.achievements).where(eq(schema.achievements.childId, childId));
  await db.delete(schema.savingsGoals).where(eq(schema.savingsGoals.childId, childId));
  await db.delete(schema.spendingLog).where(eq(schema.spendingLog.childId, childId));
  await db.delete(schema.donations).where(eq(schema.donations.childId, childId));
  await db.delete(schema.transactions).where(eq(schema.transactions.childId, childId));
  await db.delete(schema.approvalRequests).where(eq(schema.approvalRequests.childId, childId));
  const removed = await db.delete(schema.children).where(eq(schema.children.id, childId)).returning();
  if (removed.length === 0) return false;
  await db.delete(schema.users).where(eq(schema.users.id, userId));
  return true;
}

export async function deleteChildWithUser(childId: number, userId: number): Promise<boolean> {
  if (pool) {
    if (supportsInteractiveTransactions) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await deleteChildRowsPg(client, childId, userId);
        await client.query("COMMIT");
        return true;
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    }
    await deleteChildRowsPg(pool, childId, userId);
    return true;
  }
  return deleteChildCascadeDrizzle(childId, userId);
}
