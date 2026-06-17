import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { JobCreationModal } from "@/components/job-creation-modal";
import { PaymentApprovalModal } from "@/components/payment-approval-modal";
import { AccountTypesModal } from "@/components/account-types-modal";
import { SavingsGoalsModal } from "@/components/savings-goals-modal";
import { Confetti } from "@/components/confetti";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";
import { useSelectedChild } from "@/components/navigation";
import { useKidMode } from "@/hooks/use-kid-mode";
import { SproutBuddyCTA } from "@/components/sprout-buddy";
import { DailyBriefCard } from "@/components/daily-brief";
import { IconText } from "@/components/icon-text";
import { YOUNGEST_STATS, youngestJobStatus } from "@/lib/youngest-ui";
import { groupJobsByCategory, type JobCategoryRow } from "@/lib/job-category-groups";
import { JobIcon } from "@/components/job-icon";
import type { ChildRow, JobRow } from "@/lib/api-types";
import { taskLabels } from "@/lib/task-labels";
import { needsPaymentModal, taskPayKind, taskPayLabel } from "@/lib/task-pay-type";
import { ParentSavingsGoalsCard, type SavingsGoalRow } from "@/components/parent-savings-goals";

export default function Dashboard() {
  const { user } = useAuth();
  const { mode: kidMode, age: kidAge } = useKidMode();
  const [, navigate] = useLocation();
  const [showJobModal, setShowJobModal] = useState(false);
  const [showAccountTypesModal, setShowAccountTypesModal] = useState(false);
  const [showSavingsGoalModal, setShowSavingsGoalModal] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedJobForPayment, setSelectedJobForPayment] = useState<JobRow | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedChildId } = useSelectedChild();

  const { data: dashboardData, isLoading } = useQuery<{
    child?: any;
    allocation?: any;
    activeJobs?: any[];
    achievements?: any[];
  }>({
    queryKey: ["/api/dashboard-stats", selectedChildId],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      const headers: Record<string, string> = {};

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const url =
        user?.role === "parent" && selectedChildId
          ? `/api/dashboard-stats?childId=${encodeURIComponent(selectedChildId)}`
          : "/api/dashboard-stats";

      const res = await fetch(url, {
        headers,
        credentials: "include",
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status}: ${text}`);
      }

      return await res.json();
    },
    enabled: !!user,
  });

  const { data: accountTypes } = useQuery<{
    spendingEnabled?: boolean;
    savingsEnabled?: boolean;
    rothIraEnabled?: boolean;
    brokerageEnabled?: boolean;
  }>({
    queryKey: [`/api/account-types/${user?.familyId}`],
    enabled: !!user?.familyId,
  });

  const { data: children = [] } = useQuery<any[]>({
    queryKey: ["/api/children"],
    enabled: user?.role === "parent",
  });

  const { data: learningProgress = [] } = useQuery<any[]>({
    queryKey: ["/api/learning-progress"],
    enabled: user?.role === "child",
  });

  const { data: savingsGoals = [] } = useQuery<SavingsGoalRow[]>({
    queryKey: ["/api/savings-goals", user?.role === "parent" ? "all" : "self"],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const url =
        user?.role === "parent"
          ? "/api/savings-goals?all=true"
          : "/api/savings-goals";

      const res = await fetch(url, { headers, credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return await res.json();
    },
    enabled: !!user,
  });

  const { data: jobCategories = [] } = useQuery<JobCategoryRow[]>({
    queryKey: ["/api/job-categories"],
  });

  const { data: allFamilyJobs = [] } = useQuery<JobRow[]>({
    queryKey: ["/api/jobs"],
    enabled: user?.role === "parent",
  });

  const labels = taskLabels(user?.role === "parent" ? "parent" : "child", kidMode);

  const triggerConfetti = () => {
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 4500);
  };

  const updateJobMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: number;[key: string]: any }) =>
      apiRequest("PATCH", `/api/jobs/${id}`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/children"] });

      const approvedJob = dashboardData?.activeJobs?.find((j) => j.id === variables.id);

      if (variables.status === "approved") {
        triggerConfetti();
        queryClient.invalidateQueries({ queryKey: [`/api/payments/job/${variables.id}`] });
        queryClient.invalidateQueries({
          predicate: (query) => {
            const firstKey = query.queryKey[0];
            return firstKey ? firstKey.toString().includes('/api/allocation') : false;
          }
        });
      }

      if (variables.status === "completed" && user?.role === "child") {
        triggerConfetti();
      }

      toast({
        title: variables.status === "approved"
          ? approvedJob?.isFamilyDuty
            ? "✅ Great teamwork!"
            : "💰 Payment Approved!"
          : "✅ Task updated!",
        description: variables.status === "approved"
          ? approvedJob?.isFamilyDuty
            ? "Family responsibility marked complete."
            : "Great job! Payment has been processed."
          : "Task status updated successfully",
      });
    },
  });

  const handleJobAction = (jobId: number, status: string) => {
    updateJobMutation.mutate({ id: jobId, status });
  };

  const handleParentApprove = (job: JobRow) => {
    if (needsPaymentModal(job)) {
      setSelectedJobForPayment(job);
      setShowPaymentModal(true);
      return;
    }
    handleJobAction(job.id, "approved");
  };

  const getChildNameById = (childId: number) => {
    const c = (children as ChildRow[]).find((ch) => ch.id === childId);
    return c?.name ?? "Unknown";
  };

  const getStatusBadge = (status: string) => {
    if (user?.role === "child" && kidMode === "youngest") {
      const { icon, label } = youngestJobStatus(status);
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-sm font-bold text-gray-800">
          <span aria-hidden>{icon}</span>
          {label}
        </span>
      );
    }
    switch (status) {
      case "assigned":
        return <span className="mint-badge-assigned">Assigned</span>;
      case "in_progress":
        return <span className="mint-badge-progress">In Progress</span>;
      case "completed":
        return <span className="mint-badge-completed">⏱️ Awaiting Approval</span>;
      case "approved":
        return <span className="mint-badge-approved">✅ Approved</span>;
      default:
        return <span className="mint-badge-assigned">{status}</span>;
    }
  };

  const getJobIcon = (title: string) => {
    if (title.toLowerCase().includes("clean")) return "🧹";
    if (title.toLowerCase().includes("water")) return "🌿";
    if (title.toLowerCase().includes("table")) return "🍽️";
    if (title.toLowerCase().includes("dishes")) return "🧽";
    if (title.toLowerCase().includes("laundry")) return "👕";
    if (title.toLowerCase().includes("trash")) return "🗑️";
    if (title.toLowerCase().includes("lawn") || title.toLowerCase().includes("mow")) return "🌱";
    if (title.toLowerCase().includes("vacuum")) return "🫧";
    if (title.toLowerCase().includes("cook")) return "🍳";
    return "✅";
  };

  const renderActiveJobCard = (job: any) => (
    <div key={job.id} className="border-2 border-gray-100 rounded-2xl p-4 hover:border-primary transition-all duration-200 hover:shadow-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-blue-50 rounded-xl flex items-center justify-center text-2xl">
            {job.icon ? <JobIcon iconName={job.icon} className="h-6 w-6 text-blue-700" /> : getJobIcon(job.title)}
          </div>
          <div>
            <h4 className="font-black text-gray-900">{job.title}</h4>
            <p className="text-sm text-gray-500 font-medium">{job.description}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-black text-primary text-xl">
            {(job as any).isFamilyDuty
              ? kidMode === "youngest"
                ? "🏠 Home"
                : "Family"
              : (job as any).allowanceId
                ? kidMode === "youngest"
                  ? "💵 Pay"
                  : "Allowance"
                : `$${parseFloat(job.amount).toFixed(2)}`}
          </p>
          {getStatusBadge(job.status)}
        </div>
      </div>

      <div className="mt-4 flex space-x-2">
        {job.status === "assigned" && user?.role === "child" && (
          <Button
            onClick={() => handleJobAction(job.id, "in_progress")}
            className={`flex-1 mint-secondary ${kidMode === "youngest" ? "h-14" : ""}`}
            disabled={updateJobMutation.isPending}
          >
            {kidMode === "youngest" ? (
              <IconText icon="🚀" label="Start" size="md" />
            ) : (
              labels.start
            )}
          </Button>
        )}
        {job.status === "in_progress" && user?.role === "child" && (
          <Button
            onClick={() => handleJobAction(job.id, "completed")}
            className={`flex-1 mint-primary ${kidMode === "youngest" ? "h-14" : ""}`}
            disabled={updateJobMutation.isPending}
          >
            {kidMode === "youngest" ? (
              <IconText icon="🎉" label="Done!" size="md" />
            ) : (
              "🎉 Mark Complete!"
            )}
          </Button>
        )}
        {job.status === "completed" && user?.role === "parent" && (
          <Button
            onClick={() => handleParentApprove(job)}
            className="flex-1 mint-primary"
            disabled={updateJobMutation.isPending}
          >
            {taskPayKind(job) === "family_duty"
              ? `✅ ${labels.approve}`
              : taskPayKind(job) === "allowance"
                ? `✅ ${labels.approveAllowance}`
                : `💰 ${labels.approvePay}`}
          </Button>
        )}
      </div>
    </div>
  );

  // Friendly names for child-facing account types
  const getAccountLabel = (key: string) => {
    if (user?.role === "child") {
      if (key === "rothIra") return "Future Fund";
      if (key === "brokerage") return "Grow Fund";
    }
    if (key === "rothIra") return "Roth IRA";
    if (key === "brokerage") return "Brokerage";
    return key;
  };

  // Compute real learning progress percentages
  const categoryProgress = ["earning", "saving", "spending", "investing", "donating"].map((cat) => {
    const catProgress = Array.isArray(learningProgress)
      ? learningProgress.filter((p: any) => p.category === cat || p.lessonCategory === cat)
      : [];
    return { cat, count: catProgress.filter((p: any) => p.completed).length, total: catProgress.length };
  });

  const topGoal = user?.role === "child" && Array.isArray(savingsGoals) && savingsGoals.length > 0
    ? savingsGoals.find((g) => !g.completed) || savingsGoals[0]
    : null;

  const parentSelectedChildId = selectedChildId ? parseInt(selectedChildId, 10) : null;

  const goalPercent = topGoal
    ? Math.min(100, Math.round((parseFloat(topGoal.currentAmount || "0") / parseFloat(topGoal.targetAmount || "1")) * 100))
    : 0;

  const child = dashboardData?.child;
  const allocation = dashboardData?.allocation;
  const activeJobs = dashboardData?.activeJobs || [];
  const awaitingApproval = useMemo(
    () => (allFamilyJobs as JobRow[]).filter((j) => j.status === "completed"),
    [allFamilyJobs],
  );
  const activeJobGroups = useMemo(
    () => groupJobsByCategory(activeJobs, jobCategories),
    [activeJobs, jobCategories],
  );
  const achievements = dashboardData?.achievements || [];

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse space-y-8">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-2xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Confetti active={showConfetti} />

      {/* Dashboard Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="text-5xl animate-bounce-slow">🌱</div>
            <div>
              <h2 className="text-3xl font-black text-gray-900 mb-1">
                Hey, <span className="text-primary">{user?.name}</span>! 👋
              </h2>
              <p className="text-gray-600 text-lg font-medium">
                {user?.role === "parent"
                  ? "Here's how your family's financial learning is progressing!"
                  : kidMode === "youngest"
                    ? (
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-base font-bold text-gray-700">
                        <IconText icon="✅" label="Pick a job" size="sm" />
                        <span className="text-gray-400" aria-hidden>→</span>
                        <IconText icon="🚀" label="Tap Start" size="sm" />
                        <span className="text-gray-400" aria-hidden>→</span>
                        <IconText icon="🎉" label="Tap Done!" size="sm" />
                      </span>
                    )
                    : kidMode === "younger"
                      ? "Let’s grow your money garden! 🌼 Pick a job, then earn!"
                      : "Let’s check your balances, goals, and progress."
                }
              </p>
            </div>
          </div>
          <div className="mt-4 sm:mt-0 flex flex-wrap gap-3">
            {user?.role === "parent" ? (
              <>
                <Button
                  onClick={() => setShowJobModal(true)}
                  className="mint-primary mint-button shadow-lg hover:shadow-xl"
                >
                  ➕ {labels.create}
                </Button>
                <Button
                  onClick={() => navigate("/jobs?view=payments")}
                  variant="outline"
                  className="shadow-lg hover:shadow-xl font-bold bg-amber-50 hover:bg-amber-100 border-amber-200"
                >
                  💰 Tasks & Payments
                </Button>
                <Button
                  onClick={() => navigate("/controls?tab=allocation")}
                  variant="outline"
                  className="shadow-lg hover:shadow-xl font-bold"
                >
                  🎛️ Set Allocations
                </Button>
                <Button
                  onClick={() => setShowAccountTypesModal(true)}
                  variant="outline"
                  className="shadow-lg hover:shadow-xl font-bold"
                >
                  🏦 Configure Accounts
                </Button>
                <Button
                  variant="outline"
                  className="shadow-lg hover:shadow-xl font-bold"
                  onClick={() => navigate("/reports")}
                >
                  📊 View Reports
                </Button>
                <Button
                  variant="outline"
                  className="shadow-lg hover:shadow-xl font-bold"
                  onClick={() => navigate("/learn")}
                >
                  📚 Create Lesson
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  className="shadow-lg hover:shadow-xl bg-purple-50 hover:bg-purple-100 border-purple-200 font-bold"
                  onClick={() => navigate("/learn")}
                >
                  {kidMode === "youngest" ? (
                    <IconText icon="🧠" label="Quiz" size="sm" />
                  ) : kidMode === "younger" ? (
                    "🧩 Quiz Time"
                  ) : (
                    "❓ Take Quiz"
                  )}
                </Button>
                <Button
                  variant="outline"
                  className="shadow-lg hover:shadow-xl bg-red-50 hover:bg-red-100 border-red-200 font-bold"
                  onClick={() => navigate("/learn")}
                >
                  {kidMode === "youngest" ? (
                    <IconText icon="📖" label="Stories" size="sm" />
                  ) : kidMode === "younger" ? (
                    "📖 Learn"
                  ) : (
                    "📖 Learn Now"
                  )}
                </Button>
                {kidMode !== "youngest" && (
                  <Button
                    variant="outline"
                    className="shadow-lg hover:shadow-xl bg-green-50 hover:bg-green-100 border-green-200 font-bold"
                    onClick={() => setShowSavingsGoalModal(true)}
                  >
                    {kidMode === "younger" ? "🎯 New Goal" : "🎯 Set Savings Goal"}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {user?.role === "child" && (
        <>
          <DailyBriefCard />
          <div className="mb-8">
            <SproutBuddyCTA mode={kidMode} />
          </div>
        </>
      )}

      {user?.role === "parent" && awaitingApproval.length > 0 && (
        <Card className="mint-card mb-8 border-2 border-orange-200 bg-orange-50/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4 gap-4">
              <h3 className="text-xl font-black text-gray-900">
                ⏱️ {labels.needsAttention} ({awaitingApproval.length})
              </h3>
              <Button asChild variant="outline" size="sm" className="shrink-0">
                <Link href="/jobs?view=payments">{labels.viewAll} →</Link>
              </Button>
            </div>
            <div className="space-y-3">
              {awaitingApproval.slice(0, 5).map((job) => (
                <div
                  key={job.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white rounded-xl border border-orange-100"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900 truncate">{job.title}</p>
                    <p className="text-sm text-gray-600">
                      {getChildNameById(job.assignedToId)} · {taskPayLabel(job)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="mint-primary shrink-0"
                    onClick={() => handleParentApprove(job)}
                    disabled={updateJobMutation.isPending}
                  >
                    {needsPaymentModal(job) ? labels.approvePay : labels.approve}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Role-based Stats Overview */}
      {user?.role === "parent" ? (
        // Parent Dashboard Stats
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="mint-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-500 mb-1">{labels.activeSection}</p>
                  <p className="text-3xl font-black text-gray-900">{activeJobs.length}</p>
                </div>
                <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center">
                  <span className="text-blue-500 text-2xl">📋</span>
                </div>
              </div>
              <div className="mt-4 flex items-center text-sm">
                <span className="text-blue-600 font-bold">For selected child</span>
              </div>
            </CardContent>
          </Card>

          <Card className="mint-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-500 mb-1">{labels.awaitingApproval}</p>
                  <p className="text-3xl font-black text-gray-900">{awaitingApproval.length}</p>
                </div>
                <div className="w-14 h-14 bg-orange-500/10 rounded-2xl flex items-center justify-center">
                  <span className="text-orange-500 text-2xl">⏱️</span>
                </div>
              </div>
              <div className="mt-4 flex items-center text-sm">
                <span className="text-orange-600 font-bold">Across all children</span>
              </div>
            </CardContent>
          </Card>

          <Card className="mint-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-500 mb-1">Tasks completed</p>
                  <p className="text-3xl font-black text-gray-900">{child?.completedJobs || 0}</p>
                </div>
                <div className="w-14 h-14 bg-green-500/10 rounded-2xl flex items-center justify-center">
                  <span className="text-green-500 text-2xl">🏆</span>
                </div>
              </div>
              <div className="mt-4 flex items-center text-sm">
                <span className="text-green-600 font-bold">By your kids</span>
              </div>
            </CardContent>
          </Card>

          <Card className="mint-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-500 mb-1">Family Savings</p>
                  <p className="text-3xl font-black text-gray-900">
                    ${parseFloat(child?.totalEarned || "0").toFixed(2)}
                  </p>
                </div>
                <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center">
                  <span className="text-primary text-2xl">💰</span>
                </div>
              </div>
              <div className="mt-4 flex items-center text-sm">
                <span className="text-primary font-bold">Total earned</span>
              </div>
            </CardContent>
          </Card>

          <Card className="mint-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-500 mb-1">Children Learning</p>
                  <p className="text-3xl font-black text-gray-900">{(children as any[]).length}</p>
                </div>
                <div className="w-14 h-14 bg-orange-500/10 rounded-2xl flex items-center justify-center">
                  <span className="text-orange-500 text-2xl">📚</span>
                </div>
              </div>
              <div className="mt-4 flex items-center text-sm">
                <span className="text-orange-500 font-bold">In your family</span>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        // Child Dashboard Stats
        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 ${kidMode === "youngest" ? "grid-cols-2" : ""}`}>
          <Card className="mint-card">
            <CardContent className={kidMode === "youngest" ? "p-5" : "p-6"}>
              {kidMode === "youngest" ? (
                <div className="text-center space-y-2">
                  <IconText icon={YOUNGEST_STATS.earned.icon} label={YOUNGEST_STATS.earned.label} layout="vertical" size="md" />
                  <p className="text-3xl font-black text-gray-900">${parseFloat(child?.totalEarned || "0").toFixed(2)}</p>
                  <p className="text-sm font-bold text-green-600">{YOUNGEST_STATS.earned.hint}</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-gray-500 mb-1">Total Earned</p>
                      <p className="text-3xl font-black text-gray-900">
                        ${parseFloat(child?.totalEarned || "0").toFixed(2)}
                      </p>
                    </div>
                    <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center">
                      <span className="text-primary text-2xl">💰</span>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center text-sm">
                    <span className="text-green-600 font-bold">🌱 Growing!</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="mint-card">
            <CardContent className={kidMode === "youngest" ? "p-5" : "p-6"}>
              {kidMode === "youngest" ? (
                <div className="text-center space-y-2">
                  <IconText icon={YOUNGEST_STATS.jobsDone.icon} label={YOUNGEST_STATS.jobsDone.label} layout="vertical" size="md" />
                  <p className="text-3xl font-black text-gray-900">{child?.completedJobs || 0}</p>
                  <p className="text-sm font-bold text-green-600">{YOUNGEST_STATS.jobsDone.hint}</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-gray-500 mb-1">Tasks completed</p>
                      <p className="text-3xl font-black text-gray-900">{child?.completedJobs || 0}</p>
                    </div>
                    <div className="w-14 h-14 bg-secondary/10 rounded-2xl flex items-center justify-center">
                      <span className="text-secondary text-2xl">✅</span>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center text-sm">
                    <span className="text-green-600 font-bold">Keep it up!</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="mint-card">
            <CardContent className={kidMode === "youngest" ? "p-5" : "p-6"}>
              {kidMode === "youngest" ? (
                <div className="text-center space-y-2">
                  <IconText icon={YOUNGEST_STATS.goal.icon} label={YOUNGEST_STATS.goal.label} layout="vertical" size="md" />
                  <p className="text-3xl font-black text-gray-900">{topGoal ? `${goalPercent}%` : "—"}</p>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-accent h-2 rounded-full transition-all duration-500" style={{ width: `${goalPercent}%` }} />
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-gray-500 mb-1">
                        {topGoal ? topGoal.name : "Savings Goal"}
                      </p>
                      <p className="text-3xl font-black text-gray-900">{topGoal ? `${goalPercent}%` : "No goal yet"}</p>
                    </div>
                    <div className="w-14 h-14 bg-accent/10 rounded-2xl flex items-center justify-center">
                      <span className="text-accent text-2xl">🐷</span>
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-accent h-2 rounded-full transition-all duration-500" style={{ width: `${goalPercent}%` }}></div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="mint-card">
            <CardContent className={kidMode === "youngest" ? "p-5" : "p-6"}>
              {kidMode === "youngest" ? (
                <div className="text-center space-y-2">
                  <IconText icon={YOUNGEST_STATS.learning.icon} label={YOUNGEST_STATS.learning.label} layout="vertical" size="md" />
                  <p className="text-3xl font-black text-gray-900">{child?.learningStreak || 0}</p>
                  <p className="text-sm font-bold text-orange-500">{YOUNGEST_STATS.learning.hint}</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-gray-500 mb-1">Learning Streak</p>
                      <p className="text-3xl font-black text-gray-900">{child?.learningStreak || 0} days</p>
                    </div>
                    <div className="w-14 h-14 bg-orange-500/10 rounded-2xl flex items-center justify-center">
                      <span className="text-orange-500 text-2xl">🔥</span>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center text-sm">
                    <span className="text-orange-500 font-bold">{(child?.learningStreak || 0) > 0 ? "🔥 On fire!" : "Start learning!"}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Jobs and Money Allocation */}
        <div className="lg:col-span-2 space-y-8">
          {/* Active Jobs */}
          <Card className="mint-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-black text-gray-900">
                  {kidMode === "youngest" ? (
                    <IconText icon="✅" label={labels.activeSection} size="md" />
                  ) : (
                    `✅ ${labels.activeSection}`
                  )}
                </h3>
                <Button asChild variant="ghost" className="text-primary hover:text-green-600 font-bold text-sm">
                  <Link href="/jobs">
                    {kidMode === "youngest" ? (
                      <IconText icon="👀" label="See All" size="sm" />
                    ) : (
                      "View All →"
                    )}
                  </Link>
                </Button>
              </div>

              <div className="space-y-4">
                {activeJobs.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-4xl mb-3">🎈</div>
                    <p className="font-medium">{labels.noActive}</p>
                    {user?.role === "parent" && (
                      <Button
                        onClick={() => setShowJobModal(true)}
                        className="mt-4 mint-primary"
                      >
                        {labels.createFirst}
                      </Button>
                    )}
                  </div>
                ) : user?.role === "child" && activeJobGroups.length > 0 ? (
                  activeJobGroups.map((group) => (
                    <div key={group.label} className="space-y-3">
                      <div className="flex items-center gap-2 pt-1">
                        <JobIcon iconName={group.icon} className="h-5 w-5 text-indigo-700" />
                        <h4 className="font-bold text-gray-800 text-sm uppercase tracking-wide">
                          {group.label}
                        </h4>
                      </div>
                      {group.jobs.map(renderActiveJobCard)}
                    </div>
                  ))
                ) : (
                  activeJobs.map(renderActiveJobCard)
                )}
              </div>
            </CardContent>
          </Card>

          {user?.role === "parent" && (
            <ParentSavingsGoalsCard
              goals={savingsGoals}
              childFilterId={parentSelectedChildId && Number.isFinite(parentSelectedChildId) ? parentSelectedChildId : null}
            />
          )}

          {/* Money Allocation */}
          {allocation && (
            <Card className="mint-card">
              <CardContent className="p-6">
                <h3 className="text-xl font-black text-gray-900 mb-6">
                  🥧 Money Allocation
                </h3>

                <div className={`grid gap-4 mb-6 ${[
                  accountTypes?.spendingEnabled,
                  accountTypes?.savingsEnabled,
                  accountTypes?.rothIraEnabled,
                  accountTypes?.brokerageEnabled
                ].filter(Boolean).length === 1 ? 'grid-cols-1' :
                  [
                    accountTypes?.spendingEnabled,
                    accountTypes?.savingsEnabled,
                    accountTypes?.rothIraEnabled,
                    accountTypes?.brokerageEnabled
                  ].filter(Boolean).length === 2 ? 'grid-cols-2' :
                    [
                      accountTypes?.spendingEnabled,
                      accountTypes?.savingsEnabled,
                      accountTypes?.rothIraEnabled,
                      accountTypes?.brokerageEnabled
                    ].filter(Boolean).length === 3 ? 'grid-cols-3' : 'grid-cols-2 lg:grid-cols-4'
                  }`}>
                  {accountTypes?.spendingEnabled && (
                    <div className="text-center p-4 bg-blue-50 rounded-2xl hover:bg-blue-100 transition-colors">
                      <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl">🛒</div>
                      <p className="text-sm font-bold text-gray-600 mb-1">Spending</p>
                      <p className="text-2xl font-black text-blue-600">${parseFloat(child?.spendingBalance || "0").toFixed(2)}</p>
                      <p className="text-xs text-gray-500 font-medium mt-1">{allocation?.spendingPercentage || 0}% of earnings</p>
                    </div>
                  )}
                  {accountTypes?.savingsEnabled && (
                    <div className="text-center p-4 bg-green-50 rounded-2xl hover:bg-green-100 transition-colors">
                      <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl">🐷</div>
                      <p className="text-sm font-bold text-gray-600 mb-1">Savings</p>
                      <p className="text-2xl font-black text-green-600">${parseFloat(child?.savingsBalance || "0").toFixed(2)}</p>
                      <p className="text-xs text-gray-500 font-medium mt-1">{allocation?.savingsPercentage || 0}% of earnings</p>
                    </div>
                  )}
                  {accountTypes?.rothIraEnabled && (
                    <div className="text-center p-4 bg-purple-50 rounded-2xl hover:bg-purple-100 transition-colors">
                      <div className="w-14 h-14 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl">📈</div>
                      <p className="text-sm font-bold text-gray-600 mb-1">{getAccountLabel("rothIra")}</p>
                      <p className="text-2xl font-black text-purple-600">${parseFloat(child?.rothIraBalance || "0").toFixed(2)}</p>
                      <p className="text-xs text-gray-500 font-medium mt-1">{allocation?.rothIraPercentage || 0}% of earnings</p>
                    </div>
                  )}
                  {accountTypes?.brokerageEnabled && (
                    <div className="text-center p-4 bg-yellow-50 rounded-2xl hover:bg-yellow-100 transition-colors">
                      <div className="w-14 h-14 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl">📊</div>
                      <p className="text-sm font-bold text-gray-600 mb-1">{getAccountLabel("brokerage")}</p>
                      <p className="text-2xl font-black text-yellow-600">${parseFloat(child?.brokerageBalance || "0").toFixed(2)}</p>
                      <p className="text-xs text-gray-500 font-medium mt-1">{allocation?.brokeragePercentage || 0}% of earnings</p>
                    </div>
                  )}
                </div>

                {user?.role === "parent" && (
                  <Button
                    onClick={() => navigate("/controls?tab=allocation")}
                    variant="outline"
                    className="w-full font-bold"
                  >
                    🎛️ Customize Allocation
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Role-based Content */}
        <div className="space-y-8">
          {user?.role === "parent" ? (
            // Parent Sidebar Content
            <>
              {/* Family Overview */}
              <Card className="bg-gradient-to-br from-blue-500 to-blue-700 text-white border-0 shadow-lg">
                <CardContent className="p-6">
                  <h3 className="text-xl font-black mb-4">
                    👨‍👩‍👧‍👦 Family Overview
                  </h3>

                  <div className="space-y-3">
                    <div className="bg-white/20 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold">Children Enrolled</span>
                        <span className="text-lg font-black">{(children as any[]).length}</span>
                      </div>
                      <p className="text-sm text-white/80 font-medium">
                        {(children as any[]).length === 0
                          ? "No children added yet"
                          : (children as any[]).map((c: any) => c.name).join(", ") + " learning financial literacy"}
                      </p>
                    </div>

                    <div className="bg-white/20 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold">Active Teaching</span>
                        <span className="text-lg font-black">{activeJobs.length}</span>
                      </div>
                      <p className="text-sm text-white/80 font-medium">Tasks currently assigned</p>
                    </div>
                  </div>

                  <Button asChild className="w-full bg-white text-blue-600 hover:bg-gray-50 mt-4 font-black">
                    <Link href="/family">Manage Family →</Link>
                  </Button>
                </CardContent>
              </Card>
            </>
          ) : (
            // Child Sidebar Content
            <>
              {/* Learning Progress */}
              <Card className="bg-gradient-to-br from-primary to-green-700 text-white border-0 shadow-lg">
                <CardContent className="p-6">
                  <h3 className="text-xl font-black mb-4">
                    🎓 Learning Progress
                  </h3>

                  <div className="space-y-3">
                    {[
                      { label: "Earning Money", icon: "💰" },
                      { label: "Saving Money", icon: "🐷" },
                      { label: "Smart Spending", icon: "🛒" },
                    ].map(({ label, icon }) => {
                      // We'll just show the raw learning data available
                      const done = Array.isArray(learningProgress) ? learningProgress.filter((p: any) => p.completed).length : 0;
                      const total = Array.isArray(learningProgress) ? learningProgress.length : 0;
                      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                      return (
                        <div key={label} className="bg-white/20 rounded-xl p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-bold text-sm">{icon} {label}</span>
                            <span className="text-xs bg-white/30 px-2 py-1 rounded-lg font-bold">{pct}%</span>
                          </div>
                          <div className="w-full bg-white/20 rounded-full h-2">
                            <div className="bg-white h-2 rounded-full transition-all duration-500" style={{ width: `${pct}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <Button asChild className="w-full bg-white text-primary hover:bg-gray-50 mt-4 font-black">
                    <Link href="/learn">Continue Learning →</Link>
                  </Button>
                </CardContent>
              </Card>

              {/* Recent Achievements */}
              <Card className="mint-card">
                <CardContent className="p-6">
                  <h3 className="text-xl font-black text-gray-900 mb-4">
                    🏆 Recent Achievements
                  </h3>

                  <div className="space-y-3">
                    {achievements.length === 0 ? (
                      <div className="text-center py-4">
                        <div className="text-3xl mb-2">🌟</div>
                        <p className="text-gray-500 font-medium">No achievements yet!</p>
                        <p className="text-sm text-gray-400">Complete tasks to earn your first badge.</p>
                      </div>
                    ) : (
                      achievements.map((achievement: any) => (
                        <div key={achievement.id} className="flex items-center space-x-3 p-3 bg-yellow-50 rounded-xl hover:bg-yellow-100 transition-colors">
                          <div className="w-10 h-10 bg-accent rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-lg">{achievement.icon}</span>
                          </div>
                          <div className="flex-1">
                            <p className="font-black text-gray-900">{achievement.title}</p>
                            <p className="text-sm text-gray-600 font-medium">{achievement.description}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      {/* Modals */}
      <JobCreationModal isOpen={showJobModal} onClose={() => setShowJobModal(false)} />
      <PaymentApprovalModal
        isOpen={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false);
          setSelectedJobForPayment(null);
        }}
        job={selectedJobForPayment}
      />
      <AccountTypesModal
        isOpen={showAccountTypesModal}
        onClose={() => setShowAccountTypesModal(false)}
      />
      <SavingsGoalsModal
        isOpen={showSavingsGoalModal}
        onClose={() => setShowSavingsGoalModal(false)}
      />
    </main>
  );
}
