import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useSelectedChild } from "@/components/navigation";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PageHeader, PageShell } from "@/components/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SavingsGoal = {
  id: number;
  childId: number;
  name: string;
  targetAmount: string;
  currentAmount: string;
  deadline: string | null;
  completed: boolean;
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

function clampMoneyString(value: string): string {
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n)) return "0.00";
  return Math.max(0, n).toFixed(2);
}

function todayIsoDate(): string {
  return new Date().toISOString().split("T")[0];
}

export default function Savings() {
  const { user } = useAuth();
  const { selectedChildId } = useSelectedChild();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isParent = user?.role === "parent";
  const isChild = user?.role === "child";

  const effectiveChildId = isParent ? selectedChildId : null;
  const goalsUrl = useMemo(() => {
    if (isParent && effectiveChildId) return `/api/savings-goals?childId=${encodeURIComponent(effectiveChildId)}`;
    return "/api/savings-goals";
  }, [effectiveChildId, isParent]);

  const { data: goals = [], isLoading } = useQuery<SavingsGoal[]>({
    queryKey: ["/api/savings-goals", effectiveChildId],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(goalsUrl, { headers, credentials: "include" });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status}: ${text}`);
      }
      return await res.json();
    },
    enabled: !isParent || !!effectiveChildId,
  });

  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [deadline, setDeadline] = useState<string>(todayIsoDate());

  const createMutation = useMutation({
    mutationFn: async () =>
      apiRequest("POST", "/api/savings-goals", {
        name,
        targetAmount,
        deadline: deadline || null,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/savings-goals"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      setName("");
      setTargetAmount("");
      setDeadline(todayIsoDate());
      toast({ title: "Created", description: "Savings goal added." });
    },
    onError: () => toast({ title: "Error", description: "Could not create goal.", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: { id: number; updates: Partial<SavingsGoal> }) =>
      apiRequest("PATCH", `/api/savings-goals/${payload.id}`, payload.updates),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/savings-goals"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      toast({ title: "Updated", description: "Goal saved." });
    },
    onError: () => toast({ title: "Error", description: "Could not update goal.", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/savings-goals/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/savings-goals"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      toast({ title: "Deleted", description: "Goal removed." });
    },
    onError: () => toast({ title: "Error", description: "Could not delete goal.", variant: "destructive" }),
  });

  const [fundAmounts, setFundAmounts] = useState<Record<string, string>>({});
  const fundMutation = useMutation({
    mutationFn: async (payload: { goalId: number; amount: number }) => {
      const res = await apiRequest("POST", `/api/savings-goals/${payload.goalId}/fund`, { amount: payload.amount });
      return await res.json().catch(() => ({}));
    },
    onSuccess: async (data: any) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/savings-goals"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      if (data?.pending) {
        toast({ title: "Sent for approval", description: "A parent needs to approve this goal funding." });
      } else if (isParent) {
        toast({ title: "Added", description: "Parent contribution applied to the goal." });
      } else {
        toast({ title: "Funded", description: "Money moved from Savings to your goal." });
      }
    },
    onError: (err) => toast({ title: "Error", description: errorMessage(err), variant: "destructive" }),
  });

  return (
    <PageShell className="max-w-5xl">
      <PageHeader
        title="🎯 Savings Goals"
        description={
          isParent ? "Review goals for the selected child." : "Set goals and track your progress."
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="mint-card">
            <CardHeader>
              <CardTitle>Goals</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-gray-500">Loading…</div>
              ) : goals.length === 0 ? (
                <div className="text-center py-10 text-gray-500">
                  <div className="text-4xl mb-2">🌱</div>
                  <p>No goals yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {goals
                    .slice()
                    .sort((a, b) => Number(a.completed) - Number(b.completed))
                    .map((g) => {
                      const current = parseFloat(g.currentAmount || "0");
                      const target = Math.max(0.01, parseFloat(g.targetAmount || "0.01"));
                      const pct = Math.min(100, Math.round((current / target) * 100));

                      return (
                        <div key={g.id} className="border border-gray-200 rounded-2xl p-4 bg-white">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <div className="font-black text-gray-900 truncate">{g.name}</div>
                                {g.completed && (
                                  <span className="text-xs font-bold bg-green-100 text-green-800 px-2 py-1 rounded-full">
                                    Completed
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-gray-600 mt-1">
                                ${current.toFixed(2)} / ${target.toFixed(2)} • {pct}%
                                {g.deadline ? (
                                  <>
                                    {" "}
                                    • target date{" "}
                                    {new Date(String(g.deadline) + "T12:00:00").toLocaleDateString()}
                                  </>
                                ) : null}
                              </div>
                              <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-accent h-2 rounded-full transition-all duration-500"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                            {isChild && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 hover:text-red-700"
                                onClick={() => {
                                  if (confirm("Delete this goal?")) deleteMutation.mutate(g.id);
                                }}
                                disabled={deleteMutation.isPending}
                              >
                                Delete
                              </Button>
                            )}
                          </div>

                          {isChild && (
                            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div>
                                <Label htmlFor={`goal-current-${g.id}`}>Current amount</Label>
                                <Input
                                  id={`goal-current-${g.id}`}
                                  className="mint-input mt-1"
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  defaultValue={g.currentAmount ?? "0.00"}
                                  onBlur={(e) => {
                                    const v = clampMoneyString(e.target.value);
                                    if (v === clampMoneyString(g.currentAmount ?? "0.00")) return;
                                    updateMutation.mutate({ id: g.id, updates: { currentAmount: v } as any });
                                  }}
                                />
                              </div>
                              <div className="sm:col-span-2 flex gap-2 items-end">
                                <Button
                                  className="mint-primary mint-button flex-1"
                                  variant="default"
                                  onClick={() => {
                                    const nextCompleted = !g.completed;
                                    updateMutation.mutate({ id: g.id, updates: { completed: nextCompleted } as any });
                                  }}
                                  disabled={updateMutation.isPending}
                                >
                                  {g.completed ? "Mark as active" : "Mark complete"}
                                </Button>
                                <Button
                                  className="flex-1"
                                  variant="outline"
                                  onClick={() => {
                                    const next = clampMoneyString((current + 1).toFixed(2));
                                    updateMutation.mutate({ id: g.id, updates: { currentAmount: next } as any });
                                  }}
                                  disabled={updateMutation.isPending}
                                >
                                  +$1
                                </Button>
                              </div>
                            </div>
                          )}

                          {isParent && !g.completed && (
                            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div>
                                <Label htmlFor={`goal-parent-fund-${g.id}`}>Add funds (parent)</Label>
                                <Input
                                  id={`goal-parent-fund-${g.id}`}
                                  className="mint-input mt-1"
                                  type="number"
                                  min="0.01"
                                  step="0.01"
                                  value={fundAmounts[`parent-${g.id}`] ?? ""}
                                  onChange={(e) =>
                                    setFundAmounts((prev) => ({ ...prev, [`parent-${g.id}`]: e.target.value }))
                                  }
                                  placeholder="0.00"
                                />
                              </div>
                              <div className="sm:col-span-2 flex items-end">
                                <Button
                                  className="mint-primary mint-button flex-1"
                                  onClick={() => {
                                    const raw = fundAmounts[`parent-${g.id}`] ?? "";
                                    const amt = Number.parseFloat(raw);
                                    if (!Number.isFinite(amt) || amt <= 0) return;
                                    fundMutation.mutate({ goalId: g.id, amount: amt });
                                    setFundAmounts((prev) => ({ ...prev, [`parent-${g.id}`]: "" }));
                                  }}
                                  disabled={fundMutation.isPending}
                                >
                                  Add to goal
                                </Button>
                              </div>
                            </div>
                          )}

                          {isChild && !g.completed && (
                            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div>
                                <Label htmlFor={`goal-fund-${g.id}`}>Fund from Savings</Label>
                                <Input
                                  id={`goal-fund-${g.id}`}
                                  className="mint-input mt-1"
                                  type="number"
                                  min="0.01"
                                  step="0.01"
                                  value={fundAmounts[g.id] ?? ""}
                                  onChange={(e) =>
                                    setFundAmounts((prev) => ({ ...prev, [g.id]: e.target.value }))
                                  }
                                  placeholder="0.00"
                                />
                              </div>
                              <div className="sm:col-span-2 flex gap-2 items-end">
                                <Button
                                  className="mint-secondary flex-1"
                                  onClick={() => {
                                    const raw = fundAmounts[g.id] ?? "";
                                    const amt = Number.parseFloat(raw);
                                    if (!Number.isFinite(amt) || amt <= 0) return;
                                    fundMutation.mutate({ goalId: g.id, amount: amt });
                                    setFundAmounts((prev) => ({ ...prev, [g.id]: "" }));
                                  }}
                                  disabled={fundMutation.isPending}
                                >
                                  {fundMutation.isPending ? "Funding…" : "Fund goal"}
                                </Button>
                                <Button
                                  variant="outline"
                                  className="flex-1"
                                  onClick={() => fundMutation.mutate({ goalId: g.id, amount: 5 })}
                                  disabled={fundMutation.isPending}
                                >
                                  Fund $5
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="mint-card">
            <CardHeader>
              <CardTitle>Create a goal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isParent ? (
                <div className="text-sm text-gray-600">
                  Parents can view goals here. Have the child create and update goals from their account.
                </div>
              ) : (
                <>
                  <div>
                    <Label htmlFor="sg-name">Goal name</Label>
                    <Input
                      id="sg-name"
                      className="mint-input mt-1"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. New bike"
                      maxLength={60}
                    />
                  </div>
                  <div>
                    <Label htmlFor="sg-target">Target amount</Label>
                    <Input
                      id="sg-target"
                      className="mint-input mt-1"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={targetAmount}
                      onChange={(e) => setTargetAmount(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="sg-deadline">Target date (optional)</Label>
                    <Input
                      id="sg-deadline"
                      className="mint-input mt-1"
                      type="date"
                      value={deadline}
                      onChange={(e) => setDeadline(e.target.value)}
                    />
                  </div>
                  <Button
                    className="w-full mint-accent mint-button"
                    disabled={createMutation.isPending || !name || !targetAmount}
                    onClick={() => createMutation.mutate()}
                  >
                    {createMutation.isPending ? "Creating…" : "Create goal"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}

