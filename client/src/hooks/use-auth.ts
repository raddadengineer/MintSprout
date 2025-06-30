import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authApi, type User } from "@/lib/auth";

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(authApi.isAuthenticated());
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery({
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
    },
    onError: (error) => {
      console.error("Login error:", error);
    },
  });

  const logout = () => {
    authApi.logout();
    setIsAuthenticated(false);
    queryClient.clear();
  };

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
