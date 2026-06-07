import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { login, isLoginPending, loginError } = useAuth();
  const [checkedConfig, setCheckedConfig] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoginPending) return;
    login({ username, password });
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiRequest("GET", "/api/config");
        const cfg = (await res.json()) as { profilePicker?: boolean };
        if (!cancelled && cfg?.profilePicker !== false) {
          window.location.href = "/";
          return;
        }
      } catch {
        // show login form
      } finally {
        if (!cancelled) setCheckedConfig(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!checkedConfig) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50 p-4">
        <p className="text-gray-600">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-2xl">🌱</span>
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            Parent sign in
          </CardTitle>
          <p className="text-gray-600">Username and password</p>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                className="mint-input mt-1"
                placeholder="parent"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                className="mint-input mt-1"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {loginError && (
              <div className="text-red-600 text-sm text-center">
                Login failed. Check your credentials.
              </div>
            )}

            <Button type="submit" className="w-full mint-primary mint-button" disabled={isLoginPending}>
              {isLoginPending ? "Signing in…" : "Sign In"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-600">
            <Link href="/" className="text-primary underline">
              ← Back to profile picker
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
