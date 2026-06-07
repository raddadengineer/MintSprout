import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IconSelector } from "@/components/icon-selector";
import { JobIcon } from "@/components/job-icon";
import { ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import type { CatalogType } from "@shared/catalog/types";

export type CatalogItem = {
  id: number;
  catalogType: string;
  categoryId?: number | null;
  categoryKey: string;
  title: string;
  description?: string | null;
  payload: string;
  enabled?: boolean | null;
  sortOrder?: number | null;
  publishedLessonId?: number | null;
};

type LibraryItem = {
  id: number;
  title: string;
  description?: string | null;
  payload: string;
};

type CatalogProposal = {
  title: string;
  description: string;
  payload: Record<string, unknown>;
};

function parsePayload(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
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

export function CatalogEditor({
  catalogType,
  categoryKey,
  categoryId,
  categoryLabel,
  compact,
  showPublish,
  defaultExpanded,
}: {
  catalogType: CatalogType;
  categoryKey: string;
  categoryId?: number;
  categoryLabel: string;
  compact?: boolean;
  showPublish?: boolean;
  defaultExpanded?: boolean;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(defaultExpanded ?? !compact);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [addingCustom, setAddingCustom] = useState(false);
  const [generateReview, setGenerateReview] = useState<CatalogProposal[] | null>(null);
  const [selectedProposals, setSelectedProposals] = useState<Set<number>>(new Set());

  const [customTitle, setCustomTitle] = useState("");
  const [customDescription, setCustomDescription] = useState("");
  const [customIcon, setCustomIcon] = useState("briefcase");
  const [customRecurrence, setCustomRecurrence] = useState("weekly");
  const [customContent, setCustomContent] = useState("");

  const queryKey = useMemo(
    () => ["/api/catalog/items", catalogType, categoryKey, categoryId ?? null] as const,
    [catalogType, categoryKey, categoryId],
  );

  const { data: items = [], isLoading } = useQuery<CatalogItem[]>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams({ type: catalogType });
      if (catalogType === "job" && categoryId) params.set("categoryId", String(categoryId));
      else params.set("categoryKey", categoryKey);
      const res = await apiRequest("GET", `/api/catalog/items?${params}`);
      return await res.json();
    },
  });

  const { data: libraryItems = [] } = useQuery<LibraryItem[]>({
    queryKey: ["/api/catalog/library", catalogType, categoryKey],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/catalog/library?type=${catalogType}&categoryKey=${encodeURIComponent(categoryKey)}`,
      );
      return await res.json();
    },
    enabled: libraryOpen,
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["/api/catalog/items"] });
  };

  const updateMutation = useMutation({
    mutationFn: (payload: { id: number; updates: Record<string, unknown> }) =>
      apiRequest("PATCH", `/api/catalog/items/${payload.id}`, payload.updates),
    onSuccess: invalidate,
    onError: (err) => toast({ title: "Error", description: errorMessage(err), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/catalog/items/${id}`),
    onSuccess: invalidate,
    onError: (err) => toast({ title: "Error", description: errorMessage(err), variant: "destructive" }),
  });

  const importMutation = useMutation({
    mutationFn: (libraryItemId: number) =>
      apiRequest("POST", "/api/catalog/import", {
        libraryItemId,
        categoryId: catalogType === "job" ? categoryId : undefined,
      }),
    onSuccess: async () => {
      await invalidate();
      toast({ title: "Imported", description: "Added to your catalog." });
    },
    onError: (err) => toast({ title: "Error", description: errorMessage(err), variant: "destructive" }),
  });

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiRequest("POST", "/api/catalog/items", body),
    onSuccess: async () => {
      await invalidate();
      setAddingCustom(false);
      setCustomTitle("");
      setCustomDescription("");
      setCustomContent("");
      toast({ title: "Added", description: "Catalog item saved." });
    },
    onError: (err) => toast({ title: "Error", description: errorMessage(err), variant: "destructive" }),
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/catalog/generate", {
        type: catalogType,
        categoryKey,
        categoryId,
        count: 3,
      });
      return (await res.json()) as { proposals: CatalogProposal[] };
    },
    onSuccess: (data) => {
      setGenerateReview(data.proposals ?? []);
      setSelectedProposals(new Set(data.proposals?.map((_, i) => i) ?? []));
    },
    onError: (err) => toast({ title: "Sprout unavailable", description: errorMessage(err), variant: "destructive" }),
  });

  const batchMutation = useMutation({
    mutationFn: async (proposals: CatalogProposal[]) => {
      const res = await apiRequest("POST", "/api/catalog/items/batch", {
        items: proposals.map((p) => ({
          catalogType,
          categoryKey,
          categoryId: catalogType === "job" ? categoryId : null,
          title: p.title,
          description: p.description,
          payload: p.payload,
        })),
      });
      return await res.json();
    },
    onSuccess: async () => {
      await invalidate();
      setGenerateReview(null);
      toast({ title: "Saved", description: "New catalog items added." });
    },
    onError: (err) => toast({ title: "Error", description: errorMessage(err), variant: "destructive" }),
  });

  const publishMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/catalog/items/${id}/publish-lesson`),
    onSuccess: async () => {
      await invalidate();
      await queryClient.invalidateQueries({ queryKey: ["/api/lessons"] });
      toast({ title: "Published", description: "Lesson is now on the Learn page." });
    },
    onError: (err) => toast({ title: "Error", description: errorMessage(err), variant: "destructive" }),
  });

  const moveItem = (index: number, direction: -1 | 1) => {
    const sorted = [...items].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const target = index + direction;
    if (target < 0 || target >= sorted.length) return;
    const a = sorted[index];
    const b = sorted[target];
    updateMutation.mutate({ id: a.id, updates: { sortOrder: b.sortOrder ?? target } });
    updateMutation.mutate({ id: b.id, updates: { sortOrder: a.sortOrder ?? index } });
  };

  const sortedItems = [...items].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const importedTitles = new Set(items.map((i) => i.title));

  return (
    <div className={compact ? "mt-3 border-t border-gray-100 pt-3" : "space-y-4"}>
      {compact && (
        <button
          type="button"
          className="text-sm font-medium text-emerald-700 flex items-center gap-1"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Hide" : "Show"} templates ({items.length}) · Browse library to import
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      )}

      {(!compact || expanded) && (
        <div className="space-y-3">
          {!compact && (
            <p className="text-sm text-gray-600">
              Quick-add templates for <strong>{categoryLabel}</strong>. Kids see these when you create jobs
              {showPublish ? " or published lessons on Learn" : ""}.
            </p>
          )}

          {isLoading ? (
            <div className="text-sm text-gray-500">Loading catalog…</div>
          ) : sortedItems.length === 0 ? (
            <div className="text-sm text-gray-500">No catalog items yet. Browse the library or add custom ones.</div>
          ) : (
            <div className="space-y-2">
              {sortedItems.map((item, index) => {
                const payload = parsePayload(item.payload);
                const icon = catalogType === "job" ? String(payload.icon ?? "briefcase") : "bookOpen";
                const recurrence = catalogType === "job" ? String(payload.recurrence ?? "once") : null;
                return (
                  <div
                    key={item.id}
                    className="flex items-start justify-between gap-2 border border-gray-100 rounded-lg p-2 bg-gray-50"
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      <JobIcon iconName={icon} className="h-5 w-5 text-gray-500 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="font-medium text-sm text-gray-900 truncate">{item.title}</div>
                        {recurrence && <div className="text-xs text-gray-500 capitalize">{recurrence}</div>}
                        {item.publishedLessonId && (
                          <span className="text-xs bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">Published</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Switch
                        checked={item.enabled !== false}
                        onCheckedChange={(v) => updateMutation.mutate({ id: item.id, updates: { enabled: v } })}
                      />
                      <Button type="button" variant="outline" size="icon" className="h-8 w-8" disabled={index === 0} onClick={() => moveItem(index, -1)}>
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        disabled={index >= sortedItems.length - 1}
                        onClick={() => moveItem(index, 1)}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                      {showPublish && !item.publishedLessonId && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          disabled={publishMutation.isPending}
                          onClick={() => publishMutation.mutate(item.id)}
                        >
                          Publish
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-xs text-red-600"
                        onClick={() => {
                          if (confirm(`Remove "${item.title}" from catalog?`)) deleteMutation.mutate(item.id);
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setLibraryOpen(true)}>
              Browse library
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setAddingCustom((v) => !v)}>
              Add custom
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={generateMutation.isPending}
              onClick={() => generateMutation.mutate()}
            >
              <Sparkles className="h-4 w-4 mr-1" />
              Generate with Sprout
            </Button>
          </div>

          {addingCustom && (
            <div className="border border-gray-200 rounded-lg p-3 space-y-3 bg-white">
              <div>
                <Label>Title</Label>
                <Input className="mint-input mt-1" value={customTitle} onChange={(e) => setCustomTitle(e.target.value)} />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea className="mint-input mt-1" value={customDescription} onChange={(e) => setCustomDescription(e.target.value)} rows={2} />
              </div>
              {catalogType === "job" ? (
                <>
                  <div>
                    <Label>Icon</Label>
                    <IconSelector selectedIcon={customIcon} onIconSelect={setCustomIcon} />
                  </div>
                  <div>
                    <Label>Recurrence</Label>
                    <Select value={customRecurrence} onValueChange={setCustomRecurrence}>
                      <SelectTrigger className="mint-input mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="once">Once</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : (
                <div>
                  <Label>Lesson content</Label>
                  <Textarea className="mint-input mt-1" value={customContent} onChange={(e) => setCustomContent(e.target.value)} rows={4} />
                </div>
              )}
              <Button
                className="mint-primary"
                size="sm"
                disabled={!customTitle.trim() || createMutation.isPending}
                onClick={() => {
                  const payload =
                    catalogType === "job"
                      ? { icon: customIcon, recurrence: customRecurrence }
                      : { content: customContent || customDescription, videoUrl: null };
                  createMutation.mutate({
                    catalogType,
                    categoryKey,
                    categoryId,
                    title: customTitle.trim(),
                    description: customDescription,
                    payload,
                  });
                }}
              >
                Save to catalog
              </Button>
            </div>
          )}
        </div>
      )}

      <Dialog open={libraryOpen} onOpenChange={setLibraryOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Browse library — {categoryLabel}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {libraryItems.length === 0 ? (
              <div className="text-sm text-gray-500">No library items for this category.</div>
            ) : (
              libraryItems.map((lib) => {
                const already = importedTitles.has(lib.title);
                return (
                  <div key={lib.id} className="flex items-center justify-between gap-2 border rounded-lg p-3">
                    <div className="min-w-0">
                      <div className="font-medium text-sm">{lib.title}</div>
                      {lib.description && <div className="text-xs text-gray-500 truncate">{lib.description}</div>}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={already || importMutation.isPending}
                      onClick={() => importMutation.mutate(lib.id)}
                    >
                      {already ? "Added" : "Import"}
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!generateReview} onOpenChange={(open) => !open && setGenerateReview(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Sprout suggestions</DialogTitle>
          </DialogHeader>
          {generateReview?.map((proposal, index) => (
            <label key={index} className="flex items-start gap-2 border rounded-lg p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedProposals.has(index)}
                onChange={(e) => {
                  const next = new Set(selectedProposals);
                  if (e.target.checked) next.add(index);
                  else next.delete(index);
                  setSelectedProposals(next);
                }}
                className="mt-1"
              />
              <div>
                <div className="font-medium text-sm">{proposal.title}</div>
                <div className="text-xs text-gray-600">{proposal.description}</div>
              </div>
            </label>
          ))}
          <Button
            className="mint-primary w-full"
            disabled={selectedProposals.size === 0 || batchMutation.isPending}
            onClick={() => {
              const picked = generateReview!.filter((_, i) => selectedProposals.has(i));
              batchMutation.mutate(picked);
            }}
          >
            Save selected ({selectedProposals.size})
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
