import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authApi, type User } from "@/lib/auth";

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => authApi.isAuthenticated());
  const [forceRender, setForceRender] = useState(0);
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
      authApi.setToken(data.token);
      queryClient.setQueryData(["/api/auth/me"], data.user);
      
      // Force immediate state update and re-render
      setIsAuthenticated(true);
      setForceRender(prev => prev + 1);
      queryClient.invalidateQueries();
    },
    onError: (error) => {
      console.error("Login error:", error);
    },
  });

  const logout = useCallback(() => {
    authApi.logout();
    setIsAuthenticated(false);
    queryClient.clear();
    queryClient.removeQueries();
    window.location.pathname = "/";
  }, [queryClient]);

  // Handle auth errors
  useEffect(() => {
    if (error && isAuthenticated) {
      logout();
    }
  }, [error, isAuthenticated, logout]);

  // Sync authentication state with localStorage changes
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "auth_token") {
        const hasToken = authApi.isAuthenticated();
        setIsAuthenticated(hasToken);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

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