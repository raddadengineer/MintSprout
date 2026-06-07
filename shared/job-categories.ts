export type JobCategoryPaymentMode = "none" | "allowance" | "standalone";

export type JobCategoryPreset = {
  title: string;
  description: string;
  icon: string;
  recurrence: "once" | "daily" | "weekly" | "monthly";
};

export type DefaultJobCategorySeed = {
  slug: string;
  label: string;
  description: string;
  icon: string;
  paymentMode: JobCategoryPaymentMode;
  sortOrder: number;
  presets: JobCategoryPreset[];
};

/** Re-export job library presets keyed by slug (catalog source of truth). */
export { JOB_LIBRARY_BY_SLUG as DEFAULT_PRESETS_BY_SLUG } from "./catalog/job-library";

export const PAYMENT_MODE_LABELS: Record<JobCategoryPaymentMode, string> = {
  none: "No pay",
  allowance: "Allowance",
  standalone: "One-time pay",
};

export const DEFAULT_JOB_CATEGORIES: DefaultJobCategorySeed[] = [
  {
    slug: "self_care",
    label: "Take Care of Yourself",
    description: "Everyday habits for yourself and your space — part of being in the family.",
    icon: "bed",
    paymentMode: "none",
    sortOrder: 0,
    presets: [
      { title: "Make my bed", description: "Straighten sheets and pillows every morning.", icon: "bed", recurrence: "daily" },
      { title: "Clean my room", description: "Pick up toys, books, and clothes so the room stays tidy.", icon: "sparkles", recurrence: "weekly" },
      { title: "Pick up toys", description: "Put toys away when you are done playing.", icon: "home", recurrence: "daily" },
      { title: "Brush my teeth", description: "Brush morning and night.", icon: "sparkles", recurrence: "daily" },
      { title: "Pick up after myself", description: "Put things back where they belong after using them.", icon: "home", recurrence: "daily" },
    ],
  },
  {
    slug: "allowance",
    label: "Earn Your Allowance",
    description: "Extra chores that help the household and count toward allowance.",
    icon: "dollarSign",
    paymentMode: "allowance",
    sortOrder: 1,
    presets: [
      { title: "Take out the trash", description: "Empty trash bins and take bags to the curb or dumpster.", icon: "trash2", recurrence: "weekly" },
      { title: "Empty the dishwasher", description: "Unload clean dishes and put them away.", icon: "utensils", recurrence: "daily" },
      { title: "Clean the bathroom", description: "Wipe counters, sink, and tidy the bathroom.", icon: "sparkles", recurrence: "weekly" },
      { title: "Vacuum the floor", description: "Vacuum shared living spaces.", icon: "wind", recurrence: "weekly" },
    ],
  },
  {
    slug: "mind_body",
    label: "Grow Your Mind and Body",
    description: "Learning, reading, and skills that make you stronger and smarter.",
    icon: "bookOpen",
    paymentMode: "none",
    sortOrder: 2,
    presets: [
      { title: "Read for 15 minutes", description: "Read a book or story for at least 15 minutes.", icon: "bookOpen", recurrence: "daily" },
      { title: "Book report", description: "Tell someone about what you read today.", icon: "bookOpen", recurrence: "weekly" },
      { title: "Practice worksheets", description: "Complete a learning worksheet.", icon: "calculator", recurrence: "weekly" },
      { title: "Learn a new skill", description: "Practice something new for 20 minutes.", icon: "target", recurrence: "weekly" },
    ],
  },
  {
    slug: "help_others",
    label: "Help Others",
    description: "Kind acts that help family, friends, or neighbors.",
    icon: "gift",
    paymentMode: "none",
    sortOrder: 3,
    presets: [
      { title: "Help a sibling", description: "Help your brother or sister with something they need.", icon: "gift", recurrence: "once" },
      { title: "Write a thank-you note", description: "Make a card or note to thank someone.", icon: "gift", recurrence: "once" },
      { title: "Neighborhood kindness", description: "Do something kind for a neighbor.", icon: "sprout", recurrence: "once" },
    ],
  },
  {
    slug: "bonus_tasks",
    label: "Extra Earning",
    description: "One-time paid tasks — great for extra jobs, bonuses, or special projects.",
    icon: "dollarSign",
    paymentMode: "standalone",
    sortOrder: 4,
    presets: [
      { title: "Wash the car", description: "Wash and dry the family car.", icon: "sparkles", recurrence: "once" },
      { title: "Extra yard work", description: "Rake leaves, weed, or help in the yard.", icon: "sprout", recurrence: "once" },
      { title: "Organize the garage", description: "Help sort and tidy the garage or storage area.", icon: "home", recurrence: "once" },
      { title: "Babysit younger sibling", description: "Watch a younger sibling for a set time.", icon: "gift", recurrence: "once" },
    ],
  },
];

/** Fallback category label when job has no category_id */
export function legacyCategoryLabel(job: {
  isFamilyDuty?: boolean | null;
  allowanceId?: number | null;
  amount?: string;
}): string {
  if (job.isFamilyDuty) return "Take Care of Yourself";
  if (job.allowanceId != null) return "Earn Your Allowance";
  if (parseFloat(job.amount || "0") > 0) return "Earn Your Allowance";
  return "Other";
}
