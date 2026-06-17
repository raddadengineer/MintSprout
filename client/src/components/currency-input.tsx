import { cn } from "@/lib/utils";

export type CurrencyInputProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  prefixClassName?: string;
};

/** Strip currency symbols and keep a single valid decimal string. */
export function sanitizeCurrencyInput(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts[0]}.${parts.slice(1).join("")}`;
}

export function CurrencyInput({
  id,
  value,
  onChange,
  placeholder = "0.00",
  required,
  disabled,
  className,
  inputClassName,
  prefixClassName,
}: CurrencyInputProps) {
  return (
    <div
      className={cn(
        "mint-input flex items-center gap-1 focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent",
        className,
      )}
    >
      <span
        className={cn("shrink-0 pl-1 text-gray-500 select-none", prefixClassName)}
        aria-hidden
      >
        $
      </span>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(sanitizeCurrencyInput(e.target.value))}
        className={cn(
          "min-w-0 flex-1 border-0 bg-transparent p-0 font-medium text-base outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          inputClassName,
        )}
      />
    </div>
  );
}
