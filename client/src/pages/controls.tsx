import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { IconSelector } from "@/components/icon-selector";
import { JobIcon } from "@/components/job-icon";
import { PAYMENT_MODE_LABELS, categoryPaymentLabel, isFlexiblePayCategory } from "@shared/job-categories";
import type { JobCategoryPaymentMode } from "@shared/job-categories";
import { LESSON_CATEGORY_KEYS, LESSON_CATEGORY_LABELS } from "@shared/catalog/types";
import { CatalogEditor } from "@/components/catalog-editor";
import { AppSettingsPanel } from "@/components/app-settings-panel";
import { DayOfWeekSelect } from "@/components/day-of-week-select";
import { dayOfWeekLabel, periodEndDayOfWeek, periodStartDayOfWeek, payDayOfWeek } from "@shared/allowance-week";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Link } from "wouter";
import { PageHeader, PageShell } from "@/components/page-shell";
import { ChildAllocationForm } from "@/components/child-allocation-form";
import { CurrencyInput } from "@/components/currency-input";

const CONTROLS_TABS = ["approvals", "allowances", "allocation", "jobs", "lessons", "sprout"] as const;
type ControlsTab = (typeof CONTROLS_TABS)[number];

function parseControlsTab(search: string): ControlsTab {
  const tab = new URLSearchParams(search).get("tab");
  if (tab && CONTROLS_TABS.includes(tab as ControlsTab)) return tab as ControlsTab;
  return "approvals";
}

type FamilySettings = {
  familyId: number;
  requireSpendingApproval?: boolean;
  requireDonationApproval?: boolean;
  requireGoalFundingApproval?: boolean;
};

type ApprovalRequest = {
  id: number;
  childId: number;
  type: string;
  amount: string;
  details: string;
  status: string;
  createdAt: string;
};

type Allowance = {
  id: number;
  childId: number;
  amount: string;
  guaranteedMinimum?: string | null;
  penaltyPerIncompleteJob?: string | null;
  cadence: "weekly" | "monthly";
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  periodStartDayOfWeek?: number | null;
  periodEndDayOfWeek?: number | null;
  enabled: boolean;
  payoutMode?: "automatic" | "manual" | null;
  lastRunAt: string | null;
};

type Child = { id: number; name: string; age: number };

type JobCategory = {
  id: number;
  slug?: string | null;
  label: string;
  description?: string | null;
  icon?: string | null;
  sortOrder?: number | null;
  enabled?: boolean | null;
  paymentMode: JobCategoryPaymentMode;
};

function JobCategoryEditor({
  category,
  onSave,
  onDisable,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: {
  category: JobCategory;
  onSave: (updates: Partial<JobCategory>) => void;
  onDisable: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const categoryKey = category.slug ?? `custom_${category.id}`;
  const [label, setLabel] = useState(category.label);
  const [description, setDescription] = useState(category.description ?? "");
  const [icon, setIcon] = useState(category.icon ?? "briefcase");
  const [paymentMode, setPaymentMode] = useState(category.paymentMode);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setLabel(category.label);
    setDescription(category.description ?? "");
    setIcon(category.icon ?? "briefcase");
    setPaymentMode(category.paymentMode);
  }, [category]);

  if (category.enabled === false) return null;

  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-white space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <JobIcon iconName={icon} className="h-6 w-6 text-gray-600 shrink-0" />
          <div className="min-w-0">
            {editing ? (
              <Input className="mint-input font-semibold" value={label} onChange={(e) => setLabel(e.target.value)} />
            ) : (
              <div className="font-semibold text-gray-900 truncate">{category.label}</div>
            )}
            <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full inline-block mt-1">
              {categoryPaymentLabel(category.slug, category.paymentMode)}
            </span>
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button type="button" variant="outline" size="icon" disabled={!canMoveUp} onClick={onMoveUp}>
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" size="icon" disabled={!canMoveDown} onClick={onMoveDown}>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {editing && (
        <>
          <div>
            <Label>Description</Label>
            <Textarea
              className="mt-1"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div>
            <Label>Icon</Label>
            <div className="mt-1">
              <IconSelector selectedIcon={icon} onIconSelect={setIcon} />
            </div>
          </div>
          <div>
            <Label>Payment mode</Label>
            <Select value={paymentMode} onValueChange={(v) => setPaymentMode(v as JobCategoryPaymentMode)}>
              <SelectTrigger className="mint-input mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PAYMENT_MODE_LABELS) as JobCategoryPaymentMode[]).map((mode) => (
                  <SelectItem key={mode} value={mode}>
                    {PAYMENT_MODE_LABELS[mode]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {paymentMode === "standalone" && (
              <p className="text-xs text-gray-500 mt-1">
                One-time pay categories show an amount field when parents create tasks.
              </p>
            )}
            {isFlexiblePayCategory(category.slug) && (
              <p className="text-xs text-gray-500 mt-1">
                Tasks in this category can use any pay type when created — payment mode here is only a default suggestion.
              </p>
            )}
          </div>
        </>
      )}

      <div className="flex flex-wrap gap-2">
        {editing ? (
          <>
            <Button
              type="button"
              className="mint-primary"
              onClick={() => {
                onSave({ label, description, icon, paymentMode });
                setEditing(false);
              }}
            >
              Save
            </Button>
            <Button type="button" variant="outline" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
        <Button type="button" variant="outline" size="sm" className="text-red-600" onClick={onDisable}>
          Disable
        </Button>
      </div>

      <CatalogEditor
        catalogType="job"
        categoryKey={categoryKey}
        categoryId={category.id}
        categoryLabel={category.label}
        compact
        defaultExpanded
      />
    </div>
  );
}

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

function AllowancePenaltyEditor({
  allowance: a,
  childLabel,
  onToggleEnabled,
  onDelete,
  onSave,
  onPayoutModeChange,
  onWeekScheduleChange,
}: {
  allowance: Allowance;
  childLabel: string;
  onToggleEnabled: (enabled: boolean) => void;
  onDelete: () => void;
  onSave: (updates: { guaranteedMinimum: string; penaltyPerIncompleteJob: string }) => void;
  onPayoutModeChange: (mode: "automatic" | "manual") => void;
  onWeekScheduleChange: (updates: {
    periodStartDayOfWeek: number;
    periodEndDayOfWeek: number;
    dayOfWeek: number;
  }) => void;
}) {
  const [g, setG] = useState(() => parseFloat(String(a.guaranteedMinimum ?? "0")).toFixed(2));
  const [p, setP] = useState(() => parseFloat(String(a.penaltyPerIncompleteJob ?? "0")).toFixed(2));
  const payoutMode = a.payoutMode === "manual" ? "manual" : "automatic";
  const weekStart = String(periodStartDayOfWeek(a));
  const weekEnd = String(periodEndDayOfWeek(a));
  const weekPay = String(payDayOfWeek(a));

  useEffect(() => {
    setG(parseFloat(String(a.guaranteedMinimum ?? "0")).toFixed(2));
    setP(parseFloat(String(a.penaltyPerIncompleteJob ?? "0")).toFixed(2));
  }, [a.id, a.guaranteedMinimum, a.penaltyPerIncompleteJob, a.amount]);

  const variableMax = Math.max(0, parseFloat(a.amount || "0") - parseFloat(g || "0"));

  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-white space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-semibold text-gray-900">
            {childLabel} • ${parseFloat(a.amount).toFixed(2)} / {a.cadence}
          </div>
          <div className="text-sm text-gray-600 mt-1">
            {a.cadence === "weekly" ? (
              <>
                Period {dayOfWeekLabel(periodStartDayOfWeek(a), true)}–{dayOfWeekLabel(periodEndDayOfWeek(a), true)} ·
                Pay {dayOfWeekLabel(payDayOfWeek(a))} · Last run:{" "}
                {a.lastRunAt ? new Date(a.lastRunAt).toLocaleString() : "never"}
              </>
            ) : (
              <>
                Day of month: {a.dayOfMonth} · Last run:{" "}
                {a.lastRunAt ? new Date(a.lastRunAt).toLocaleString() : "never"}
              </>
            )}
          </div>
          {a.cadence === "weekly" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 max-w-2xl">
              <DayOfWeekSelect
                label="Period starts"
                value={weekStart}
                onValueChange={(v) =>
                  onWeekScheduleChange({
                    periodStartDayOfWeek: parseInt(v, 10),
                    periodEndDayOfWeek: parseInt(weekEnd, 10),
                    dayOfWeek: parseInt(weekPay, 10),
                  })
                }
              />
              <DayOfWeekSelect
                label="Period ends"
                value={weekEnd}
                onValueChange={(v) =>
                  onWeekScheduleChange({
                    periodStartDayOfWeek: parseInt(weekStart, 10),
                    periodEndDayOfWeek: parseInt(v, 10),
                    dayOfWeek: parseInt(weekPay, 10),
                  })
                }
              />
              <DayOfWeekSelect
                label="Pay day"
                value={weekPay}
                onValueChange={(v) =>
                  onWeekScheduleChange({
                    periodStartDayOfWeek: parseInt(weekStart, 10),
                    periodEndDayOfWeek: parseInt(weekEnd, 10),
                    dayOfWeek: parseInt(v, 10),
                  })
                }
              />
            </div>
          )}
          <p className="text-xs text-gray-500 mt-2">
            Each job still <strong>not approved</strong> (assigned, in progress, or completed waiting on you) in the
            period before payout reduces the <strong>non-guaranteed</strong> part by the penalty{" "}
            {`(up to $${variableMax.toFixed(2)} max reduction this week).`}
          </p>
          <div className="mt-3 max-w-md">
            <Label className="text-sm">Payout mode</Label>
            <Select value={payoutMode} onValueChange={(v) => onPayoutModeChange(v as "automatic" | "manual")}>
              <SelectTrigger className="mint-input mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="automatic">Automatic — pays on schedule (early pay optional)</SelectItem>
                <SelectItem value="manual">Manual — you pay from Tasks &amp; Payments</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <Label className="text-sm">Enabled</Label>
            <Switch checked={!!a.enabled} onCheckedChange={onToggleEnabled} />
          </div>
          <Button variant="outline" className="text-red-600 hover:text-red-700" onClick={onDelete}>
            Delete
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
        <div>
          <Label>Guaranteed minimum ($)</Label>
          <CurrencyInput className="mt-1" value={g} onChange={setG} placeholder="0.00" />
        </div>
        <div>
          <Label>Penalty / incomplete job ($)</Label>
          <CurrencyInput className="mt-1" value={p} onChange={setP} placeholder="0.00" />
        </div>
        <Button className="mint-primary" type="button" onClick={() => onSave({ guaranteedMinimum: g, penaltyPerIncompleteJob: p })}>
          Save rules
        </Button>
      </div>
    </div>
  );
}

export default function Controls() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<ControlsTab>(() =>
    parseControlsTab(typeof window !== "undefined" ? window.location.search : ""),
  );

  useEffect(() => {
    const onPop = () => setActiveTab(parseControlsTab(window.location.search));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const handleTabChange = (value: string) => {
    const tab = value as ControlsTab;
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState({}, "", url.pathname + url.search);
  };

  const familyId = user?.familyId;
  const enabled = user?.role === "parent" && !!familyId;

  const { data: children = [] } = useQuery<Child[]>({
    queryKey: ["/api/children"],
    enabled,
  });

  const { data: settings } = useQuery<FamilySettings>({
    queryKey: ["/api/family-settings", familyId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/family-settings/${familyId}`);
      return await res.json();
    },
    enabled,
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: Partial<FamilySettings>) => {
      const res = await apiRequest("PUT", `/api/family-settings/${familyId}`, updates);
      return await res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/family-settings", familyId] });
      toast({ title: "Saved", description: "Settings updated." });
    },
    onError: (err) => toast({ title: "Error", description: errorMessage(err), variant: "destructive" }),
  });

  const { data: pendingRequests = [] } = useQuery<ApprovalRequest[]>({
    queryKey: ["/api/approval-requests", "pending"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/approval-requests?status=pending");
      return await res.json();
    },
    enabled,
    refetchInterval: 10_000,
  });

  const decideMutation = useMutation({
    mutationFn: async (payload: { id: number; decision: "approve" | "deny" }) =>
      apiRequest("POST", `/api/approval-requests/${payload.id}/decide`, { decision: payload.decision }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/approval-requests", "pending"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
    },
    onError: (err) => toast({ title: "Error", description: errorMessage(err), variant: "destructive" }),
  });

  const { data: allowances = [] } = useQuery<Allowance[]>({
    queryKey: ["/api/allowances"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/allowances");
      return await res.json();
    },
    enabled,
  });

  const [newChildId, setNewChildId] = useState<string>("");
  const [newAmount, setNewAmount] = useState<string>("5.00");
  const [newGuaranteedMin, setNewGuaranteedMin] = useState<string>("2.00");
  const [newPenaltyPerJob, setNewPenaltyPerJob] = useState<string>("0.50");
  const [newCadence, setNewCadence] = useState<"weekly" | "monthly">("weekly");
  const [newPeriodStartDow, setNewPeriodStartDow] = useState<string>("1");
  const [newPeriodEndDow, setNewPeriodEndDow] = useState<string>("0");
  const [newDow, setNewDow] = useState<string>("0");
  const [newDom, setNewDom] = useState<string>("1");
  const [newPayoutMode, setNewPayoutMode] = useState<"automatic" | "manual">("automatic");

  const createAllowanceMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        childId: parseInt(newChildId),
        amount: newAmount,
        guaranteedMinimum: newGuaranteedMin,
        penaltyPerIncompleteJob: newPenaltyPerJob,
        cadence: newCadence,
        enabled: true,
        payoutMode: newPayoutMode,
        dayOfWeek: newCadence === "weekly" ? parseInt(newDow) : null,
        dayOfMonth: newCadence === "monthly" ? parseInt(newDom) : null,
        periodStartDayOfWeek: newCadence === "weekly" ? parseInt(newPeriodStartDow) : null,
        periodEndDayOfWeek: newCadence === "weekly" ? parseInt(newPeriodEndDow) : null,
      };
      const res = await apiRequest("POST", "/api/allowances", payload);
      return await res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/allowances"] });
      toast({ title: "Created", description: "Allowance scheduled." });
      setNewChildId("");
    },
    onError: (err) => toast({ title: "Error", description: errorMessage(err), variant: "destructive" }),
  });

  const updateAllowanceMutation = useMutation({
    mutationFn: async (payload: { id: number; updates: Partial<Allowance> }) =>
      apiRequest("PATCH", `/api/allowances/${payload.id}`, payload.updates),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/allowances"] });
    },
    onError: (err) => toast({ title: "Error", description: errorMessage(err), variant: "destructive" }),
  });

  const deleteAllowanceMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/allowances/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/allowances"] });
    },
    onError: (err) => toast({ title: "Error", description: errorMessage(err), variant: "destructive" }),
  });

  const { data: jobCategories = [] } = useQuery<JobCategory[]>({
    queryKey: ["/api/job-categories", "all"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/job-categories?all=1");
      return await res.json();
    },
    enabled,
  });

  const sortedCategories = useMemo(
    () => [...jobCategories].filter((c) => c.enabled !== false).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [jobCategories],
  );

  const [newCategoryLabel, setNewCategoryLabel] = useState("");
  const [newCategoryPaymentMode, setNewCategoryPaymentMode] = useState<JobCategoryPaymentMode>("none");

  const updateCategoryMutation = useMutation({
    mutationFn: async (payload: { id: number; updates: Partial<JobCategory> }) =>
      apiRequest("PATCH", `/api/job-categories/${payload.id}`, payload.updates),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/job-categories"] });
    },
    onError: (err) => toast({ title: "Error", description: errorMessage(err), variant: "destructive" }),
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (payload: { label: string; paymentMode: JobCategoryPaymentMode }) =>
      apiRequest("POST", "/api/job-categories", {
        label: payload.label,
        paymentMode: payload.paymentMode,
        icon: "briefcase",
        description: "",
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/job-categories"] });
      setNewCategoryLabel("");
      toast({ title: "Created", description: "Task category added." });
    },
    onError: (err) => toast({ title: "Error", description: errorMessage(err), variant: "destructive" }),
  });

  const disableCategoryMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/job-categories/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/job-categories"] });
      toast({ title: "Updated", description: "Category disabled or removed." });
    },
    onError: (err) => toast({ title: "Error", description: errorMessage(err), variant: "destructive" }),
  });

  const reorderCategoriesMutation = useMutation({
    mutationFn: async (orderedIds: number[]) =>
      apiRequest("POST", "/api/job-categories/reorder", { orderedIds }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/job-categories"] });
    },
    onError: (err) => toast({ title: "Error", description: errorMessage(err), variant: "destructive" }),
  });

  const moveCategory = (index: number, direction: -1 | 1) => {
    const next = [...sortedCategories];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    reorderCategoriesMutation.mutate(next.map((c) => c.id));
  };

  const childName = useMemo(() => {
    const map = new Map<number, string>();
    children.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [children]);

  if (user?.role !== "parent") {
    return (
      <PageShell wide="narrow">
        <Card className="mint-card">
          <CardContent className="p-6">Only parents can access controls.</CardContent>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell wide="wide">
      <PageHeader
        title="🛡️ Parent Controls"
        description="Approvals, allowances, money allocation, and task & lesson catalogs."
      />

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 h-auto md:grid-cols-3 lg:grid-cols-6 gap-1 p-1">
          <TabsTrigger value="approvals" className="text-xs sm:text-sm py-2">
            Approvals
            {pendingRequests.length > 0 && (
              <span className="ml-1.5 rounded-full bg-primary text-primary-foreground text-xs px-1.5 py-0.5 min-w-[1.25rem]">
                {pendingRequests.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="allowances" className="text-xs sm:text-sm py-2">
            Allowances
          </TabsTrigger>
          <TabsTrigger value="allocation" className="text-xs sm:text-sm py-2">
            Allocation
          </TabsTrigger>
          <TabsTrigger value="jobs" className="text-xs sm:text-sm py-2">
            Tasks
          </TabsTrigger>
          <TabsTrigger value="lessons" className="text-xs sm:text-sm py-2">
            Lessons
          </TabsTrigger>
          <TabsTrigger value="sprout" className="text-xs sm:text-sm py-2">
            Sprout &amp; App
          </TabsTrigger>
        </TabsList>

        <TabsContent value="approvals" className="space-y-6 mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="mint-card">
              <CardHeader>
                <CardTitle>Approval rules</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="font-bold">Require spending approval</Label>
                  <Switch
                    checked={!!settings?.requireSpendingApproval}
                    onCheckedChange={(v) => updateSettingsMutation.mutate({ requireSpendingApproval: v })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="font-bold">Require donation approval</Label>
                  <Switch
                    checked={!!settings?.requireDonationApproval}
                    onCheckedChange={(v) => updateSettingsMutation.mutate({ requireDonationApproval: v })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="font-bold">Require goal funding approval</Label>
                  <Switch
                    checked={!!settings?.requireGoalFundingApproval}
                    onCheckedChange={(v) => updateSettingsMutation.mutate({ requireGoalFundingApproval: v })}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="mint-card lg:col-span-2">
              <CardHeader>
                <CardTitle>Pending requests ({pendingRequests.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {pendingRequests.length === 0 ? (
                  <div className="text-gray-500">No pending requests.</div>
                ) : (
                  <div className="space-y-3">
                    {pendingRequests.map((r) => (
                      <div key={r.id} className="border border-gray-200 rounded-xl p-4 bg-white flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="font-semibold text-gray-900">
                            {childName.get(r.childId) || `Child ${r.childId}`} • {r.type} • ${parseFloat(r.amount).toFixed(2)}
                          </div>
                          <div className="text-sm text-gray-600 mt-1">
                            {new Date(r.createdAt).toLocaleString()}
                          </div>
                          <div className="text-xs text-gray-500 mt-2 break-words">{r.details}</div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Button
                            className="mint-primary"
                            onClick={() => decideMutation.mutate({ id: r.id, decision: "approve" })}
                            disabled={decideMutation.isPending}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => decideMutation.mutate({ id: r.id, decision: "deny" })}
                            disabled={decideMutation.isPending}
                          >
                            Deny
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="allowances" className="space-y-6 mt-0">
          <Card className="mint-card">
            <CardHeader>
              <CardTitle>Allowance scheduler</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">
                Schedule allowance amounts here. To approve chores and pay out, go to{" "}
                <Link href="/jobs?view=payments" className="text-emerald-700 underline font-medium">
                  Tasks &amp; Payments
                </Link>
                .
              </p>
            </CardContent>
          </Card>
          <Card className="mint-card">
            <CardHeader>
              <CardTitle>Create allowance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
                <div className="md:col-span-2">
                  <Label>Child</Label>
                  <Select value={newChildId} onValueChange={setNewChildId}>
                    <SelectTrigger className="mint-input mt-1">
                      <SelectValue placeholder="Select child" />
                    </SelectTrigger>
                    <SelectContent>
                      {children.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name} (Age {c.age})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Total allowance ($)</Label>
                  <CurrencyInput className="mt-1" value={newAmount} onChange={setNewAmount} placeholder="5.00" />
                </div>
                <div>
                  <Label>Guaranteed min ($)</Label>
                  <CurrencyInput className="mt-1" value={newGuaranteedMin} onChange={setNewGuaranteedMin} placeholder="0.00" />
                </div>
                <div>
                  <Label>Penalty / missed job ($)</Label>
                  <CurrencyInput className="mt-1" value={newPenaltyPerJob} onChange={setNewPenaltyPerJob} placeholder="0.00" />
                </div>
                <div>
                  <Label>Cadence</Label>
                  <Select value={newCadence} onValueChange={(v) => setNewCadence(v as "weekly" | "monthly")}>
                    <SelectTrigger className="mint-input mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {newCadence === "weekly" ? (
                  <>
                    <DayOfWeekSelect label="Period starts" value={newPeriodStartDow} onValueChange={setNewPeriodStartDow} />
                    <DayOfWeekSelect label="Period ends" value={newPeriodEndDow} onValueChange={setNewPeriodEndDow} />
                    <DayOfWeekSelect label="Pay day" value={newDow} onValueChange={setNewDow} />
                  </>
                ) : (
                  <div>
                    <Label>Day of month (1–28)</Label>
                    <Input
                      className="mint-input mt-1"
                      value={newDom}
                      onChange={(e) => setNewDom(e.target.value)}
                    />
                  </div>
                )}
              </div>
              {newCadence === "weekly" && (
                <p className="text-sm text-gray-600">
                  Chores count for the period from{" "}
                  <strong>{dayOfWeekLabel(parseInt(newPeriodStartDow, 10))}</strong> through{" "}
                  <strong>{dayOfWeekLabel(parseInt(newPeriodEndDow, 10))}</strong>. Pay on{" "}
                  <strong>{dayOfWeekLabel(parseInt(newDow, 10))}</strong> (automatic or manual).
                </p>
              )}
              <div className="max-w-md">
                <Label>Payout mode</Label>
                <Select value={newPayoutMode} onValueChange={(v) => setNewPayoutMode(v as "automatic" | "manual")}>
                  <SelectTrigger className="mint-input mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="automatic">Automatic — pays on schedule</SelectItem>
                    <SelectItem value="manual">Manual — you pay when ready</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                  {newPayoutMode === "automatic"
                    ? "Deposits on the due day; you can still pay early from Tasks & Payments."
                    : "No automatic deposit — pay from Tasks & Payments when you are ready."}
                </p>
              </div>
              <p className="text-sm text-gray-600">
                Example: total <strong>$10</strong>, guaranteed <strong>$4</strong>, penalty <strong>$2</strong> → up to{" "}
                <strong>$6</strong> can be reduced by incomplete jobs (never below <strong>$4</strong>).
              </p>

              <Button
                className="mint-primary"
                disabled={createAllowanceMutation.isPending}
                onClick={() => {
                  if (!newChildId) {
                    toast({
                      title: "Select a child",
                      description: "Choose which child this allowance is for.",
                      variant: "destructive",
                    });
                    return;
                  }
                  createAllowanceMutation.mutate();
                }}
              >
                Create allowance
              </Button>

              <div className="space-y-3">
                {allowances.length === 0 ? (
                  <div className="text-gray-500">No allowances configured.</div>
                ) : (
                  allowances.map((a) => (
                    <AllowancePenaltyEditor
                      key={a.id}
                      allowance={a}
                      childLabel={childName.get(a.childId) || `Child ${a.childId}`}
                      onToggleEnabled={(v) => updateAllowanceMutation.mutate({ id: a.id, updates: { enabled: v } as Partial<Allowance> })}
                      onDelete={() => {
                        if (confirm("Delete this allowance?")) deleteAllowanceMutation.mutate(a.id);
                      }}
                      onSave={(updates) =>
                        updateAllowanceMutation.mutate(
                          { id: a.id, updates: updates as Partial<Allowance> },
                          {
                            onSuccess: () => toast({ title: "Saved", description: "Allowance rules updated." }),
                            onError: (err) => toast({ title: "Error", description: errorMessage(err), variant: "destructive" }),
                          },
                        )
                      }
                      onPayoutModeChange={(mode) =>
                        updateAllowanceMutation.mutate(
                          { id: a.id, updates: { payoutMode: mode } as Partial<Allowance> },
                          {
                            onSuccess: () => toast({ title: "Saved", description: "Payout mode updated." }),
                            onError: (err) => toast({ title: "Error", description: errorMessage(err), variant: "destructive" }),
                          },
                        )
                      }
                      onWeekScheduleChange={(updates) =>
                        updateAllowanceMutation.mutate(
                          { id: a.id, updates: updates as Partial<Allowance> },
                          {
                            onSuccess: () => toast({ title: "Saved", description: "Weekly schedule updated." }),
                            onError: (err) => toast({ title: "Error", description: errorMessage(err), variant: "destructive" }),
                          },
                        )
                      }
                    />
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="allocation" className="space-y-6 mt-0">
          <div className="mb-2">
            <h2 className="text-xl font-semibold text-gray-900">Money allocation</h2>
            <p className="text-sm text-gray-600">
              Set how each child&apos;s earnings split across enabled accounts. Percentages must total 100% per child.
            </p>
          </div>
          {children.length === 0 ? (
            <Card className="mint-card">
              <CardContent className="p-6 text-center text-gray-600">
                <p className="mb-3">Add a child on the Family page to set allocation.</p>
                <Button asChild variant="outline" className="font-bold">
                  <Link href="/family">Go to Family</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {children.map((child) => (
                <Card key={child.id} className="mint-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">{child.name}</CardTitle>
                    <p className="text-sm text-gray-500 font-normal">Age {child.age}</p>
                  </CardHeader>
                  <CardContent>
                    {familyId != null && (
                      <ChildAllocationForm
                        childId={child.id}
                        childName={child.name}
                        familyId={familyId}
                      />
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="jobs" className="space-y-6 mt-0">
          <Card className="mint-card">
            <CardHeader>
              <CardTitle>Task categories & catalog</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">
                Group tasks into buckets kids understand. Under each category, manage the <strong>task catalog</strong> —
                use <strong>Browse library</strong> to import templates (they appear as quick-add when you create tasks).
              </p>

              <div className="space-y-3">
                {sortedCategories.map((cat, index) => (
                  <JobCategoryEditor
                    key={cat.id}
                    category={cat}
                    canMoveUp={index > 0}
                    canMoveDown={index < sortedCategories.length - 1}
                    onMoveUp={() => moveCategory(index, -1)}
                    onMoveDown={() => moveCategory(index, 1)}
                    onSave={(updates) =>
                      updateCategoryMutation.mutate(
                        { id: cat.id, updates },
                        { onSuccess: () => toast({ title: "Saved", description: "Category updated." }) },
                      )
                    }
                    onDisable={() => {
                      if (confirm(`Disable "${cat.label}"? Tasks in this category will stay assigned.`)) {
                        disableCategoryMutation.mutate(cat.id);
                      }
                    }}
                  />
                ))}
              </div>

              <div className="border-t border-gray-200 pt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <Label>New category name</Label>
                  <Input
                    className="mint-input mt-1"
                    placeholder="e.g., Outdoor chores"
                    value={newCategoryLabel}
                    onChange={(e) => setNewCategoryLabel(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Payment mode</Label>
                  <Select
                    value={newCategoryPaymentMode}
                    onValueChange={(v) => setNewCategoryPaymentMode(v as JobCategoryPaymentMode)}
                  >
                    <SelectTrigger className="mint-input mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(PAYMENT_MODE_LABELS) as JobCategoryPaymentMode[]).map((mode) => (
                        <SelectItem key={mode} value={mode}>
                          {PAYMENT_MODE_LABELS[mode]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {newCategoryPaymentMode === "standalone" && (
                    <p className="text-xs text-gray-500 mt-1">
                      One-time pay categories show an amount field when parents create tasks.
                    </p>
                  )}
                </div>
              </div>
              <Button
                className="mint-primary"
                disabled={!newCategoryLabel.trim() || createCategoryMutation.isPending}
                onClick={() => createCategoryMutation.mutate({ label: newCategoryLabel.trim(), paymentMode: newCategoryPaymentMode })}
              >
                Add category
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lessons" className="space-y-6 mt-0">
          <Card className="mint-card">
            <CardHeader>
              <CardTitle>Lesson catalog</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-sm text-gray-600">
                Import topics from the library, customize them, then <strong>Publish</strong> to add lessons on the{" "}
                <Link href="/learn" className="text-emerald-700 underline font-medium">
                  Learn
                </Link>{" "}
                page. Each published lesson includes kid-friendly quiz questions. Templates load automatically the first
                time you visit this tab.
              </p>
              {LESSON_CATEGORY_KEYS.map((key) => (
                <div key={key} className="border border-gray-200 rounded-xl p-4 bg-white">
                  <h3 className="font-semibold text-gray-900 mb-2">{LESSON_CATEGORY_LABELS[key]}</h3>
                  <CatalogEditor
                    catalogType="lesson"
                    categoryKey={key}
                    categoryLabel={LESSON_CATEGORY_LABELS[key]}
                    showPublish
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sprout" className="space-y-6 mt-0">
          <div className="mb-2">
            <h2 className="text-xl font-semibold text-gray-900">Sprout &amp; app settings</h2>
            <p className="text-sm text-gray-600">Configure AI, voice, and login options without editing .env or restarting Docker.</p>
          </div>
          <AppSettingsPanel />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}

