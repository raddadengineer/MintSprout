import { describe, it, expect } from "vitest";
import {
  weeklyAllowancePeriod,
  payDayOfWeek,
  periodStartDayOfWeek,
  periodEndDayOfWeek,
  isWeeklyPayDay,
} from "@shared/allowance-week";

describe("weekly allowance period", () => {
  const baseAllowance = {
    cadence: "weekly" as const,
    periodStartDayOfWeek: 1,
    periodEndDayOfWeek: 0,
    dayOfWeek: 0,
  };

  it("defaults to Mon–Sun with pay on Sunday", () => {
    expect(periodStartDayOfWeek(baseAllowance)).toBe(1);
    expect(periodEndDayOfWeek(baseAllowance)).toBe(0);
    expect(payDayOfWeek(baseAllowance)).toBe(0);
  });

  it("computes period containing a Wednesday", () => {
    // Wed Jun 3 2026
    const now = new Date(2026, 5, 3, 12, 0, 0);
    const period = weeklyAllowancePeriod(baseAllowance, now);
    expect(period.todayDayOfWeek).toBe(3);
    expect(period.periodStart.getDay()).toBe(1);
    expect(period.periodEnd.getDay()).toBe(0);
    expect(period.periodKey).toMatch(/^week-2026-/);
    expect(period.periodStart.getDate()).toBe(1);
    expect(period.periodEnd.getDate()).toBe(7);
  });

  it("detects pay day", () => {
    const sunday = new Date(2026, 5, 7, 10, 0, 0);
    const monday = new Date(2026, 5, 1, 10, 0, 0);
    expect(isWeeklyPayDay(baseAllowance, sunday)).toBe(true);
    expect(isWeeklyPayDay(baseAllowance, monday)).toBe(false);
  });

  it("supports custom Fri–Thu week with pay on Thursday", () => {
    const custom = {
      cadence: "weekly" as const,
      periodStartDayOfWeek: 5,
      periodEndDayOfWeek: 4,
      dayOfWeek: 4,
    };
    const thursday = new Date(2026, 5, 4, 9, 0, 0);
    const period = weeklyAllowancePeriod(custom, thursday);
    expect(period.periodStart.getDay()).toBe(5);
    expect(period.periodEnd.getDay()).toBe(4);
    expect(isWeeklyPayDay(custom, thursday)).toBe(true);
  });
});
