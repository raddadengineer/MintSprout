import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageShellProps = {
  children: ReactNode;
  className?: string;
  /** max-w-6xl for controls-style pages */
  wide?: "default" | "narrow" | "wide";
};

const maxWidthClass = {
  default: "max-w-7xl",
  narrow: "max-w-4xl",
  wide: "max-w-6xl",
} as const;

/** Consistent page container with mobile/tablet padding and overflow safety. */
export function PageShell({ children, className, wide = "default" }: PageShellProps) {
  return (
    <main
      className={cn(
        "w-full min-w-0 mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8",
        maxWidthClass[wide],
        className,
      )}
    >
      {children}
    </main>
  );
}

type PageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

/** Stacks title and actions on phones; side-by-side from sm breakpoint up. */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-6 sm:mb-8 min-w-0",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1 sm:mb-2 break-words">
          {title}
        </h1>
        {description ? (
          <p className="text-gray-600 text-base sm:text-lg break-words">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2 shrink-0">{actions}</div> : null}
    </div>
  );
}
