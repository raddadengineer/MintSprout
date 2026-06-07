/** 0 = Sunday … 6 = Saturday (JavaScript Date.getDay()). */

export const DAY_OF_WEEK_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const DAY_OF_WEEK_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export type AllowanceWeekConfig = {
  cadence: string;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  periodStartDayOfWeek?: number | null;
  periodEndDayOfWeek?: number | null;
};

export function dayOfWeekLabel(dow: number, short = false): string {
  const labels = short ? DAY_OF_WEEK_SHORT : DAY_OF_WEEK_LABELS;
  return labels[dow] ?? `Day ${dow}`;
}

export function normalizeDayOfWeek(dow: number | null | undefined, fallback: number): number {
  if (typeof dow === "number" && dow >= 0 && dow <= 6) return dow;
  return fallback;
}

/** Period start day for weekly allowances (default Monday). */
export function periodStartDayOfWeek(allowance: AllowanceWeekConfig): number {
  return normalizeDayOfWeek(allowance.periodStartDayOfWeek, 1);
}

/** Period end day for weekly allowances (default Sunday). */
export function periodEndDayOfWeek(allowance: AllowanceWeekConfig): number {
  if (typeof allowance.periodEndDayOfWeek === "number" && allowance.periodEndDayOfWeek >= 0) {
    return allowance.periodEndDayOfWeek;
  }
  return (periodStartDayOfWeek(allowance) + 6) % 7;
}

/** Pay day for weekly allowances (defaults to period end day). */
export function payDayOfWeek(allowance: AllowanceWeekConfig): number {
  return normalizeDayOfWeek(allowance.dayOfWeek, periodEndDayOfWeek(allowance));
}

export type WeeklyAllowancePeriod = {
  periodStart: Date;
  periodEnd: Date;
  periodKey: string;
  payDayOfWeek: number;
  periodStartDayOfWeek: number;
  periodEndDayOfWeek: number;
  todayDayOfWeek: number;
};

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/** Calendar week bounds for a weekly allowance containing `now` (local time). */
export function weeklyAllowancePeriod(
  allowance: AllowanceWeekConfig,
  now: Date = new Date(),
): WeeklyAllowancePeriod {
  const startDow = periodStartDayOfWeek(allowance);
  const endDow = periodEndDayOfWeek(allowance);
  const payDow = payDayOfWeek(allowance);

  const today = startOfLocalDay(now);
  const currentDow = today.getDay();

  const periodStart = new Date(today);
  const daysSinceStart = (currentDow - startDow + 7) % 7;
  periodStart.setDate(periodStart.getDate() - daysSinceStart);

  const periodEnd = new Date(periodStart);
  const spanDays = (endDow - startDow + 7) % 7;
  periodEnd.setDate(periodEnd.getDate() + spanDays);

  const periodKey = `week-${periodStart.getFullYear()}-${String(periodStart.getMonth() + 1).padStart(2, "0")}-${String(periodStart.getDate()).padStart(2, "0")}`;

  return {
    periodStart,
    periodEnd: endOfLocalDay(periodEnd),
    periodKey,
    payDayOfWeek: payDow,
    periodStartDayOfWeek: startDow,
    periodEndDayOfWeek: endDow,
    todayDayOfWeek: currentDow,
  };
}

/** Next pay date on or after `now` (local midnight). */
export function nextWeeklyPayDate(allowance: AllowanceWeekConfig, now: Date = new Date()): Date {
  const payDow = payDayOfWeek(allowance);
  const next = startOfLocalDay(now);
  let daysUntil = (payDow - next.getDay() + 7) % 7;
  if (daysUntil === 0) {
    // If already paid today this period, caller should bump to next week
    daysUntil = 0;
  }
  next.setDate(next.getDate() + daysUntil);
  return next;
}

export function isWeeklyPayDay(allowance: AllowanceWeekConfig, now: Date = new Date()): boolean {
  return now.getDay() === payDayOfWeek(allowance);
}

export function formatPeriodRange(periodStart: Date, periodEnd: Date): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const startStr = periodStart.toLocaleDateString(undefined, opts);
  const endStr = periodEnd.toLocaleDateString(undefined, { ...opts, year: "numeric" });
  return `${startStr} – ${endStr}`;
}
