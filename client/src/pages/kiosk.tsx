import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authApi, type AuthResponse } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

type KioskChild = {
  id: number;
  name: string;
  age: number | null;
};

function errorMessage(err: unknown): string {
  if (err instanceof Error) {
    const parts = err.message.split(": ");
    const maybeBody = parts.length > 1 ? parts.slice(1).join(": ") : err.message;
    try {
      const parsed = JSON.parse(maybeBody) as { message?: string };
      if (parsed?.message) return parsed.message;
    } catch {
      // ignore
    }
    return err.message;
  }
  return "Something went wrong.";
}

function profileInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function Kiosk() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pinOpen, setPinOpen] = useState(false);
  const [pin, setPin] = useState("");

  const { data: config, isLoading: isConfigLoading } = useQuery({
    queryKey: ["/api/config"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/config");
      return (await res.json()) as { profilePicker?: boolean; requiresParentPin?: boolean };
    },
    staleTime: 30_000,
  });

  const profilePickerEnabled = config?.profilePicker !== false;

  const { data: children, isLoading: isChildrenLoading } = useQuery({
    queryKey: ["/api/kiosk/children"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/kiosk/children");
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as KioskChild[];
    },
    enabled: profilePickerEnabled,
    staleTime: 10_000,
  });

  const childList = useMemo(
    () => (children ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)),
    [children],
  );

  const setSession = (data: AuthResponse) => {
    authApi.setToken(data.token);
    queryClient.setQueryData(["/api/auth/me"], data.user);
    window.location.href = "/dashboard";
  };

  const parentMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/kiosk/parent-session", { pin });
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as AuthResponse;
    },
    onSuccess: (data) => {
      setPin("");
      setPinOpen(false);
      setSession(data);
    },
    onError: (err) =>
      toast({ title: "Wrong PIN", description: errorMessage(err), variant: "destructive" }),
  });

  const childMutation = useMutation({
    mutationFn: async (childId: number) => {
      const res = await apiRequest("POST", "/api/kiosk/child-session", { childId });
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as AuthResponse;
    },
    onSuccess: (data) => setSession(data),
    onError: (err) =>
      toast({ title: "Couldn’t sign in", description: errorMessage(err), variant: "destructive" }),
  });

  if (isConfigLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
        <p className="text-gray-600">Loading…</p>
      </div>
    );
  }

  if (!profilePickerEnabled) {
    window.location.href = "/login";
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex flex-col items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-3xl text-center mb-8">
        <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-md">
          <span className="text-white font-bold text-3xl">🌱</span>
        </div>
        <h1 className="text-3xl font-black text-gray-900">MintSprout</h1>
        <p className="text-gray-600 mt-2">Who&apos;s using the app today?</p>
      </div>

      <div className="w-full max-w-3xl grid grid-cols-2 sm:grid-cols-3 gap-4">
        {/* Parent profile */}
        <button
          type="button"
          onClick={() => setPinOpen(true)}
          className="group text-left"
        >
          <Card className="h-full border-2 border-transparent hover:border-primary hover:shadow-lg transition-all cursor-pointer">
            <CardContent className="p-6 flex flex-col items-center text-center gap-3">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-2xl font-black shadow-md group-hover:scale-105 transition-transform">
                👨‍👩‍👧
              </div>
              <div>
                <p className="font-bold text-gray-900 text-lg">Parent</p>
                <p className="text-xs text-gray-500 mt-1">Tap & enter PIN</p>
              </div>
            </CardContent>
          </Card>
        </button>

        {/* Child profiles — no password */}
        {isChildrenLoading ? (
          <div className="col-span-full text-center text-gray-500 py-8">Loading profiles…</div>
        ) : childList.length === 0 ? (
          <div className="col-span-full text-center text-gray-500 py-8">
            No child profiles yet. Sign in as parent to add children.
          </div>
        ) : (
          childList.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => childMutation.mutate(c.id)}
              disabled={childMutation.isPending}
              className="group text-left"
            >
              <Card className="h-full border-2 border-transparent hover:border-primary hover:shadow-lg transition-all cursor-pointer disabled:opacity-60">
                <CardContent className="p-6 flex flex-col items-center text-center gap-3">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white text-2xl font-black shadow-md group-hover:scale-105 transition-transform">
                    {profileInitials(c.name)}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-lg">{c.name}</p>
                    {c.age != null && (
                      <p className="text-xs text-gray-500 mt-1">Age {c.age}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </button>
          ))
        )}
      </div>

      <p className="mt-8 text-xs text-gray-400">
        <Link href="/login" className="underline hover:text-gray-600">
          Sign in with username & password
        </Link>
      </p>

      <Dialog open={pinOpen} onOpenChange={(open) => { setPinOpen(open); if (!open) setPin(""); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Parent PIN</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="parent-pin">Enter your PIN</Label>
              <Input
                id="parent-pin"
                type="password"
                inputMode="numeric"
                autoFocus
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && pin) parentMutation.mutate();
                }}
                placeholder="••••"
              />
            </div>
            <Button
              className="w-full mint-primary"
              onClick={() => parentMutation.mutate()}
              disabled={!pin || parentMutation.isPending}
            >
              {parentMutation.isPending ? "Signing in…" : "Continue"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
