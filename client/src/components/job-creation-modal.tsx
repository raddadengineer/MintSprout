import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IconSelector } from "@/components/icon-selector";
import { PAYMENT_MODE_LABELS, categoryPaymentLabel, isFlexiblePayCategory } from "@shared/job-categories";
import type { JobCategoryPaymentMode } from "@shared/job-categories";
import { JobIcon } from "@/components/job-icon";
import { Link } from "wouter";
import { taskLabels } from "@/lib/task-labels";

type PayTypeChoice = JobCategoryPaymentMode;

interface JobCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Child {
  id: number;
  name: string;
  age: number;
}

interface Allowance {
  id: number;
  childId: number;
  enabled: boolean | null;
  cadence: string;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  amount: string;
}

type JobCategory = {
  id: number;
  slug?: string | null;
  label: string;
  description?: string | null;
  icon?: string | null;
  paymentMode: JobCategoryPaymentMode;
  sortOrder?: number | null;
};

type CatalogItem = {
  id: number;
  title: string;
  description?: string | null;
  payload: string;
  enabled?: boolean | null;
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

export function JobCreationModal({ isOpen, onClose }: JobCreationModalProps) {
  const labels = taskLabels("parent");
  const [payType, setPayType] = useState<PayTypeChoice>("standalone");
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    amount: "",
    recurrence: "once",
    assignedToId: "",
    icon: "briefcase",
    categoryId: "",
    allowanceId: "",
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: children = [] } = useQuery<Child[]>({
    queryKey: ["/api/children"],
  });

  const { data: categories = [] } = useQuery<JobCategory[]>({
    queryKey: ["/api/job-categories"],
  });

  const { data: allowances = [] } = useQuery<Allowance[]>({
    queryKey: ["/api/allowances"],
  });

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [categories],
  );

  const selectedCategory = sortedCategories.find((c) => c.id.toString() === formData.categoryId);
  const effectivePayType = payType;

  const { data: catalogItems = [] } = useQuery<CatalogItem[]>({
    queryKey: ["/api/catalog/items", "job", selectedCategory?.id],
    queryFn: async () => {
      if (!selectedCategory) return [];
      const res = await apiRequest("GET", `/api/catalog/items?type=job&categoryId=${selectedCategory.id}&enabledOnly=1`);
      return await res.json();
    },
    enabled: !!selectedCategory && isOpen,
  });

  const categoryPresets = useMemo(() => {
    return catalogItems
      .filter((i) => i.enabled !== false)
      .map((item) => {
        let payload: { icon?: string; recurrence?: string } = {};
        try {
          payload = JSON.parse(item.payload) as { icon?: string; recurrence?: string };
        } catch {
          // ignore
        }
        return {
          title: item.title,
          description: item.description ?? "",
          icon: payload.icon ?? "briefcase",
          recurrence: (payload.recurrence ?? "once") as "once" | "daily" | "weekly" | "monthly",
        };
      });
  }, [catalogItems]);

  const selectedChildId = formData.assignedToId ? parseInt(formData.assignedToId) : null;
  const childAllowances = allowances.filter(
    (a) => selectedChildId != null && a.childId === selectedChildId && (a.enabled ?? true),
  );

  const createJobMutation = useMutation({
    mutationFn: (jobData: Record<string, unknown>) => apiRequest("POST", "/api/jobs", jobData),
    onSuccess: () => {
      toast({
        title: "Success!",
        description: "Task created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      onClose();
      setPayType("standalone");
      setFormData({
        title: "",
        description: "",
        amount: "",
        recurrence: "once",
        assignedToId: "",
        icon: "briefcase",
        categoryId: "",
        allowanceId: "",
      });
    },
    onError: (err) => {
      toast({
        title: "Error",
        description: errorMessage(err),
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title || !formData.assignedToId || !formData.categoryId) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (effectivePayType === "standalone" && !formData.amount) {
      toast({
        title: "Error",
        description: "Enter a payment amount for one-time paid tasks",
        variant: "destructive",
      });
      return;
    }

    if (effectivePayType === "allowance" && !formData.allowanceId) {
      toast({
        title: "Error",
        description: "Select which allowance this chore belongs to",
        variant: "destructive",
      });
      return;
    }

    createJobMutation.mutate({
      title: formData.title,
      description: formData.description,
      amount:
        effectivePayType === "standalone"
          ? parseFloat(formData.amount).toFixed(2)
          : "0.00",
      recurrence: formData.recurrence,
      assignedToId: parseInt(formData.assignedToId),
      icon: formData.icon,
      categoryId: parseInt(formData.categoryId),
      payType: effectivePayType,
      ...(effectivePayType === "allowance" ? { allowanceId: parseInt(formData.allowanceId) } : {}),
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-gray-900">{labels.create}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="block text-sm font-medium text-gray-700 mb-2">Pay type</Label>
            <Select
              value={payType}
              onValueChange={(value: PayTypeChoice) => {
                setPayType(value);
                setFormData({ ...formData, allowanceId: "", amount: "" });
              }}
            >
              <SelectTrigger className="mint-input">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{PAYMENT_MODE_LABELS.none}</SelectItem>
                <SelectItem value="allowance">{PAYMENT_MODE_LABELS.allowance}</SelectItem>
                <SelectItem value="standalone">{PAYMENT_MODE_LABELS.standalone}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 mt-1">
              Choose how this task is paid, regardless of category defaults.
            </p>
          </div>

          <div>
            <Label className="block text-sm font-medium text-gray-700 mb-2">Category</Label>
            <Select
              value={formData.categoryId}
              onValueChange={(value) => {
                const cat = sortedCategories.find((c) => c.id.toString() === value);
                setFormData({
                  ...formData,
                  categoryId: value,
                  allowanceId: "",
                  amount: "",
                  icon: cat?.icon ?? formData.icon,
                });
                if (cat && !isFlexiblePayCategory(cat.slug)) setPayType(cat.paymentMode);
              }}
            >
              <SelectTrigger className="mint-input">
                <SelectValue placeholder="Choose a category" />
              </SelectTrigger>
              <SelectContent>
                {sortedCategories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id.toString()}>
                    <span className="flex items-center gap-2">
                      <JobIcon iconName={cat.icon} className="h-4 w-4" />
                      {cat.label} ({categoryPaymentLabel(cat.slug, cat.paymentMode)})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedCategory?.description && (
              <p className="text-xs text-gray-500 mt-2">{selectedCategory.description}</p>
            )}
            {selectedCategory && isFlexiblePayCategory(selectedCategory.slug) && (
              <p className="text-xs text-indigo-700 mt-1">
                Use <strong>Pay type</strong> above to decide if this task earns money.
              </p>
            )}
          </div>

          {categoryPresets.length > 0 ? (
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-2">Quick add</Label>
              <div className="flex flex-wrap gap-2">
                {categoryPresets.map((preset) => (
                  <Button
                    key={preset.title}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        title: preset.title,
                        description: preset.description,
                        icon: preset.icon,
                        recurrence: preset.recurrence,
                      })
                    }
                  >
                    {preset.title}
                  </Button>
                ))}
              </div>
            </div>
          ) : selectedCategory ? (
            <p className="text-sm text-gray-500">
              No quick-add templates yet.{" "}
              <Link href="/controls?tab=allowances" className="text-emerald-700 underline" onClick={onClose}>
                Import from the catalog in Controls
              </Link>
              .
            </p>
          ) : null}

          <div>
            <Label className="block text-sm font-medium text-gray-700 mb-2">Task title</Label>
            <Input
              type="text"
              className="mint-input"
              placeholder="e.g., Clean my room"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>

          <div>
            <Label className="block text-sm font-medium text-gray-700 mb-2">Description</Label>
            <Textarea
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent h-24 resize-none"
              placeholder="What needs to be done?"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div>
            <Label className="block text-sm font-medium text-gray-700 mb-2">Icon</Label>
            <IconSelector
              selectedIcon={formData.icon}
              onIconSelect={(icon) => setFormData({ ...formData, icon })}
            />
          </div>

          {effectivePayType === "standalone" && (
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-2">Payment Amount</Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  className="mint-input pl-8"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                />
              </div>
            </div>
          )}

          {effectivePayType === "allowance" && (
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-2">Tie to allowance</Label>
              <Select
                value={formData.allowanceId}
                onValueChange={(value) => setFormData({ ...formData, allowanceId: value })}
                disabled={!formData.assignedToId || childAllowances.length === 0}
              >
                <SelectTrigger className="mint-input">
                  <SelectValue
                    placeholder={
                      !formData.assignedToId
                        ? "Select a child first"
                        : childAllowances.length === 0
                          ? "No enabled allowances for this child"
                          : "Select an allowance"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {childAllowances.map((a) => (
                    <SelectItem key={a.id} value={a.id.toString()}>
                      ${a.amount} ({a.cadence})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {effectivePayType === "allowance" && formData.assignedToId && childAllowances.length === 0 && (
                <p className="text-xs text-amber-700 mt-2">
                  No allowance for this child yet.{" "}
                  <Link href="/controls?tab=allowances" className="underline font-medium" onClick={onClose}>
                    Set up allowance in Controls
                  </Link>
                  .
                </p>
              )}
            </div>
          )}

          {effectivePayType === "none" && (
            <p className="text-xs text-gray-500 bg-sky-50 border border-sky-100 rounded-lg px-3 py-2">
              No pay — this is part of everyday family responsibilities.
            </p>
          )}

          <div>
            <Label className="block text-sm font-medium text-gray-700 mb-2">Recurrence</Label>
            <Select value={formData.recurrence} onValueChange={(value) => setFormData({ ...formData, recurrence: value })}>
              <SelectTrigger className="mint-input">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="once">One time</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="block text-sm font-medium text-gray-700 mb-2">Assign to</Label>
            <Select value={formData.assignedToId} onValueChange={(value) => setFormData({ ...formData, assignedToId: value, allowanceId: "" })}>
              <SelectTrigger className="mint-input">
                <SelectValue placeholder="Select a child" />
              </SelectTrigger>
              <SelectContent>
                {children.map((child) => (
                  <SelectItem key={child.id} value={child.id.toString()}>
                    {child.name} (Age {child.age})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 mint-primary mint-button"
              disabled={createJobMutation.isPending}
            >
              {createJobMutation.isPending ? "Creating..." : labels.create}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
