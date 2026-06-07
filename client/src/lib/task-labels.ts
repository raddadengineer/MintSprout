import type { KidMode } from "@/hooks/use-kid-mode";

export type TaskLabels = {
  nav: string;
  pageTitle: string;
  pageTitleParent: string;
  create: string;
  createFirst: string;
  active: string;
  activeSection: string;
  history: string;
  awaitingApproval: string;
  needsAttention: string;
  viewAll: string;
  noActive: string;
  approve: string;
  approveAllowance: string;
  approvePay: string;
  start: string;
  markComplete: string;
  management: string;
  singular: string;
  plural: string;
};

export function taskLabels(role: "parent" | "child", kidMode: KidMode = "older"): TaskLabels {
  if (role === "parent") {
    return {
      nav: "Tasks",
      pageTitle: "My Tasks",
      pageTitleParent: "Task Management & Payments",
      create: "Create task",
      createFirst: "Create your first task",
      active: "Active tasks",
      activeSection: "Active Tasks",
      history: "Task history",
      awaitingApproval: "Awaiting approval",
      needsAttention: "Needs your attention",
      viewAll: "View all tasks",
      noActive: "No active tasks right now!",
      approve: "Approve",
      approveAllowance: "Approve (Allowance)",
      approvePay: "Approve & Pay",
      start: "Start task",
      markComplete: "Mark complete",
      management: "Task management",
      singular: "task",
      plural: "tasks",
    };
  }

  if (kidMode === "youngest") {
    return {
      nav: "Things to do",
      pageTitle: "Things to do",
      pageTitleParent: "Things to do",
      create: "New thing to do",
      createFirst: "Add something to do",
      active: "My things to do",
      activeSection: "My Things to Do",
      history: "Done before",
      awaitingApproval: "Waiting for a grown-up",
      needsAttention: "Waiting for you",
      viewAll: "See all",
      noActive: "Nothing to do right now!",
      approve: "OK!",
      approveAllowance: "OK!",
      approvePay: "OK!",
      start: "Start",
      markComplete: "Done!",
      management: "Things to do",
      singular: "thing to do",
      plural: "things to do",
    };
  }

  if (kidMode === "younger") {
    return {
      nav: "My tasks",
      pageTitle: "My tasks",
      pageTitleParent: "My tasks",
      create: "Create task",
      createFirst: "Create your first task",
      active: "My tasks",
      activeSection: "My Tasks",
      history: "Task history",
      awaitingApproval: "Awaiting approval",
      needsAttention: "Needs attention",
      viewAll: "View all",
      noActive: "No tasks right now!",
      approve: "Approve",
      approveAllowance: "Approve",
      approvePay: "Approve & Pay",
      start: "Start task",
      markComplete: "Mark complete",
      management: "My tasks",
      singular: "task",
      plural: "tasks",
    };
  }

  return {
    nav: "Tasks",
    pageTitle: "My Tasks",
    pageTitleParent: "My Tasks",
    create: "Create task",
    createFirst: "Create your first task",
    active: "Active tasks",
    activeSection: "Active Tasks",
    history: "Task history",
    awaitingApproval: "Awaiting approval",
    needsAttention: "Needs your attention",
    viewAll: "View all tasks",
    noActive: "No active tasks right now!",
    approve: "Approve",
    approveAllowance: "Approve (Allowance)",
    approvePay: "Approve & Pay",
    start: "Start task",
    markComplete: "Mark complete",
    management: "My tasks",
    singular: "task",
    plural: "tasks",
  };
}
