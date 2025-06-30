import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authApi, type User } from "@/lib/auth";

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => authApi.isAuthenticated());
  const queryClient = useQueryClient();

  const { data: user, isLoading, error } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: authApi.getCurrentUser,
    enabled: isAuthenticated,
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: ({ username, password }: { username: string; password: string }) =>
      authApi.login(username, password),
    onSuccess: (data) => {
      console.log("Login successful, setting token:", data);
      authApi.setToken(data.token);
      setIsAuthenticated(true);
      queryClient.setQueryData(["/api/auth/me"], data.user);
      queryClient.invalidateQueries();
    },
    onError: (error) => {
      console.error("Login error:", error);
    },
  });

  const logout = useCallback(() => {
    console.log("Logging out user");
    authApi.logout();
    setIsAuthenticated(false);
    queryClient.clear();
    queryClient.removeQueries();
    window.location.pathname = "/";
  }, [queryClient]);

  // Handle auth errors
  useEffect(() => {
    if (error && isAuthenticated) {
      console.log("Auth check failed, logging out");
      logout();
    }
  }, [error, isAuthenticated, logout]);

  // Sync authentication state with token changes
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "auth_token") {
        const hasToken = authApi.isAuthenticated();
        if (hasToken !== isAuthenticated) {
          setIsAuthenticated(hasToken);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [isAuthenticated]);

  return {
    user,
    isAuthenticated,
    isLoading,
    login: loginMutation.mutate,
    logout,
    isLoginPending: loginMutation.isPending,
    loginError: loginMutation.error,
  };
}