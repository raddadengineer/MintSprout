import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { taskLabels } from "@/lib/task-labels";

type AllowanceRow = {
  id: number;
  childId: number;
  amount: string;
  guaranteedMinimum?: string | null;
  penaltyPerIncompleteJob?: string | null;
  cadence: "weekly" | "monthly";
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  enabled: boolean;
  lastRunAt: string | null;
};

type AllowancePeriodRow = {
  allowance: AllowanceRow;
  childName: string;
  allowanceId: number;
  childId: number;
  periodKey: string;
  periodStart: string;
  chores: {
    jobId: number;
    title: string;
    recurrence: string;
    jobStatus: string;
    occurrenceKey: string;
    completedThisOccurrence: boolean;
    missedThisOccurrence: boolean;
    awaitingApproval: boolean;
  }[];
  floor: number;
  variableCap: number;
  missedCount: number;
  penaltyTotal: number;
  variablePaid: number;
  payout: number;
  alreadyPaidThisPeriod: boolean;
  canPay: boolean;
  lastRunAt: string | null;
};

function choreBadge(chore: AllowancePeriodRow["chores"][0]) {
  if (chore.missedThisOccurrence) return <Badge variant="destructive">Missed</Badge>;
  if (chore.awaitingApproval) return <Badge className="bg-orange-100 text-orange-800">Awaiting approval</Badge>;
  if (chore.completedThisOccurrence || chore.jobStatus === "approved")
    return <Badge className="bg-green-100 text-green-800">Done</Badge>;
  if (chore.jobStatus === "in_progress") return <Badge className="bg-blue-100 text-blue-800">In progress</Badge>;
  return <Badge variant="outline">Open</Badge>;
}

type AllowancePayoutPanelProps = {
  onApproveJob: (jobId: number) => void;
  onMarkMissed: (jobId: number) => void;
  approvePending?: boolean;
  markMissedPending?: boolean;
};

export function AllowancePayoutPanel({
  onApproveJob,
  onMarkMissed,
  approvePending,
  markMissedPending,
}: AllowancePayoutPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const labels = taskLabels("parent");

  const { data: rows = [], isLoading } = useQuery<AllowancePeriodRow[]>({
    queryKey: ["/api/allowances/period-status"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/allowances/period-status");
      return await res.json();
    },
  });

  const payMutation = useMutation({
    mutationFn: async (allowanceId: number) => {
      const res = await apiRequest("POST", `/api/allowances/${allowanceId}/pay`, {});
      return await res.json();
    },
    onSuccess: (data: { payout?: number }) => {
      toast({
        title: "Allowance paid",
        description: `$${Number(data.payout ?? 0).toFixed(2)} deposited to child buckets.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/allowances/period-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/allowances"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/children"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Could not pay allowance";
      toast({ title: "Error", description: msg.split(": ").slice(1).join(": ") || msg, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <Card className="mint-card mb-6">
        <CardContent className="p-6 text-gray-500">Loading allowance payouts…</CardContent>
      </Card>
    );
  }

  if (rows.length === 0) {
    return (
      <Card className="mint-card mb-6" id="allowance-payouts">
        <CardHeader>
          <CardTitle>Allowance payouts</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">
            No enabled allowances yet.{" "}
            <a href="/controls?tab=allowances" className="text-emerald-700 underline font-medium">
              Set up allowance
            </a>
            .
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 mb-8" id="allowance-payouts">
      <h2 className="text-xl font-bold text-gray-900">Allowance payouts</h2>
      {rows.map((row) => {
        const a = row.allowance;
        const scheduleLabel =
          a.cadence === "weekly"
            ? `Weekly (day ${a.dayOfWeek ?? "?"})`
            : `Monthly (day ${a.dayOfMonth ?? "?"})`;

        return (
          <Card key={a.id} className="mint-card">
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">
                    {row.childName} — ${parseFloat(a.amount).toFixed(2)} {a.cadence}
                  </CardTitle>
                  <p className="text-sm text-gray-600 mt-1">
                    {scheduleLabel} · Min ${parseFloat(String(a.guaranteedMinimum ?? "0")).toFixed(2)} · Penalty $
                    {parseFloat(String(a.penaltyPerIncompleteJob ?? "0")).toFixed(2)}/miss
                  </p>
                  {row.lastRunAt && (
                    <p className="text-xs text-gray-500 mt-1">
                      Last paid: {new Date(row.lastRunAt).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-primary">${row.payout.toFixed(2)}</p>
                  <p className="text-xs text-gray-500">Preview payout</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">
                Floor ${row.floor.toFixed(2)} + variable ${row.variablePaid.toFixed(2)}
                {row.missedCount > 0 && (
                  <span className="text-red-600">
                    {" "}
                    (−${row.penaltyTotal.toFixed(2)} from {row.missedCount} missed)
                  </span>
                )}
              </div>

              {row.chores.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-800">This period&apos;s chores</p>
                  <ul className="space-y-2">
                    {row.chores.map((chore) => (
                      <li
                        key={chore.jobId}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2 bg-white"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium truncate">{chore.title}</span>
                          {choreBadge(chore)}
                        </div>
                        <div className="flex gap-2 shrink-0">
                          {chore.awaitingApproval && (
                            <Button
                              size="sm"
                              className="text-xs"
                              disabled={approvePending}
                              onClick={() => onApproveJob(chore.jobId)}
                            >
                              {labels.approveAllowance}
                            </Button>
                          )}
                          {!chore.completedThisOccurrence && !chore.missedThisOccurrence && chore.jobStatus !== "completed" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs"
                              disabled={markMissedPending}
                              onClick={() => onMarkMissed(chore.jobId)}
                            >
                              Mark missed
                            </Button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No allowance chores assigned yet.</p>
              )}

              <Button
                className="mint-primary w-full sm:w-auto"
                disabled={!row.canPay || payMutation.isPending}
                onClick={() => payMutation.mutate(a.id)}
              >
                {row.alreadyPaidThisPeriod
                  ? "Already paid this period"
                  : payMutation.isPending
                    ? "Paying…"
                    : `Pay ${a.cadence} allowance ($${row.payout.toFixed(2)})`}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
