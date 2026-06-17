import { describe, it, expect } from "vitest";
import {
  isValidCurrencyAmount,
  sanitizeCurrencyInput,
} from "../client/src/components/currency-input";

describe("sanitizeCurrencyInput", () => {
  it("strips currency symbols and normalizes decimals", () => {
    expect(sanitizeCurrencyInput("$5.00")).toBe("5.00");
    expect(sanitizeCurrencyInput("1.2.3")).toBe("1.23");
    expect(sanitizeCurrencyInput("12")).toBe("12");
    expect(sanitizeCurrencyInput(".")).toBe(".");
  });
});

describe("isValidCurrencyAmount", () => {
  it("accepts positive finite decimals", () => {
    expect(isValidCurrencyAmount("5")).toBe(true);
    expect(isValidCurrencyAmount("5.50")).toBe(true);
  });

  it("rejects invalid values", () => {
    expect(isValidCurrencyAmount("")).toBe(false);
    expect(isValidCurrencyAmount(".")).toBe(false);
    expect(isValidCurrencyAmount("0")).toBe(false);
    expect(isValidCurrencyAmount("abc")).toBe(false);
  });
});
