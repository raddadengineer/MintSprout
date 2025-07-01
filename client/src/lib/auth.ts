import { apiRequest } from "./queryClient";

export interface User {
  id: number;
  username: string;
  role: "parent" | "child";
  familyId: number;
  name: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export const authApi = {
  login: async (username: string, password: string): Promise<AuthResponse> => {
    try {
      const res = await apiRequest("POST", "/api/auth/login", { username, password });
      if (!res.ok) {
        const errorData = await res.text();
        throw new Error(`Login failed: ${errorData}`);
      }
      return res.json();
    } catch (error) {
      console.error("Login API error:", error);
      throw error;
    }
  },

  getCurrentUser: async (): Promise<User> => {
    const res = await apiRequest("GET", "/api/auth/me");
    return res.json();
  },

  logout: () => {
    localStorage.removeItem("auth_token");
  },

  getToken: (): string | null => {
    return localStorage.getItem("auth_token");
  },

  setToken: (token: string) => {
    localStorage.setItem("auth_token", token);
  },

  isAuthenticated: (): boolean => {
    return !!localStorage.getItem("auth_token");
  }
};
