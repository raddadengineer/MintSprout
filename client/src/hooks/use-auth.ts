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
    mutationFn: async ({ username, password }: { username: string; password: string }) => {
      try {
        return await authApi.login(username, password);
      } catch (error) {
        console.error("Login mutation error:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      try {
        authApi.setToken(data.token);
        queryClient.setQueryData(["/api/auth/me"], data.user);
        setIsAuthenticated(true);
        setForceRender(prev => prev + 1);
        
        // Use setTimeout to allow state updates to complete before redirect
        setTimeout(() => {
          window.location.href = "/dashboard";
        }, 100);
      } catch (error) {
        console.error("Login success handler error:", error);
      }
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