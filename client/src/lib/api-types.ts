import type {
  AccountTypes,
  AllocationSettings,
  Child,
  Job,
  Payment,
} from "@shared/schema";

export type AccountTypesRow = Pick<
  AccountTypes,
  "spendingEnabled" | "savingsEnabled" | "rothIraEnabled" | "brokerageEnabled"
>;

export type AllocationRow = {
  spendingPercentage: number;
  savingsPercentage: number;
  rothIraPercentage: number;
  brokeragePercentage: number;
};

export type PaymentRow = Payment;

export type ChildRow = Child;

export type JobRow = Job;

export type DashboardStats = {
  child?: Child & { userId?: number };
  allocation?: AllocationRow;
  activeJobs?: Job[];
  achievements?: unknown[];
};
