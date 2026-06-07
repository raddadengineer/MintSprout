import { cn } from "@/lib/utils";

type IconTextProps = {
  icon: string;
  label: string;
  sublabel?: string;
  layout?: "horizontal" | "vertical";
  size?: "sm" | "md" | "lg";
  className?: string;
  iconClassName?: string;
  labelClassName?: string;
};

const iconSizeClass = { sm: "text-xl", md: "text-2xl", lg: "text-3xl" };
const labelSizeClass = { sm: "text-sm", md: "text-base", lg: "text-lg" };

/** Icon + text pair for early readers (ages 5–6). */
export function IconText({
  icon,
  label,
  sublabel,
  layout = "horizontal",
  size = "md",
  className,
  iconClassName,
  labelClassName,
}: IconTextProps) {
  if (layout === "vertical") {
    return (
      <div className={cn("flex flex-col items-center text-center gap-1", className)}>
        <span className={cn(iconSizeClass[size], iconClassName)} aria-hidden>
          {icon}
        </span>
        <span className={cn("font-black text-gray-900 leading-tight", labelSizeClass[size], labelClassName)}>
          {label}
        </span>
        {sublabel && <span className="text-sm text-gray-500 font-medium leading-snug">{sublabel}</span>}
      </div>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className={cn(iconSizeClass[size], "shrink-0", iconClassName)} aria-hidden>
        {icon}
      </span>
      <span className={cn("font-bold leading-tight", labelSizeClass[size], labelClassName)}>{label}</span>
    </span>
  );
}
