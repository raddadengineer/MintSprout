import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useSelectedChild } from "@/components/navigation";
import { useKidMode } from "@/hooks/use-kid-mode";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SpendingCategory = "food" | "toys" | "clothes" | "entertainment" | "education" | "other";

type SpendingEntry = {
  id: number;
  childId: number;
  item: string;
  amount: string;
  category: string;
  date: string;
  createdAt: string;
};

function errorMessage(err: unknown): string {
  if (!err || typeof err !== "object") return "Something went wrong.";
  const e = err as { message?: unknown };
  const msg = typeof e.message === "string" ? e.message : "";
  const parts = msg.split(": ");
  const maybeBody = parts.length > 1 ? parts.slice(1).join(": ") : msg;
  try {
    const parsed = JSON.parse(maybeBody) as { message?: unknown };
    if (parsed && typeof parsed.message === "string") return parsed.message;
  } catch {
    // ignore
  }
  return maybeBody || "Something went wrong.";
}

function todayIsoDate(): string {
  return new Date().toISOString().split("T")[0];
}

export default function Spending() {
  const { user } = useAuth();
  const { selectedChildId } = useSelectedChild();
  const { mode: kidMode } = useKidMode();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isParent = user?.role === "parent";
  const isChild = user?.role === "child";
  const isYoungestChild = isChild && kidMode === "youngest";
  const [, setLocation] = useLocation();

  const effectiveChildId = isParent ? selectedChildId : null;
  const spendingUrl = useMemo(() => {
    if (isParent && effectiveChildId) return `/api/spending-log?childId=${encodeURIComponent(effectiveChildId)}`;
    return "/api/spending-log";
  }, [effectiveChildId, isParent]);

  const { data: entries = [], isLoading } = useQuery<SpendingEntry[]>({
    queryKey: ["/api/spending-log", effectiveChildId],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(spendingUrl, { headers, credentials: "include" });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status}: ${text}`);
      }
      return await res.json();
    },
    enabled: !isParent || !!effectiveChildId,
  });

  const [item, setItem] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<SpendingCategory>("food");
  const [date, setDate] = useState(todayIsoDate());

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/spending-log", {
        item,
        amount,
        category,
        date,
      });
      return await res.json().catch(() => ({}));
    },
    onSuccess: async (data: any) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/spending-log"] });
      setItem("");
      setAmount("");
      setCategory("food");
      setDate(todayIsoDate());
      if (data?.pending) {
        toast({ title: "Sent for approval", description: "A parent needs to approve this spend." });
      } else {
        toast({ title: "Saved", description: "Spending entry added." });
      }
    },
    onError: (err) => {
      toast({ title: "Error", description: errorMessage(err), variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/spending-log/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/spending-log"] });
      toast({ title: "Deleted", description: "Entry removed." });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not delete entry.", variant: "destructive" });
    },
  });

  const total = useMemo(() => {
    if (!Array.isArray(entries)) return 0;
    return entries.reduce((sum, e) => sum + parseFloat(e.amount || "0"), 0);
  }, [entries]);

  useEffect(() => {
    if (isYoungestChild) setLocation("/dashboard");
  }, [isYoungestChild, setLocation]);

  if (isYoungestChild) return null;

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">🛒 Spending Log</h1>
        <p className="text-gray-600">
          {isParent ? "Review spending entries for the selected child." : "Track what you buy and learn smart spending habits."}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="mint-card">
            <CardHeader>
              <CardTitle>Recent entries</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-gray-500">Loading…</div>
              ) : entries.length === 0 ? (
                <div className="text-center py-10 text-gray-500">
                  <div className="text-4xl mb-2">🧾</div>
                  <p>No spending entries yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {entries
                    .slice()
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((e) => (
                      <div key={e.id} className="border border-gray-200 rounded-xl p-4 bg-white flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="font-semibold text-gray-900 truncate">{e.item}</div>
                          <div className="text-sm text-gray-600">
                            <span className="font-medium">{e.category}</span> •{" "}
                            <span>{new Date(e.date + "T12:00:00").toLocaleDateString()}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="font-bold text-gray-900">${parseFloat(e.amount || "0").toFixed(2)}</div>
                          {isChild && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => {
                                if (confirm("Delete this entry?")) deleteMutation.mutate(e.id);
                              }}
                              disabled={deleteMutation.isPending}
                            >
                              Delete
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="mint-card">
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-gray-600">Total logged</div>
              <div className="text-3xl font-black text-gray-900">${total.toFixed(2)}</div>
            </CardContent>
          </Card>

          <Card className="mint-card">
            <CardHeader>
              <CardTitle>Add an entry</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isParent ? (
                <div className="text-sm text-gray-600">
                  Parents can view spending entries here. Have the child add entries from their account.
                </div>
              ) : (
                <>
                  <div>
                    <Label htmlFor="sp-item">Item</Label>
                    <Input
                      id="sp-item"
                      className="mint-input mt-1"
                      value={item}
                      onChange={(e) => setItem(e.target.value)}
                      placeholder="e.g. Ice cream"
                      maxLength={80}
                    />
                  </div>
                  <div>
                    <Label htmlFor="sp-amount">Amount</Label>
                    <Input
                      id="sp-amount"
                      className="mint-input mt-1"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label>Category</Label>
                    <Select value={category} onValueChange={(v) => setCategory(v as SpendingCategory)}>
                      <SelectTrigger className="mint-input mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="food">Food</SelectItem>
                        <SelectItem value="toys">Toys</SelectItem>
                        <SelectItem value="clothes">Clothes</SelectItem>
                        <SelectItem value="entertainment">Entertainment</SelectItem>
                        <SelectItem value="education">Education</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="sp-date">Date</Label>
                    <Input
                      id="sp-date"
                      className="mint-input mt-1"
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </div>
                  <Button
                    className="w-full mint-primary mint-button"
                    disabled={addMutation.isPending || !item || !amount || !date}
                    onClick={() => addMutation.mutate()}
                  >
                    {addMutation.isPending ? "Saving…" : "Add entry"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}

