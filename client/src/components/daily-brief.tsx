import { useCallback, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { useKidMode, type KidMode } from "@/hooks/use-kid-mode";
import { useAuth } from "@/hooks/use-auth";
import { IconText } from "@/components/icon-text";
import { JobIcon } from "@/components/job-icon";
import { Volume2, Loader2, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";

type BriefTask = {
  id: number;
  title: string;
  kind: "family" | "paid" | "allowance";
  status: string;
  statusLabel: string;
  amount?: string;
  recurrence?: string;
};

type BriefReminder = {
  id: string;
  type: string;
  message: string;
  priority: "high" | "normal";
};

type BriefCategoryGroup = {
  label: string;
  icon: string;
  tasks: BriefTask[];
};

type DailyBriefResponse = {
  childName: string;
  mode: KidMode;
  script: string;
  familyDuties: BriefTask[];
  earnJobs: BriefTask[];
  categoryGroups: BriefCategoryGroup[];
  awaitingApproval: BriefTask[];
  reminders: BriefReminder[];
  savingsGoals: { id: number; name: string; target: string; current: string; percent: number }[];
  money: { spending: string; savings: string; totalEarned: string };
  audioBase64?: string;
  mimeType?: string;
};

function playBase64Audio(base64: string, mimeType: string, audioRef: React.MutableRefObject<HTMLAudioElement | null>) {
  if (audioRef.current) {
    audioRef.current.pause();
    if (audioRef.current.src.startsWith("blob:")) URL.revokeObjectURL(audioRef.current.src);
  }
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
  const audio = new Audio(url);
  audioRef.current = audio;
  void audio.play();
}

function kindBadge(kind: BriefTask["kind"]) {
  if (kind === "family") return <Badge className="bg-sky-100 text-sky-800 border-sky-200">Family</Badge>;
  if (kind === "allowance") return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Allowance</Badge>;
  return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Earn</Badge>;
}

function titlesForMode(mode: KidMode) {
  if (mode === "youngest") {
    return {
      heading: "Your Day",
      headingIcon: "📋",
      subheading: "What to do today",
      button: "My Day!",
      listen: "Listen",
      listenIcon: "🔊",
      details: "My List",
      detailsIcon: "📝",
      hide: "Hide",
      loading: "Getting ready…",
    };
  }
  if (mode === "younger") {
    return {
      heading: "Today's Brief",
      button: "📋 Today's Brief",
      listen: "Read it to me",
      details: "Show details",
      loading: "Building your brief…",
    };
  }
  return {
    heading: "Daily Brief",
    button: "📋 Daily Brief",
    listen: "Play briefing",
    details: "View details",
    loading: "Loading your brief…",
  };
}

function useDailyBrief(enabled: boolean) {
  const [expanded, setExpanded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speechRequested, setSpeechRequested] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { data: aiConfig } = useQuery({
    queryKey: ["/api/ai/config"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/ai/config");
      return (await res.json()) as { briefAvailable?: boolean; voiceAvailable?: boolean };
    },
    enabled,
    staleTime: 60_000,
  });

  const {
    data: brief,
    isLoading,
    isFetching,
    refetch,
    error,
  } = useQuery({
    queryKey: ["/api/ai/brief", speechRequested],
    queryFn: async () => {
      const q = speechRequested ? "?speech=1" : "";
      const res = await apiRequest("GET", `/api/ai/brief${q}`);
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as DailyBriefResponse;
    },
    enabled: enabled && aiConfig?.briefAvailable === true,
    staleTime: 2 * 60_000,
  });

  const handleListen = useCallback(async () => {
    if (brief?.audioBase64 && brief.mimeType) {
      setIsPlaying(true);
      playBase64Audio(brief.audioBase64, brief.mimeType, audioRef);
      const audio = audioRef.current;
      if (audio) {
        audio.onended = () => setIsPlaying(false);
        audio.onerror = () => setIsPlaying(false);
      }
      return;
    }
    setSpeechRequested(true);
    const result = await refetch();
    const data = result.data;
    if (data?.audioBase64 && data.mimeType) {
      setIsPlaying(true);
      playBase64Audio(data.audioBase64, data.mimeType, audioRef);
      const audio = audioRef.current;
      if (audio) {
        audio.onended = () => setIsPlaying(false);
        audio.onerror = () => setIsPlaying(false);
      }
    }
  }, [brief, refetch]);

  return {
    aiConfig,
    brief,
    isLoading,
    isFetching,
    refetch,
    error,
    expanded,
    setExpanded,
    isPlaying,
    speechRequested,
    handleListen,
  };
}

function DailyBriefBody({
  kidMode,
  defaultExpanded = false,
  showHeader = true,
}: {
  kidMode: KidMode;
  defaultExpanded?: boolean;
  showHeader?: boolean;
}) {
  const { user } = useAuth();
  const enabled = user?.role === "child";
  const labels = titlesForMode(kidMode);
  const {
    aiConfig,
    brief,
    isLoading,
    isFetching,
    refetch,
    error,
    expanded,
    setExpanded,
    isPlaying,
    speechRequested,
    handleListen,
  } = useDailyBrief(enabled);

  const detailsOpen = expanded || defaultExpanded;

  if (!enabled || aiConfig?.briefAvailable === false) return null;

  const hasTasks =
    (brief?.categoryGroups?.length ?? 0) > 0 ||
    (brief?.familyDuties.length ?? 0) +
      (brief?.earnJobs.length ?? 0) +
      (brief?.awaitingApproval.length ?? 0) >
    0;

  return (
    <>
      {showHeader && (
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl">📋</span>
            <div>
              <h3 className={`font-black text-gray-900 ${kidMode === "youngest" ? "text-xl" : "text-lg"}`}>
                {kidMode === "youngest" ? (
                  <IconText icon={labels.headingIcon ?? "📋"} label={labels.heading} size="md" />
                ) : (
                  labels.heading
                )}
              </h3>
              <p className="text-sm text-gray-600">
                {kidMode === "youngest" ? labels.subheading ?? labels.heading : "What to do, what's available, and reminders"}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => refetch()}
            disabled={isFetching}
            title="Refresh brief"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center gap-2 text-gray-500 py-4">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>{labels.loading}</span>
        </div>
      )}

      {error && !isLoading && (
        <p className="text-sm text-red-600 py-2">Couldn&apos;t load your brief. Tap refresh to try again.</p>
      )}

      {brief && !isLoading && (
        <>
          <p
            className={`text-gray-800 leading-relaxed mb-4 ${
              kidMode === "youngest" ? "text-base font-medium" : "text-sm"
            }`}
          >
            {brief.script}
          </p>

          <div className="flex flex-wrap gap-2 mb-3">
            {(aiConfig?.voiceAvailable || brief.audioBase64) && (
              <Button
                type="button"
                className="mint-primary font-bold"
                size={kidMode === "youngest" ? "lg" : "default"}
                onClick={handleListen}
                disabled={isFetching || isPlaying}
              >
                {isPlaying ? (
                  <>
                    <Volume2 className="h-4 w-4 mr-2 animate-pulse" />
                    Playing…
                  </>
                ) : isFetching && speechRequested ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Preparing voice…
                  </>
                ) : kidMode === "youngest" ? (
                  <IconText icon={labels.listenIcon ?? "🔊"} label={labels.listen} size="sm" />
                ) : (
                  <>
                    <Volume2 className="h-4 w-4 mr-2" />
                    {labels.listen}
                  </>
                )}
              </Button>
            )}
            {!defaultExpanded && (
              <Button
                type="button"
                variant="outline"
                size={kidMode === "youngest" ? "lg" : "default"}
                onClick={() => setExpanded((e) => !e)}
              >
                {detailsOpen ? (
                  kidMode === "youngest" ? (
                    <IconText icon="👆" label={labels.hide ?? "Hide"} size="sm" />
                  ) : (
                    <>
                      <ChevronUp className="h-4 w-4 mr-1" />
                      Hide
                    </>
                  )
                ) : kidMode === "youngest" ? (
                  <IconText icon={labels.detailsIcon ?? "📝"} label={labels.details} size="sm" />
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4 mr-1" />
                    {labels.details}
                  </>
                )}
              </Button>
            )}
          </div>

          {detailsOpen && (
            <div className="space-y-4 pt-2 border-t border-indigo-100">
              {(brief.categoryGroups?.length ?? 0) > 0
                ? brief.categoryGroups.map((group) => (
                    <section key={group.label}>
                      <h4 className="text-xs font-bold uppercase tracking-wide text-indigo-700 mb-2 flex items-center gap-2">
                        <JobIcon iconName={group.icon} className="h-4 w-4" />
                        {group.label}
                      </h4>
                      <ul className="space-y-2">
                        {group.tasks.map((t) => (
                          <li key={t.id} className="flex items-center justify-between gap-2 text-sm bg-white/70 rounded-lg px-3 py-2">
                            <span className="font-medium">{t.title}</span>
                            <span className="text-xs text-gray-500 shrink-0">{t.statusLabel}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))
                : (
                  <>
              {brief.familyDuties.length > 0 && (
                <section>
                  <h4 className="text-xs font-bold uppercase tracking-wide text-sky-700 mb-2">
                    🏠 Family responsibilities
                  </h4>
                  <ul className="space-y-2">
                    {brief.familyDuties.map((t) => (
                      <li key={t.id} className="flex items-center justify-between gap-2 text-sm bg-white/70 rounded-lg px-3 py-2">
                        <span className="font-medium">{t.title}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          {kindBadge(t.kind)}
                          <span className="text-xs text-gray-500">{t.statusLabel}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {brief.earnJobs.length > 0 && (
                <section>
                  <h4 className="text-xs font-bold uppercase tracking-wide text-amber-700 mb-2">
                    💰 Tasks to earn
                  </h4>
                  <ul className="space-y-2">
                    {brief.earnJobs.map((t) => (
                      <li key={t.id} className="flex items-center justify-between gap-2 text-sm bg-white/70 rounded-lg px-3 py-2">
                        <span className="font-medium">{t.title}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          {t.amount && (
                            <span className="text-primary font-bold">${parseFloat(t.amount).toFixed(2)}</span>
                          )}
                          {kindBadge(t.kind)}
                          <span className="text-xs text-gray-500">{t.statusLabel}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
                  </>
                )}

              {brief.reminders.length > 0 && (
                <section>
                  <h4 className="text-xs font-bold uppercase tracking-wide text-violet-700 mb-2">
                    🔔 Reminders
                  </h4>
                  <ul className="space-y-2">
                    {brief.reminders.map((r) => (
                      <li
                        key={r.id}
                        className={`text-sm rounded-lg px-3 py-2 ${
                          r.priority === "high" ? "bg-amber-50 border border-amber-200" : "bg-white/70"
                        }`}
                      >
                        {r.message}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {!hasTasks && brief.reminders.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-2">You&apos;re all caught up! 🎉</p>
              )}

              <p className="text-xs text-gray-400 text-center">
                Spending ${brief.money.spending} · Savings ${brief.money.savings}
              </p>
            </div>
          )}
        </>
      )}
    </>
  );
}

export function DailyBriefCard() {
  const { user } = useAuth();
  const { mode: kidMode } = useKidMode();

  if (user?.role !== "child") return null;

  return (
    <Card className="mb-8 border-2 border-indigo-100 bg-gradient-to-br from-indigo-50/80 to-violet-50/50 overflow-hidden">
      <CardContent className={`p-5 ${kidMode === "youngest" ? "p-6" : ""}`}>
        <DailyBriefBody kidMode={kidMode} />
      </CardContent>
    </Card>
  );
}

/** Header button for kid pages — opens daily brief in a dialog */
export function DailyBriefButton() {
  const { user } = useAuth();
  const { mode: kidMode } = useKidMode();
  const [open, setOpen] = useState(false);
  const labels = titlesForMode(kidMode);

  const { data: aiConfig } = useQuery({
    queryKey: ["/api/ai/config"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/ai/config");
      return (await res.json()) as { briefAvailable?: boolean };
    },
    enabled: user?.role === "child",
    staleTime: 60_000,
  });

  if (user?.role !== "child" || aiConfig?.briefAvailable === false) return null;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="font-bold border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 shadow-sm"
        size={kidMode === "youngest" ? "lg" : "default"}
        onClick={() => setOpen(true)}
      >
        {labels.button}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DailyBriefBody kidMode={kidMode} defaultExpanded />
        </DialogContent>
      </Dialog>
    </>
  );
}
