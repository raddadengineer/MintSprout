import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export type SavingsGoalRow = {
  id: number;
  childId: number;
  childName?: string;
  name: string;
  targetAmount: string;
  currentAmount: string;
  deadline: string | null;
  completed: boolean;
};

function goalPercent(goal: SavingsGoalRow): number {
  const current = parseFloat(goal.currentAmount || "0");
  const target = Math.max(0.01, parseFloat(goal.targetAmount || "0.01"));
  return Math.min(100, Math.round((current / target) * 100));
}

type ParentSavingsGoalsProps = {
  goals: SavingsGoalRow[];
  childFilterId?: number | null;
  compact?: boolean;
  showViewAll?: boolean;
};

export function ParentSavingsGoals({
  goals,
  childFilterId = null,
  compact = false,
  showViewAll = true,
}: ParentSavingsGoalsProps) {
  const filtered = goals
    .filter((g) => (childFilterId ? g.childId === childFilterId : true))
    .slice()
    .sort((a, b) => Number(a.completed) - Number(b.completed));

  if (filtered.length === 0) {
    return (
      <div className={`text-center text-gray-500 ${compact ? "py-4" : "py-8"}`}>
        <div className="text-3xl mb-2">🌱</div>
        <p className="font-medium text-sm">No savings goals yet.</p>
        {!compact && (
          <p className="text-xs mt-1">Kids can create goals from their dashboard or Goals page.</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {filtered.map((g) => {
        const pct = goalPercent(g);
        const current = parseFloat(g.currentAmount || "0");
        const target = parseFloat(g.targetAmount || "0");

        return (
          <div
            key={g.id}
            className={`border border-gray-200 rounded-2xl bg-white ${compact ? "p-3" : "p-4"}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-black text-gray-900 truncate">{g.name}</span>
                  {g.completed && (
                    <span className="text-xs font-bold bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                      Completed
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  {g.childName ? <span className="font-semibold">{g.childName} · </span> : null}
                  ${current.toFixed(2)} / ${target.toFixed(2)} · {pct}%
                  {g.deadline ? (
                    <>
                      {" "}
                      · target{" "}
                      {new Date(String(g.deadline) + "T12:00:00").toLocaleDateString()}
                    </>
                  ) : null}
                </p>
              </div>
            </div>
            <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-accent h-2 rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
      {showViewAll && (
        <Button asChild variant="ghost" className="text-primary hover:text-green-600 font-bold text-sm w-full">
          <Link href="/savings">View all goals →</Link>
        </Button>
      )}
    </div>
  );
}

export function ParentSavingsGoalsCard({
  goals,
  childFilterId = null,
}: {
  goals: SavingsGoalRow[];
  childFilterId?: number | null;
}) {
  return (
    <Card className="mint-card">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-black text-gray-900">🎯 Kids&apos; Savings Goals</h3>
        </div>
        <ParentSavingsGoals goals={goals} childFilterId={childFilterId} />
      </CardContent>
    </Card>
  );
}
