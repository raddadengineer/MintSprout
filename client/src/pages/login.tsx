import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { login, isLoginPending, loginError } = useAuth();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Attempting login with:", { username, password });
    login({ username, password });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-2xl">🌱</span>
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            Welcome to MintSprout
          </CardTitle>
          <p className="text-gray-600">Sign in to start your financial journey!</p>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="username" className="text-sm font-medium text-gray-700">
                Username
              </Label>
              <Input
                id="username"
                type="text"
                className="mint-input mt-1"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            
            <div>
              <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                className="mint-input mt-1"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {loginError && (
              <div className="text-red-600 text-sm text-center">
                Login failed. Please check your credentials.
              </div>
            )}
            
            <Button
              type="submit"
              className="w-full mint-primary mint-button"
              disabled={isLoginPending}
            >
              {isLoginPending ? "Signing in..." : "Sign In"}
            </Button>
          </form>
          
          <div className="mt-6 text-center text-sm text-gray-600">
            <p>Demo accounts:</p>
            <p><strong>Parent:</strong> parent / password123</p>
            <p><strong>Child:</strong> emma / password123</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
