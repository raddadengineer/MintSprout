import type React from "react";
import { Redirect, Route } from "wouter";
import { useAuth } from "@/hooks/use-auth";

/** Redirect non-parent users away from parent-only pages. */
export function ParentRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;
  if (user?.role !== "parent") {
    return <Redirect to="/dashboard" />;
  }

  return <Component />;
}
