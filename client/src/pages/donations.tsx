import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useSelectedChild } from "@/components/navigation";
import { useKidMode } from "@/hooks/use-kid-mode";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PageHeader, PageShell } from "@/components/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Donation = {
  id: number;
  childId: number;
  organization: string;
  cause: string;
  amount: string;
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

export default function Donations() {
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
  const donationsUrl = useMemo(() => {
    if (isParent && effectiveChildId) return `/api/donations?childId=${encodeURIComponent(effectiveChildId)}`;
    return "/api/donations";
  }, [effectiveChildId, isParent]);

  const { data: donations = [], isLoading } = useQuery<Donation[]>({
    queryKey: ["/api/donations", effectiveChildId],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(donationsUrl, { headers, credentials: "include" });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status}: ${text}`);
      }
      return await res.json();
    },
    enabled: !isParent || !!effectiveChildId,
  });

  const [organization, setOrganization] = useState("");
  const [cause, setCause] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayIsoDate());

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/donations", {
        organization,
        cause,
        amount,
        date,
      });
      return await res.json().catch(() => ({}));
    },
    onSuccess: async (data: any) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/donations"] });
      setOrganization("");
      setCause("");
      setAmount("");
      setDate(todayIsoDate());
      if (data?.pending) {
        toast({ title: "Sent for approval", description: "A parent needs to approve this donation." });
      } else {
        toast({ title: "Saved", description: "Donation added." });
      }
    },
    onError: (err) => {
      toast({ title: "Error", description: errorMessage(err), variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/donations/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/donations"] });
      toast({ title: "Deleted", description: "Donation removed." });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not delete donation.", variant: "destructive" });
    },
  });

  const total = useMemo(() => {
    if (!Array.isArray(donations)) return 0;
    return donations.reduce((sum, d) => sum + parseFloat(d.amount || "0"), 0);
  }, [donations]);

  useEffect(() => {
    if (isYoungestChild) setLocation("/dashboard");
  }, [isYoungestChild, setLocation]);

  if (isYoungestChild) return null;

  return (
    <PageShell className="max-w-5xl">
      <PageHeader
        title="❤️ Donations"
        description={
          isParent ? "Review donations for the selected child." : "Track giving and causes you care about."
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="mint-card">
            <CardHeader>
              <CardTitle>Donation history</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-gray-500">Loading…</div>
              ) : donations.length === 0 ? (
                <div className="text-center py-10 text-gray-500">
                  <div className="text-4xl mb-2">🌟</div>
                  <p>No donations logged yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {donations
                    .slice()
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((d) => (
                      <div key={d.id} className="border border-gray-200 rounded-xl p-4 bg-white flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="font-semibold text-gray-900 truncate">{d.organization}</div>
                          <div className="text-sm text-gray-600">
                            <span className="font-medium">{d.cause}</span> •{" "}
                            <span>{new Date(d.date + "T12:00:00").toLocaleDateString()}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="font-bold text-gray-900">${parseFloat(d.amount || "0").toFixed(2)}</div>
                          {isChild && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => {
                                if (confirm("Delete this donation?")) deleteMutation.mutate(d.id);
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
              <div className="text-sm text-gray-600">Total donated</div>
              <div className="text-3xl font-black text-gray-900">${total.toFixed(2)}</div>
            </CardContent>
          </Card>

          <Card className="mint-card">
            <CardHeader>
              <CardTitle>Add a donation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isParent ? (
                <div className="text-sm text-gray-600">
                  Parents can view donation history here. Have the child add donations from their account.
                </div>
              ) : (
                <>
                  <div>
                    <Label htmlFor="don-org">Organization</Label>
                    <Input
                      id="don-org"
                      className="mint-input mt-1"
                      value={organization}
                      onChange={(e) => setOrganization(e.target.value)}
                      placeholder="e.g. Local food bank"
                      maxLength={80}
                    />
                  </div>
                  <div>
                    <Label htmlFor="don-cause">Cause</Label>
                    <Input
                      id="don-cause"
                      className="mint-input mt-1"
                      value={cause}
                      onChange={(e) => setCause(e.target.value)}
                      placeholder="e.g. Hunger relief"
                      maxLength={80}
                    />
                  </div>
                  <div>
                    <Label htmlFor="don-amount">Amount</Label>
                    <Input
                      id="don-amount"
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
                    <Label htmlFor="don-date">Date</Label>
                    <Input
                      id="don-date"
                      className="mint-input mt-1"
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </div>
                  <Button
                    className="w-full mint-primary mint-button"
                    disabled={addMutation.isPending || !organization || !cause || !amount || !date}
                    onClick={() => addMutation.mutate()}
                  >
                    {addMutation.isPending ? "Saving…" : "Add donation"}
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

