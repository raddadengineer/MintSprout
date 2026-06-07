import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

export type KidMode = "youngest" | "younger" | "older" | "unknown";

export function useKidMode() {
  const { user } = useAuth();
  const isChild = user?.role === "child";

  const { data, isLoading } = useQuery({
    queryKey: ["/api/dashboard-stats", "kid-mode"],
    enabled: isChild,
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch("/api/dashboard-stats", { headers, credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as { child?: { age?: number | null } };
    },
    staleTime: 30_000,
  });

  const age = data?.child?.age ?? null;
  const mode: KidMode =
    typeof age === "number" && Number.isFinite(age)
      ? age <= 6
        ? "youngest"
        : age <= 10
          ? "younger"
          : "older"
      : "unknown";

  return { isChild, age, mode, isLoading };
}

