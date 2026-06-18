import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { JobCreationModal } from "@/components/job-creation-modal";
import { DailyBriefButton } from "@/components/daily-brief";
import { PaymentApprovalModal } from "@/components/payment-approval-modal";
import { AllowancePayoutPanel } from "@/components/allowance-payout-panel";
import { JobIcon } from "@/components/job-icon";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useKidMode } from "@/hooks/use-kid-mode";
import { IconText } from "@/components/icon-text";
import { youngestJobStatus } from "@/lib/youngest-ui";
import { groupJobsByCategory, type JobCategoryRow } from "@/lib/job-category-groups";
import type { AccountTypesRow, ChildRow, JobRow, PaymentRow } from "@/lib/api-types";
import { taskLabels } from "@/lib/task-labels";
import { PageHeader } from "@/components/page-shell";
import { needsPaymentModal, taskPayKind, taskPayLabel } from "@/lib/task-pay-type";
import { CurrencyInput, isValidCurrencyAmount } from "@/components/currency-input";
import { Search, Edit, Trash2, Calendar, DollarSign, User, Eye } from "lucide-react";

function parseMutationError(err: unknown, fallback: string): string {
  if (!err || typeof err !== "object") return fallback;
  const msg = typeof (err as { message?: unknown }).message === "string" ? (err as { message: string }).message : "";
  const parts = msg.split(": ");
  const maybeBody = parts.length > 1 ? parts.slice(1).join(": ") : msg;
  try {
    const parsed = JSON.parse(maybeBody) as { message?: unknown };
    if (parsed && typeof parsed.message === "string") return parsed.message;
  } catch {
    // ignore
  }
  return maybeBody || fallback;
}

function isFamilyDuty(job: { isFamilyDuty?: boolean | null }): boolean {
  return !!job.isFamilyDuty;
}

function jobPayLabel(job: { allowanceId?: number | null; isFamilyDuty?: boolean | null; amount: string }): string {
  if (isFamilyDuty(job)) return "Family";
  if (job.allowanceId) return "—";
  return `$${parseFloat(job.amount).toFixed(2)}`;
}

export default function Jobs() {
  const { user } = useAuth();
  const { mode: kidMode } = useKidMode();
  const isYoungestChild = user?.role === "child" && kidMode === "youngest";
  const [showJobModal, setShowJobModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [selectedJobs, setSelectedJobs] = useState<number[]>([]);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [editingPayment, setEditingPayment] = useState(false);
  const [paymentAllocation, setPaymentAllocation] = useState({
    spendingAmount: 0,
    savingsAmount: 0,
    rothIraAmount: 0,
    brokerageAmount: 0,
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [childFilter, setChildFilter] = useState("all");
  const [sortBy, setSortBy] = useState("recent");
  const [activeTab, setActiveTab] = useState("active");
  const [location] = useLocation();
  const paymentsSectionRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const labels = taskLabels(user?.role === "parent" ? "parent" : "child", kidMode);
  const isParent = user?.role === "parent";

  const openEditJob = (job: JobRow) => {
    setSelectedJob(job);
    setEditingPayment(false);
    setShowEditModal(true);
  };

  // Force refresh all data on component mount to sync with database
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
    queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
    queryClient.invalidateQueries({ queryKey: ["/api/children"] });
  }, [queryClient]);

  const { data: jobs, isLoading } = useQuery<JobRow[]>({
    queryKey: ["/api/jobs"],
  });

  const { data: children } = useQuery<ChildRow[]>({
    queryKey: ["/api/children"],
  });

  const { data: jobCategories = [] } = useQuery<JobCategoryRow[]>({
    queryKey: ["/api/job-categories"],
  });

  const { data: accountTypes } = useQuery<AccountTypesRow>({
    queryKey: [`/api/account-types/${user?.familyId}`],
    enabled: !!user?.familyId,
  });

  // Fetch payment data for the selected job when editing
  const { data: existingPayment } = useQuery<PaymentRow>({
    queryKey: [`/api/payments/job/${selectedJob?.id}`],
    enabled: !!selectedJob?.id && selectedJob?.status === "approved" && editingPayment,
  });

  useEffect(() => {
    if (!editingPayment || !existingPayment) return;
    setPaymentAllocation({
      spendingAmount: parseFloat(existingPayment.spendingAmount || "0"),
      savingsAmount: parseFloat(existingPayment.savingsAmount || "0"),
      rothIraAmount: parseFloat(existingPayment.rothIraAmount || "0"),
      brokerageAmount: parseFloat(existingPayment.brokerageAmount || "0"),
    });
  }, [editingPayment, existingPayment]);

  const { data: payments } = useQuery<PaymentRow[]>({
    queryKey: ["/api/payments"],
  });

  const updateJobMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: number; [key: string]: any }) =>
      apiRequest("PATCH", `/api/jobs/${id}`, data),
    onSuccess: (_, variables) => {
      // When a job is approved, a payment is created, so invalidate all related data
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/children"] });
      
      // If job was approved, also invalidate payment-specific queries
      if (variables.status === "approved") {
        queryClient.invalidateQueries({ queryKey: [`/api/payments/job/${variables.id}`] });
        queryClient.invalidateQueries({ queryKey: ["/api/allowances/period-status"] });
      }
      
      toast({
        title: "Success!",
        description: "Task updated successfully",
      });
    },
    onError: (err) => {
      toast({
        title: "Error",
        description: parseMutationError(err, "Failed to update task"),
        variant: "destructive",
      });
    },
  });

  const deleteJobMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("DELETE", `/api/jobs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      toast({
        title: "Success!",
        description: "Task deleted successfully",
      });
    },
    onError: (err) => {
      toast({
        title: "Error",
        description: parseMutationError(err, "Failed to delete task"),
        variant: "destructive",
      });
    },
  });

  const markMissedMutation = useMutation({
    mutationFn: (jobId: number) => apiRequest("POST", `/api/jobs/${jobId}/missed`, {}),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/allowances"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/allowances/period-status"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: "Marked missed", description: "This will count toward the next allowance penalty." });
    },
    onError: (err: any) => {
      try {
        const msg = typeof err?.message === "string" ? err.message : "";
        const parts = msg.split(": ");
        const maybeBody = parts.length > 1 ? parts.slice(1).join(": ") : msg;
        const parsed = JSON.parse(maybeBody);
        if (parsed && typeof parsed.message === "string") {
          toast({ title: "Error", description: parsed.message, variant: "destructive" });
          return;
        }
      } catch {
        // ignore
      }
      toast({ title: "Error", description: "Failed to mark missed", variant: "destructive" });
    },
  });

  const updatePaymentMutation = useMutation({
    mutationFn: ({ jobId, allocation }: { jobId: number; allocation: any }) =>
      apiRequest("PATCH", `/api/payments/job/${jobId}`, allocation),
    onSuccess: (_, variables) => {
      // Invalidate all payment-related queries
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: [`/api/payments/job/${variables.jobId}`] });
      
      // Invalidate job data to update payment status
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      
      // Invalidate dashboard stats to reflect new balances
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      
      // Invalidate children data to update total earned amounts
      queryClient.invalidateQueries({ queryKey: ["/api/children"] });
      
      // Invalidate family-level queries that aggregate payment data
      queryClient.invalidateQueries({ queryKey: ["/api/family"] });
      
      // Invalidate any allocation-related queries
      queryClient.invalidateQueries({ predicate: (query) => {
        const firstKey = query.queryKey[0];
        return firstKey ? firstKey.toString().includes('/api/allocation') : false;
      }});
      
      toast({
        title: "Success!",
        description: "Payment allocation updated successfully",
      });
    },
    onError: (err) => {
      toast({
        title: "Error",
        description: parseMutationError(err, "Failed to update payment allocation"),
        variant: "destructive",
      });
    },
  });

  const handleJobAction = (jobId: number, status: string) => {
    updateJobMutation.mutate({ id: jobId, status });
  };

  const handleDeleteJob = (jobId: number) => {
    if (confirm(`Are you sure you want to delete this ${labels.singular}?`)) {
      deleteJobMutation.mutate(jobId);
    }
  };

  const getStatusBadge = (status: string) => {
    if (isYoungestChild) {
      const { icon, label } = youngestJobStatus(status);
      return (
        <Badge variant="outline" className="bg-gray-50 text-gray-800 border-gray-200 text-sm font-bold gap-1">
          <span aria-hidden>{icon}</span>
          {label}
        </Badge>
      );
    }
    switch (status) {
      case "assigned":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Assigned</Badge>;
      case "in_progress":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">In Progress</Badge>;
      case "completed":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Awaiting Approval</Badge>;
      case "approved":
        return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Approved</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getChildName = (childId: number) => {
    if (!children || !Array.isArray(children)) return "Unknown";
    const child = children.find((c: any) => c.id === childId);
    return child?.name || "Unknown";
  };

  const exportCompletedTasksCsv = () => {
    if (completedJobs.length === 0) return;
    try {
      const csvData = completedJobs.map((job: JobRow) => ({
        Title: job.title,
        Description: job.description || "",
        Child: getChildName(job.assignedToId),
        Status: job.status,
        "Pay type": taskPayLabel(job),
        Amount: isFamilyDuty(job) || job.allowanceId ? "" : parseFloat(job.amount || "0").toFixed(2),
        Recurrence: job.recurrence,
        Date: new Date(job.createdAt ?? Date.now()).toLocaleDateString(),
      }));

      const headers = Object.keys(csvData[0] || {});
      const csvContent = [
        headers.join(","),
        ...csvData.map((row: Record<string, string>) =>
          headers.map((header) => `"${String(row[header] ?? "").replace(/"/g, '""')}"`).join(","),
        ),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      const stamp = new Date().toISOString().slice(0, 10);
      link.setAttribute("href", url);
      link.setAttribute("download", `mintsprout-completed-tasks-${stamp}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Exported",
        description: `Downloaded ${completedJobs.length} completed ${labels.plural} as CSV.`,
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to export task data",
        variant: "destructive",
      });
    }
  };

  const filterJobs = (jobsList: any[]) => {
    if (!jobsList) return [];
    
    return jobsList.filter(job => {
      const matchesSearch = job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (job.description ?? "").toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "all" || job.status === statusFilter;
      const matchesChild = childFilter === "all" || job.assignedToId.toString() === childFilter;
      
      return matchesSearch && matchesStatus && matchesChild;
    });
  };

  const sortJobs = (jobsList: any[]) => {
    if (!jobsList) return [];
    
    return [...jobsList].sort((a, b) => {
      switch (sortBy) {
        case "recent":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "amount":
          return parseFloat(b.amount) - parseFloat(a.amount);
        case "name":
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });
  };

  const activeJobs = jobs && Array.isArray(jobs) ? sortJobs(filterJobs(jobs.filter((job: any) => 
    ["assigned", "in_progress"].includes(job.status)
  ))) : [];

  const awaitingApprovalJobs = jobs && Array.isArray(jobs) ? sortJobs(filterJobs(jobs.filter((job: any) =>
    job.status === "completed"
  ))) : [];

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (params.get("view") === "payments") {
      if (isParent && jobs) {
        const awaitingCount = jobs.filter((j: JobRow) => j.status === "completed").length;
        if (awaitingCount > 0) setActiveTab("awaiting");
      }
      requestAnimationFrame(() => {
        paymentsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      return;
    }

    const tabParam = params.get("tab");
    if (tabParam === "active" || tabParam === "awaiting" || tabParam === "completed") {
      if (tabParam === "awaiting" && !isParent) {
        setActiveTab("active");
      } else if (tabParam === "completed" && isYoungestChild) {
        setActiveTab("active");
      } else {
        setActiveTab(tabParam);
      }
      return;
    }

    if (params.get("filter") === "awaiting") {
      setActiveTab("awaiting");
    }
  }, [isParent, isYoungestChild, jobs, location]);

  const activeFamilyDuties = activeJobs.filter((job: any) => isFamilyDuty(job));
  const activePaidJobs = activeJobs.filter((job: any) => !isFamilyDuty(job));
  const activeJobGroups = useMemo(
    () => groupJobsByCategory(activeJobs, jobCategories),
    [activeJobs, jobCategories],
  );

  const completedJobs = jobs && Array.isArray(jobs) ? sortJobs(filterJobs(jobs.filter((job: any) => 
    job.status === "approved"
  ))) : [];

  const getJobStats = () => {
    if (!jobs || !Array.isArray(jobs)) return { total: 0, pending: 0, completed: 0, totalEarnings: 0 };
    
    const pending = jobs.filter((job: any) => ["assigned", "in_progress"].includes(job.status)).length;
    const awaiting = jobs.filter((job: any) => job.status === "completed").length;
    const completed = jobs.filter((job: any) => job.status === "approved").length;
    const totalEarnings = jobs
      .filter((job: any) => job.status === "approved" && !isFamilyDuty(job))
      .reduce((sum: number, job: any) => sum + parseFloat(job.amount), 0);
      
    return {
      total: jobs.length,
      pending,
      awaiting,
      completed,
      totalEarnings
    };
  };

  const stats = getJobStats();

  const renderJobCard = (job: any, bulkSelect?: boolean) => (
    <Card key={job.id} className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-3">
            {bulkSelect && user?.role === "parent" && (
              <input
                type="checkbox"
                checked={selectedJobs.includes(job.id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedJobs((prev) => [...prev, job.id]);
                  } else {
                    setSelectedJobs((prev) => prev.filter((id) => id !== job.id));
                  }
                }}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-1"
              />
            )}
            <JobIcon iconName={job.icon} className="h-6 w-6 text-gray-600" />
            <div className="flex-1">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-gray-900">{job.title}</h3>
                <div className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium flex items-center ml-2 shrink-0">
                  <User className="h-3 w-3 mr-1" />
                  {getChildName(job.assignedToId)}
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-2">{job.description}</p>
              <div className="flex items-center space-x-4">
                <span className="text-xs text-gray-500 flex items-center">
                  <Calendar className="h-3 w-3 mr-1" />
                  {new Date(job.createdAt).toLocaleDateString()}
                </span>
                {job.allowanceId && (
                  <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold">
                    {taskPayLabel(job)}
                  </span>
                )}
                {!job.allowanceId && !isFamilyDuty(job) && parseFloat(job.amount || "0") > 0 && (
                  <span className="text-xs bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full font-semibold">
                    {taskPayLabel(job)}
                  </span>
                )}
                {isFamilyDuty(job) && (
                  <span className="text-xs bg-sky-50 text-sky-700 border border-sky-200 px-2 py-0.5 rounded-full font-semibold">
                    {taskPayLabel(job)}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="text-right ml-4">
            <div className="text-lg font-bold text-primary mb-1">
              {jobPayLabel(job)}
            </div>
            {getStatusBadge(job.status)}
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex space-x-2">
            {job.status === "assigned" && user?.role === "child" && (
              <Button
                size={isYoungestChild ? "lg" : "sm"}
                onClick={() => handleJobAction(job.id, "in_progress")}
                className={isYoungestChild ? "w-full h-14" : "text-xs"}
              >
                {isYoungestChild ? <IconText icon="🚀" label="Start" size="md" /> : labels.start}
              </Button>
            )}
            {job.status === "in_progress" && user?.role === "child" && (
              <Button
                size={isYoungestChild ? "lg" : "sm"}
                onClick={() => handleJobAction(job.id, "completed")}
                className={isYoungestChild ? "w-full h-14" : "text-xs"}
              >
                {isYoungestChild ? <IconText icon="✅" label="Done!" size="md" /> : "Mark Complete"}
              </Button>
            )}
            {job.status === "completed" && user?.role === "parent" && (
              (taskPayKind(job) === "allowance" ? (
                <Button
                  size="sm"
                  onClick={() => handleJobAction(job.id, "approved")}
                  className="text-xs"
                  disabled={updateJobMutation.isPending}
                >
                  {labels.approveAllowance}
                </Button>
              ) : taskPayKind(job) === "family_duty" ? (
                <Button
                  size="sm"
                  onClick={() => handleJobAction(job.id, "approved")}
                  className="text-xs"
                  disabled={updateJobMutation.isPending}
                >
                  {labels.approve}
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => {
                    setSelectedJob(job);
                    setShowPaymentModal(true);
                  }}
                  className="text-xs"
                >
                  {labels.approvePay}
                </Button>
              ))
            )}
            {user?.role === "parent" && job.allowanceId && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => markMissedMutation.mutate(job.id)}
                disabled={markMissedMutation.isPending}
                className="text-xs"
              >
                Mark missed today
              </Button>
            )}
          </div>
          
          {user?.role === "parent" && job.status !== "approved" && (
            <div className="flex space-x-1">
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => openEditJob(job)}
                className="text-xs px-2"
              >
                <Edit className="h-3 w-3" />
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => handleDeleteJob(job.id)}
                className="text-xs px-2 text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <PageHeader
        title={isParent ? labels.pageTitleParent : labels.pageTitle}
        actions={
          isParent ? (
            <Button onClick={() => setShowJobModal(true)} className="mint-primary mint-button w-full sm:w-auto">
              ➕ {labels.create}
            </Button>
          ) : (
            <DailyBriefButton />
          )
        }
      />

      {/* Stats Cards */}
      {user?.role === "parent" && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.pending}</div>
              <div className="text-sm text-gray-600">{labels.activeSection}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">{stats.awaiting}</div>
              <div className="text-sm text-gray-600">{labels.awaitingApproval}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
              <div className="text-sm text-gray-600">{labels.history}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-primary">${stats.totalEarnings.toFixed(2)}</div>
              <div className="text-sm text-gray-600">Total Paid</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">{children && Array.isArray(children) ? children.length : 0}</div>
              <div className="text-sm text-gray-600">Children</div>
            </CardContent>
          </Card>
        </div>
      )}

      {isParent && (
        <div ref={paymentsSectionRef}>
          <AllowancePayoutPanel
            onApproveJob={(jobId) => handleJobAction(jobId, "approved")}
            onMarkMissed={(jobId) => markMissedMutation.mutate(jobId)}
            approvePending={updateJobMutation.isPending}
            markMissedPending={markMissedMutation.isPending}
          />
        </div>
      )}

      {/* Filters and Search */}
      {!isYoungestChild && (
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder={`Search ${labels.plural}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="assigned">Assigned</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Awaiting Approval</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
            </SelectContent>
          </Select>
          {user?.role === "parent" && children && Array.isArray(children) && children.length > 0 && (
            <Select value={childFilter} onValueChange={setChildFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by child" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Children</SelectItem>
                {children.map((child: any) => (
                  <SelectItem key={child.id} value={child.id.toString()}>
                    {child.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Most Recent</SelectItem>
              <SelectItem value="amount">Highest Amount</SelectItem>
              <SelectItem value="name">Alphabetical</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Task Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList
          className={
            isYoungestChild
              ? "grid w-full h-auto grid-cols-1 gap-1"
              : isParent
                ? "grid w-full h-auto grid-cols-1 min-[420px]:grid-cols-3 gap-1"
                : "grid w-full h-auto grid-cols-2 gap-1"
          }
        >
          <TabsTrigger value="active">{labels.active} ({activeJobs.length})</TabsTrigger>
          {isParent && (
            <TabsTrigger value="awaiting">
              {labels.awaitingApproval} ({awaitingApprovalJobs.length})
            </TabsTrigger>
          )}
          {!isYoungestChild && (
            <TabsTrigger value="completed">{labels.history} ({completedJobs.length})</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="awaiting" className="mt-6">
          {awaitingApprovalJobs.length > 0 ? (
            <div className="space-y-4">
              {user?.role === "parent" && (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:space-x-4 min-w-0">
                    <div className="text-sm text-gray-600 break-words">
                      <strong>{awaitingApprovalJobs.length}</strong> {labels.plural} awaiting approval
                    </div>
                    {selectedJobs.length > 0 && (
                      <div className="text-sm text-blue-600 font-medium">
                        {selectedJobs.length} selected
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setShowBulkActions(!showBulkActions);
                        if (showBulkActions) setSelectedJobs([]);
                      }}
                      className="text-xs"
                    >
                      {showBulkActions ? "Cancel Selection" : "Select Multiple"}
                    </Button>
                    {selectedJobs.length > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const awaitingIds = selectedJobs.filter((jobId) => {
                            const job = jobs?.find((j: JobRow) => j.id === jobId);
                            return job?.status === "completed";
                          });
                          if (awaitingIds.length === 0) {
                            toast({
                              title: "Nothing to approve",
                              description: `Select ${labels.plural} awaiting approval.`,
                              variant: "destructive",
                            });
                            return;
                          }
                          awaitingIds.forEach((jobId) => handleJobAction(jobId, "approved"));
                          setSelectedJobs([]);
                          setShowBulkActions(false);
                        }}
                        className="text-xs"
                        disabled={updateJobMutation.isPending}
                      >
                        Approve Selected
                      </Button>
                    )}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {awaitingApprovalJobs.map((job: JobRow) => renderJobCard(job, showBulkActions))}
              </div>
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <h3 className="text-lg font-medium text-gray-900 mb-2">All caught up!</h3>
                <p className="text-gray-600">No tasks waiting for your approval.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        <TabsContent value="active" className="mt-6">
          {activeJobs.length > 0 ? (
            user?.role === "child" ? (
              <div className="space-y-8">
                {activeJobGroups.length > 0
                  ? activeJobGroups.map((group) => (
                      <div key={group.label}>
                        <h2 className="text-lg font-bold text-gray-900 mb-1 flex items-center gap-2">
                          <JobIcon iconName={group.icon} className="h-5 w-5" />
                          {group.label}
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {group.jobs.map((job: JobRow) => renderJobCard(job))}
                        </div>
                      </div>
                    ))
                  : (
                    <>
                {activeFamilyDuties.length > 0 && (
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 mb-1">🏠 Part of the family</h2>
                    <p className="text-sm text-gray-500 mb-4">Things you do because you live here — no pay, just pride!</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {activeFamilyDuties.map((job: JobRow) => renderJobCard(job))}
                    </div>
                  </div>
                )}
                {activePaidJobs.length > 0 && (
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 mb-1">💰 Earn money</h2>
                    <p className="text-sm text-gray-500 mb-4">Tasks that pay when you finish them.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {activePaidJobs.map((job: JobRow) => renderJobCard(job))}
                    </div>
                  </div>
                )}
                    </>
                  )}
              </div>
            ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeJobs.map((job: JobRow) => renderJobCard(job))}
            </div>
            )
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="text-gray-400 mb-4">
                  <DollarSign className="h-12 w-12 mx-auto" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">{labels.noActive}</h3>
                <p className="text-gray-500 mb-4">
                  {user?.role === "parent" 
                    ? `Create new ${labels.plural} to get started with earning opportunities for your children.`
                    : `No ${labels.plural} have been assigned to you yet. Check back later!`}
                </p>
                {user?.role === "parent" && (
                  <Button onClick={() => setShowJobModal(true)} className="mint-primary">
                    {labels.createFirst}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        {!isYoungestChild && (
        <TabsContent value="completed" className="mt-6">
          {completedJobs.length > 0 ? (
            <div className="space-y-4">
              {user?.role === "parent" && (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 bg-gray-50 rounded-lg mb-4">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:space-x-4 min-w-0">
                    <div className="text-sm text-gray-600 break-words">
                      <strong>{completedJobs.length}</strong> completed {labels.plural} • Total paid: <strong>${completedJobs.reduce((sum: number, job: any) => sum + parseFloat(job.amount), 0).toFixed(2)}</strong>
                    </div>
                    {selectedJobs.length > 0 && (
                      <div className="text-sm text-blue-600 font-medium">
                        {selectedJobs.length} selected
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setShowBulkActions(!showBulkActions)}
                      className="text-xs"
                    >
                      {showBulkActions ? "Cancel Selection" : "Select Multiple"}
                    </Button>
                    {selectedJobs.length > 0 && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          if (window.confirm(`Delete ${selectedJobs.length} selected ${labels.plural}? This action cannot be undone.`)) {
                            selectedJobs.forEach(jobId => handleDeleteJob(jobId));
                            setSelectedJobs([]);
                            setShowBulkActions(false);
                          }
                        }}
                        className="text-xs text-red-600 hover:text-red-700"
                      >
                        Delete Selected ({selectedJobs.length})
                      </Button>
                    )}
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        if (window.confirm(`Export ${completedJobs.length} completed ${labels.plural} to CSV?`)) {
                          exportCompletedTasksCsv();
                        }
                      }}
                      className="text-xs"
                    >
                      Export Data
                    </Button>
                  </div>
                </div>
              )}
              {completedJobs.map((job: any) => (
                <Card key={job.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        {showBulkActions && user?.role === "parent" && (
                          <input
                            type="checkbox"
                            checked={selectedJobs.includes(job.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedJobs(prev => [...prev, job.id]);
                              } else {
                                setSelectedJobs(prev => prev.filter(id => id !== job.id));
                              }
                            }}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        )}
                        <JobIcon iconName={job.icon} className="h-5 w-5 text-gray-500" />
                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-medium text-gray-900">{job.title}</h4>
                            <div className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium flex items-center ml-2 shrink-0">
                              <User className="h-3 w-3 mr-1" />
                              {getChildName(job.assignedToId)}
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{job.description}</p>
                          <div className="flex items-center space-x-4">
                            <span className="text-xs text-gray-500 flex items-center">
                              <Calendar className="h-3 w-3 mr-1" />
                              Completed {new Date(job.createdAt ?? Date.now()).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <div className="text-lg font-bold text-green-600 mb-1">
                            ${parseFloat(job.amount).toFixed(2)}
                          </div>
                          {getStatusBadge(job.status)}
                        </div>
                        {user?.role === "parent" && (
                          <div className="flex space-x-2">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => {
                                setSelectedJob(job);
                                setShowPaymentModal(true);
                              }}
                              className="text-xs px-3"
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              View Details
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => openEditJob(job)}
                              className="text-xs px-3"
                            >
                              <Edit className="h-3 w-3 mr-1" />
                              Edit
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => {
                                if (window.confirm(`Are you sure you want to remove "${job.title}" from the job history? This action cannot be undone.`)) {
                                  handleDeleteJob(job.id);
                                }
                              }}
                              className="text-xs px-3 text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              Remove
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="text-gray-400 mb-4">
                  <Calendar className="h-12 w-12 mx-auto" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No completed {labels.plural}</h3>
                <p className="text-gray-500">
                  Completed and approved {labels.plural} will appear here.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        )}
      </Tabs>

      {/* Modals */}
      <JobCreationModal isOpen={showJobModal} onClose={() => setShowJobModal(false)} />
      <PaymentApprovalModal 
        isOpen={showPaymentModal} 
        onClose={() => {
          setShowPaymentModal(false);
          setSelectedJob(null);
        }} 
        job={selectedJob}
      />
      
      {/* Enhanced Edit Dialog */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Edit task {selectedJob?.status === "approved" ? "(Completed)" : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto flex-1 pr-2">
            <div>
              <label className="block text-sm font-medium mb-2">Title</label>
              <Input 
                value={selectedJob?.title || ""} 
                onChange={(e) => setSelectedJob((prev: any) => ({ ...prev, title: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Description</label>
              <Input 
                value={selectedJob?.description || ""} 
                onChange={(e) => setSelectedJob((prev: any) => ({ ...prev, description: e.target.value }))}
              />
            </div>
            {selectedJob && taskPayKind(selectedJob) === "one_time" && (
              <div>
                <label className="block text-sm font-medium mb-2">Payment amount</label>
                <CurrencyInput
                  value={selectedJob.amount || ""}
                  onChange={(value) => setSelectedJob((prev: any) => ({ ...prev, amount: value }))}
                />
                {selectedJob.status === "approved" ? (
                  <p className="text-xs text-orange-600 mt-1">
                    Changing the amount of a completed task will not update payment balances
                  </p>
                ) : (
                  <p className="text-xs text-gray-500 mt-1">
                    This amount will be used when you approve payment.
                  </p>
                )}
              </div>
            )}
            
            {selectedJob?.status === "approved" && (
              <div className="space-y-3">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-sm text-yellow-800">
                    <strong>Note:</strong> This is a completed job. You can edit job details or payment allocations.
                  </p>
                </div>
                
                <div className="flex space-x-2">
                  <Button 
                    size="sm" 
                    variant={!editingPayment ? "default" : "outline"}
                    onClick={() => setEditingPayment(false)}
                    className="text-xs"
                  >
                    Task details
                  </Button>
                  <Button 
                    size="sm" 
                    variant={editingPayment ? "default" : "outline"}
                    onClick={() => setEditingPayment(true)}
                    className="text-xs"
                  >
                    Payment Allocation
                  </Button>
                </div>

                {editingPayment && (
                  <div className="space-y-4 border-t pt-4">
                    <h4 className="font-medium text-gray-900">Edit Payment Allocation</h4>
                    <div className="grid grid-cols-2 gap-4">
                      {accountTypes?.spendingEnabled && (
                        <div>
                          <label className="block text-sm font-medium mb-1">Spending ($)</label>
                          <Input 
                            type="number"
                            step="0.01"
                            value={paymentAllocation.spendingAmount} 
                            onChange={(e) => setPaymentAllocation(prev => ({ 
                              ...prev, 
                              spendingAmount: parseFloat(e.target.value) || 0 
                            }))}
                          />
                        </div>
                      )}
                      {accountTypes?.savingsEnabled && (
                        <div>
                          <label className="block text-sm font-medium mb-1">Savings ($)</label>
                          <Input 
                            type="number"
                            step="0.01"
                            value={paymentAllocation.savingsAmount} 
                            onChange={(e) => setPaymentAllocation(prev => ({ 
                              ...prev, 
                              savingsAmount: parseFloat(e.target.value) || 0 
                            }))}
                          />
                        </div>
                      )}
                      {accountTypes?.rothIraEnabled && (
                        <div>
                          <label className="block text-sm font-medium mb-1">Roth IRA ($)</label>
                          <Input 
                            type="number"
                            step="0.01"
                            value={paymentAllocation.rothIraAmount} 
                            onChange={(e) => setPaymentAllocation(prev => ({ 
                              ...prev, 
                              rothIraAmount: parseFloat(e.target.value) || 0 
                            }))}
                          />
                        </div>
                      )}
                      {accountTypes?.brokerageEnabled && (
                        <div>
                          <label className="block text-sm font-medium mb-1">Brokerage ($)</label>
                          <Input 
                            type="number"
                            step="0.01"
                            value={paymentAllocation.brokerageAmount} 
                            onChange={(e) => setPaymentAllocation(prev => ({ 
                              ...prev, 
                              brokerageAmount: parseFloat(e.target.value) || 0 
                            }))}
                          />
                        </div>
                      )}
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <p className="text-sm text-gray-600">
                        Total: ${(paymentAllocation.spendingAmount + paymentAllocation.savingsAmount + paymentAllocation.rothIraAmount + paymentAllocation.brokerageAmount).toFixed(2)} 
                        {selectedJob && ` of $${parseFloat(selectedJob.amount).toFixed(2)}`}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
            
          </div>
          <div className="flex justify-end space-x-2 pt-4 border-t bg-white dark:bg-gray-800 mt-auto">
              <Button variant="outline" onClick={() => setShowEditModal(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => {
                  if (editingPayment) {
                    const total = paymentAllocation.spendingAmount + paymentAllocation.savingsAmount + 
                                 paymentAllocation.rothIraAmount + paymentAllocation.brokerageAmount;
                    const jobAmount = parseFloat(selectedJob.amount);
                    
                    if (Math.abs(total - jobAmount) > 0.01) {
                      toast({
                        title: "Invalid Allocation",
                        description: `Total allocation ($${total.toFixed(2)}) must equal task amount ($${jobAmount.toFixed(2)})`,
                        variant: "destructive",
                      });
                      return;
                    }
                    
                    updatePaymentMutation.mutate(
                      {
                        jobId: selectedJob.id,
                        allocation: paymentAllocation,
                      },
                      {
                        onSuccess: () => {
                          setShowEditModal(false);
                          setEditingPayment(false);
                        },
                      },
                    );
                  } else {
                    if (taskPayKind(selectedJob) === "one_time" && !isValidCurrencyAmount(selectedJob.amount || "")) {
                      toast({
                        title: "Invalid amount",
                        description: "Enter a valid payment amount for this task",
                        variant: "destructive",
                      });
                      return;
                    }

                    const payload: Record<string, unknown> = {
                      id: selectedJob.id,
                      title: selectedJob.title,
                      description: selectedJob.description,
                    };
                    if (taskPayKind(selectedJob) === "one_time") {
                      payload.amount = parseFloat(selectedJob.amount).toFixed(2);
                    }

                    updateJobMutation.mutate(payload as { id: number; [key: string]: unknown }, {
                      onSuccess: () => {
                        setShowEditModal(false);
                        setEditingPayment(false);
                      },
                    });
                  }
                }}
                disabled={updateJobMutation.isPending || updatePaymentMutation.isPending}
              >
                {(updateJobMutation.isPending || updatePaymentMutation.isPending) ? "Saving..." : 
                 editingPayment ? "Update Payment" : "Save Changes"}
              </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
