import type { AccountTypesRow, AllocationRow } from "@/lib/api-types";

export type PaymentAllocationAmounts = {
  spendingAmount: number;
  savingsAmount: number;
  rothIraAmount: number;
  brokerageAmount: number;
};

function amountFromPercentage(percentage: number | null | undefined, jobAmount: number): number {
  return parseFloat((((percentage ?? 0) / 100) * jobAmount).toFixed(2));
}

export function buildAllocationAmounts(
  jobAmount: number,
  allocation: AllocationRow,
  accountTypes: AccountTypesRow | undefined,
): PaymentAllocationAmounts {
  return {
    spendingAmount: accountTypes?.spendingEnabled
      ? amountFromPercentage(allocation.spendingPercentage, jobAmount)
      : 0,
    savingsAmount: accountTypes?.savingsEnabled
      ? amountFromPercentage(allocation.savingsPercentage, jobAmount)
      : 0,
    rothIraAmount: accountTypes?.rothIraEnabled
      ? amountFromPercentage(allocation.rothIraPercentage, jobAmount)
      : 0,
    brokerageAmount: accountTypes?.brokerageEnabled
      ? amountFromPercentage(allocation.brokeragePercentage, jobAmount)
      : 0,
  };
}

export function sumEnabledAllocation(
  alloc: PaymentAllocationAmounts,
  accountTypes: AccountTypesRow | undefined,
): number {
  let total = 0;
  if (accountTypes?.spendingEnabled) total += alloc.spendingAmount;
  if (accountTypes?.savingsEnabled) total += alloc.savingsAmount;
  if (accountTypes?.rothIraEnabled) total += alloc.rothIraAmount;
  if (accountTypes?.brokerageEnabled) total += alloc.brokerageAmount;
  return total;
}

export function normalizeAllocation(
  alloc: PaymentAllocationAmounts,
  accountTypes: AccountTypesRow | undefined,
): PaymentAllocationAmounts {
  return {
    spendingAmount: accountTypes?.spendingEnabled ? alloc.spendingAmount : 0,
    savingsAmount: accountTypes?.savingsEnabled ? alloc.savingsAmount : 0,
    rothIraAmount: accountTypes?.rothIraEnabled ? alloc.rothIraAmount : 0,
    brokerageAmount: accountTypes?.brokerageEnabled ? alloc.brokerageAmount : 0,
  };
}
