import type { Payment, Transaction } from "@shared/schema";
import type { IStorage } from "./storage";

export type PaymentHistoryRow = Payment & {
  source: "job" | "allowance";
  label?: string;
};

function groupKey(note: string | null, createdAt: Date | string | null): string {
  const stamp = createdAt ? new Date(createdAt).toISOString() : "unknown";
  return `${note ?? "allowance"}|${stamp}`;
}

export async function getPaymentHistory(
  storage: IStorage,
  familyId: number,
  childId?: number,
): Promise<PaymentHistoryRow[]> {
  const jobPayments: PaymentHistoryRow[] = childId
    ? (await storage.getPaymentsByChild(childId)).map((p) => ({ ...p, source: "job" as const }))
    : (await storage.getPaymentsByFamily(familyId)).map((p) => ({ ...p, source: "job" as const }));

  const children = await storage.getChildrenByFamily(familyId);
  const targetChildren = childId ? children.filter((c) => c.id === childId) : children;

  const allowanceRows: PaymentHistoryRow[] = [];
  let syntheticId = -1;

  for (const child of targetChildren) {
    const txs = await storage.getTransactions(child.id);
    const allowanceTxs = txs.filter((t) => t.type === "allowance");
    const groups = new Map<string, Transaction[]>();

    for (const tx of allowanceTxs) {
      const key = groupKey(tx.note, tx.createdAt);
      const list = groups.get(key) ?? [];
      list.push(tx);
      groups.set(key, list);
    }

    for (const group of Array.from(groups.values())) {
      const spending = group
        .filter((t) => t.toAccount === "spending")
        .reduce((sum, t) => sum + parseFloat(t.amount || "0"), 0);
      const savings = group
        .filter((t) => t.toAccount === "savings")
        .reduce((sum, t) => sum + parseFloat(t.amount || "0"), 0);
      const roth = group
        .filter((t) => t.toAccount === "rothIra")
        .reduce((sum, t) => sum + parseFloat(t.amount || "0"), 0);
      const brokerage = group
        .filter((t) => t.toAccount === "brokerage")
        .reduce((sum, t) => sum + parseFloat(t.amount || "0"), 0);
      const total = spending + savings + roth + brokerage;
      const first = group[0];

      allowanceRows.push({
        id: syntheticId--,
        jobId: 0,
        childId: child.id,
        amount: total.toFixed(2),
        spendingAmount: spending.toFixed(2),
        savingsAmount: savings.toFixed(2),
        rothIraAmount: roth.toFixed(2),
        brokerageAmount: brokerage.toFixed(2),
        createdAt: first.createdAt ?? new Date(),
        source: "allowance",
        label: first.note ?? "Allowance payout",
      });
    }
  }

  return [...jobPayments, ...allowanceRows].sort((a, b) => {
    const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bt - at;
  });
}
