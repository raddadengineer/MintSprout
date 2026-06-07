import { useCallback, useEffect, useRef, useState, createContext, useContext } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { useKidMode, type KidMode } from "@/hooks/use-kid-mode";
import { useAuth } from "@/hooks/use-auth";
import { useSpeechInput } from "@/hooks/use-speech-input";
import { useLocation } from "wouter";
import { Volume2, VolumeX, X, MessageCircle, Mic, MicOff, Radio } from "lucide-react";
import { IconText } from "@/components/icon-text";
import { youngestPromptDisplay } from "@/lib/youngest-ui";
import { greetingForPage, quickPromptsForPage, voiceHintForPage } from "@/lib/sprout-prompts";

type AiConfig = {
  enabled: boolean;
  voiceAvailable: boolean;
  voiceModeAvailable?: boolean;
  speechDefault: boolean;
  voice: string | null;
  quickPrompts: string[];
  mascotName: string;
};

type ChatMessage = { role: "user" | "assistant"; content: string };

type ChatResponse = {
  reply: string;
  audioBase64?: string;
  mimeType?: string;
  jobsChanged?: boolean;
  voiceAction?: string;
};

const SproutOpenContext = createContext<{ openSprout: (initialMessage?: string, voiceMode?: boolean) => void } | null>(null);

export function useOpenSprout() {
  return useContext(SproutOpenContext);
}

export function SproutBuddyProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | undefined>();
  const [openInVoiceMode, setOpenInVoiceMode] = useState(false);
  const [location] = useLocation();
  const openSprout = useCallback((initialMessage?: string, voiceMode?: boolean) => {
    if (initialMessage) setPendingMessage(initialMessage);
    if (voiceMode) setOpenInVoiceMode(true);
    setOpen(true);
  }, []);
  const page = location.replace(/^\//, "") || "dashboard";
  return (
    <SproutOpenContext.Provider value={{ openSprout }}>
      {children}
      <SproutBuddy
        page={page}
        open={open}
        onOpenChange={setOpen}
        pendingMessage={pendingMessage}
        onPendingMessageSent={() => setPendingMessage(undefined)}
        initialVoiceMode={openInVoiceMode}
        onVoiceModeInit={() => setOpenInVoiceMode(false)}
      />
    </SproutOpenContext.Provider>
  );
}

function playBase64Audio(
  base64: string,
  mimeType: string,
  audioRef: React.MutableRefObject<HTMLAudioElement | null>,
  onEnded?: () => void,
) {
  if (audioRef.current) {
    audioRef.current.pause();
    URL.revokeObjectURL(audioRef.current.src);
  }
  const blob = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([blob], { type: mimeType }));
  const audio = new Audio(url);
  audioRef.current = audio;
  if (onEnded) {
    audio.onended = onEnded;
    audio.onerror = onEnded;
  }
  void audio.play();
}

type SproutBuddyProps = {
  page?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  pendingMessage?: string;
  onPendingMessageSent?: () => void;
  initialVoiceMode?: boolean;
  onVoiceModeInit?: () => void;
};

export function SproutBuddy({
  page,
  open: controlledOpen,
  onOpenChange,
  pendingMessage,
  onPendingMessageSent,
  initialVoiceMode,
  onVoiceModeInit,
}: SproutBuddyProps) {
  const { user } = useAuth();
  const { mode: kidMode } = useKidMode();
  const queryClient = useQueryClient();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [speechOn, setSpeechOn] = useState(true);
  const [voiceMode, setVoiceMode] = useState(initialVoiceMode ?? false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const greetedRef = useRef(false);
  const voiceModeRef = useRef(voiceMode);
  const startListeningRef = useRef<(() => void) | null>(null);
  voiceModeRef.current = voiceMode;

  const { data: config } = useQuery({
    queryKey: ["/api/ai/config", page],
    queryFn: async () => {
      const q = page ? `?page=${encodeURIComponent(page)}` : "";
      const res = await apiRequest("GET", `/api/ai/config${q}`);
      return (await res.json()) as AiConfig;
    },
    staleTime: 60_000,
    enabled: user?.role === "child",
  });

  const quickPrompts =
    config?.quickPrompts?.length ? config.quickPrompts : quickPromptsForPage(kidMode, page ?? "dashboard");

  useEffect(() => {
    if (config?.speechDefault != null) setSpeechOn(config.speechDefault);
  }, [config?.speechDefault]);

  useEffect(() => {
    if (initialVoiceMode && config?.voiceModeAvailable) {
      setVoiceMode(true);
      setSpeechOn(true);
      onVoiceModeInit?.();
    }
  }, [initialVoiceMode, config?.voiceModeAvailable, onVoiceModeInit]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const invalidateJobData = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
    queryClient.invalidateQueries({ queryKey: ["/api/ai/brief"] });
  }, [queryClient]);

  const chatMutation = useMutation({
    mutationFn: async (payload: { message: string; history: ChatMessage[]; withSpeech: boolean; voiceMode: boolean }) => {
      const res = await apiRequest("POST", "/api/ai/chat", {
        message: payload.message,
        history: payload.history,
        page,
        withSpeech: payload.withSpeech,
        voiceMode: payload.voiceMode,
      });
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as ChatResponse;
    },
    onSuccess: (data, variables) => {
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      if (data.jobsChanged) invalidateJobData();

      const shouldSpeak = variables.withSpeech && data.audioBase64 && data.mimeType;
      if (shouldSpeak) {
        setIsSpeaking(true);
        playBase64Audio(data.audioBase64!, data.mimeType!, audioRef, () => {
          setIsSpeaking(false);
          if (voiceModeRef.current && startListeningRef.current) {
            setTimeout(() => startListeningRef.current?.(), 400);
          }
        });
      } else if (voiceModeRef.current && startListeningRef.current) {
        setTimeout(() => startListeningRef.current?.(), 400);
      }
    },
  });

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || chatMutation.isPending || isSpeaking) return;
      setInput("");
      const history = [...messages];
      setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
      chatMutation.mutate({
        message: trimmed,
        history,
        withSpeech: speechOn && !!config?.voiceAvailable,
        voiceMode,
      });
    },
    [chatMutation, config?.voiceAvailable, isSpeaking, messages, speechOn, voiceMode],
  );

  const { isSupported: speechInputSupported, isListening, interimTranscript, toggleListening, stopListening, startListening } =
    useSpeechInput({
      onFinalTranscript: sendMessage,
    });

  startListeningRef.current = startListening;

  useEffect(() => {
    if (!open) {
      stopListening();
      setIsSpeaking(false);
      greetedRef.current = false;
    }
  }, [open, stopListening]);

  useEffect(() => {
    if (!open || greetedRef.current || !config?.enabled || user?.role !== "child" || pendingMessage) return;
    greetedRef.current = true;
    const greeting = greetingForPage(kidMode, page ?? "dashboard", user?.name ?? "friend", voiceMode);
    setMessages([{ role: "assistant", content: greeting }]);
  }, [open, config?.enabled, kidMode, user?.name, user?.role, voiceMode, pendingMessage, page]);

  useEffect(() => {
    if (!open || !pendingMessage || !config?.enabled || chatMutation.isPending) return;
    sendMessage(pendingMessage);
    onPendingMessageSent?.();
  }, [open, pendingMessage, config?.enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  if (user?.role !== "child" || !config?.enabled) return null;

  const isYoung = kidMode === "youngest" || kidMode === "younger";
  const bubbleSize = kidMode === "youngest" ? "text-base" : "text-sm";
  const btnSize = kidMode === "youngest" ? "lg" : "default";
  const busy = chatMutation.isPending || isSpeaking;

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`fixed z-50 shadow-xl rounded-full flex items-center gap-2 font-black transition-transform hover:scale-105 active:scale-95 ${
            kidMode === "youngest"
              ? "bottom-24 right-4 bg-gradient-to-r from-green-400 to-emerald-500 text-white px-5 py-4 text-lg"
              : "bottom-20 right-4 md:bottom-6 bg-primary text-white px-4 py-3"
          }`}
          aria-label="Talk to Sprout"
        >
          <span className="text-2xl">🌱</span>
          {isYoung && <span>Sprout</span>}
          <MessageCircle className="h-5 w-5 opacity-80" />
        </button>
      )}

      {open && (
        <Card
          className={`fixed z-50 shadow-2xl border-2 flex flex-col ${
            voiceMode ? "border-emerald-400 ring-2 ring-emerald-200" : "border-primary/20"
          } ${
            kidMode === "youngest"
              ? "inset-x-3 bottom-20 top-auto max-h-[70vh] rounded-3xl"
              : "bottom-20 right-3 left-3 md:left-auto md:w-96 max-h-[min(520px,75vh)] rounded-2xl"
          }`}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-green-50 to-emerald-50 rounded-t-2xl">
            <div className="flex items-center gap-2">
              <span className="text-2xl animate-pulse">🌱</span>
              <div>
                <p className="font-black text-gray-900">Sprout</p>
                <p className="text-xs text-gray-500">
                  {voiceMode
                    ? kidMode === "youngest"
                      ? "🎤 Voice Mode"
                      : "Voice Mode — hands free"
                    : kidMode === "youngest"
                      ? "Your money friend!"
                      : kidMode === "younger"
                        ? "Money buddy"
                        : "Financial coach"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {config.voiceModeAvailable && speechInputSupported && (
                <Button
                  type="button"
                  variant={voiceMode ? "default" : "ghost"}
                  size="icon"
                  className={`h-8 w-8 ${voiceMode ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}`}
                  onClick={() => {
                    setVoiceMode((v) => {
                      const next = !v;
                      if (next) setSpeechOn(true);
                      return next;
                    });
                  }}
                  title={voiceMode ? "Turn off voice mode" : "Turn on voice mode"}
                >
                  <Radio className="h-4 w-4" />
                </Button>
              )}
              {config.voiceAvailable && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setSpeechOn((v) => !v)}
                  title={speechOn ? "Mute voice" : "Turn voice on"}
                >
                  {speechOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                </Button>
              )}
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <CardContent className="flex-1 flex flex-col p-0 min-h-0 overflow-hidden">
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 ${bubbleSize} ${
                      m.role === "user"
                        ? "bg-primary text-white rounded-br-md"
                        : "bg-gray-100 text-gray-900 rounded-bl-md"
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {chatMutation.isPending && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-2xl px-3 py-2 text-sm text-gray-500 animate-pulse">
                    Sprout is thinking…
                  </div>
                </div>
              )}
              {isSpeaking && (
                <div className="flex justify-start">
                  <div className="bg-emerald-50 rounded-2xl px-3 py-2 text-sm text-emerald-700 animate-pulse">
                    🔊 Sprout is talking…
                  </div>
                </div>
              )}
              {chatMutation.isError && (
                <p className="text-xs text-red-600 text-center">
                  Sprout couldn&apos;t answer right now. Try again in a moment!
                </p>
              )}
            </div>

            {messages.length <= 2 && quickPrompts.length > 0 && (
              <div className={`px-3 pb-2 ${kidMode === "youngest" ? "grid grid-cols-2 gap-2" : "flex flex-wrap gap-2"}`}>
                {quickPrompts.map((prompt) => (
                  <Button
                    key={prompt}
                    type="button"
                    variant="outline"
                    size={btnSize}
                    className={`rounded-2xl ${kidMode === "youngest" ? "h-auto py-3 flex flex-col gap-1 font-bold" : "text-xs rounded-full"}`}
                    disabled={busy || isListening}
                    onClick={() => sendMessage(prompt)}
                  >
                    {kidMode === "youngest" ? (
                      (() => {
                        const { icon, shortLabel } = youngestPromptDisplay(prompt);
                        return <IconText icon={icon} label={shortLabel} layout="vertical" size="sm" labelClassName="text-xs font-bold" />;
                      })()
                    ) : (
                      prompt
                    )}
                  </Button>
                ))}
              </div>
            )}

            {speechInputSupported && (isYoung || voiceMode) && (
              <div className="px-3 pb-2 flex flex-col items-center gap-1">
                <Button
                  type="button"
                  size={kidMode === "youngest" ? "lg" : "default"}
                  variant={isListening ? "destructive" : voiceMode ? "default" : "default"}
                  className={`rounded-full gap-2 ${
                    kidMode === "youngest" ? "h-14 px-8 text-lg font-black" : "font-bold"
                  } ${isListening ? "animate-pulse" : ""} ${voiceMode && !isListening ? "bg-emerald-600 hover:bg-emerald-700" : ""}`}
                  disabled={busy}
                  onClick={toggleListening}
                >
                  {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                  {isListening ? (
                    kidMode === "youngest" ? (
                      <IconText icon="👂" label="Stop" size="sm" />
                    ) : (
                      "Listening… tap to stop"
                    )
                  ) : kidMode === "youngest" ? (
                    <IconText icon="🎤" label={voiceMode ? "Talk" : "Talk"} size="sm" />
                  ) : voiceMode ? (
                    "Tap to speak"
                  ) : (
                    "Tap to talk to Sprout"
                  )}
                </Button>
                {isListening && interimTranscript && (
                  <p className="text-sm text-gray-500 italic text-center px-2">&ldquo;{interimTranscript}&rdquo;</p>
                )}
                {voiceMode && !isListening && !busy && (
                  <p className="text-xs text-emerald-700 text-center px-2 font-medium">
                    {voiceHintForPage(kidMode, page ?? "dashboard")}
                  </p>
                )}
              </div>
            )}

            <form
              className="p-3 border-t flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage(input);
              }}
            >
              {speechInputSupported && !isYoung && !voiceMode && (
                <Button
                  type="button"
                  variant={isListening ? "destructive" : "outline"}
                  size="icon"
                  className={`shrink-0 ${isListening ? "animate-pulse" : ""}`}
                  disabled={busy}
                  onClick={toggleListening}
                  title={isListening ? "Stop listening" : "Talk to Sprout"}
                >
                  {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
              )}
              <Input
                value={isListening && interimTranscript ? interimTranscript : input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  isListening
                    ? "Listening…"
                    : voiceMode
                      ? page === "learn"
                        ? "Or type a learning question…"
                        : "Or type a job command…"
                      : kidMode === "youngest"
                        ? "Or type here…"
                        : "Ask Sprout anything…"
                }
                className={kidMode === "youngest" ? "text-base h-12" : ""}
                disabled={busy || isListening}
                readOnly={isListening && !!interimTranscript}
              />
              <Button type="submit" disabled={!input.trim() || busy || isListening} size={btnSize}>
                {kidMode === "youngest" ? <IconText icon="🌱" label="Go!" size="sm" /> : "Send"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </>
  );
}

/** Inline CTA to open Sprout — use on dashboard / learn */
export function SproutBuddyCTA({ mode, page = "dashboard" }: { mode: KidMode; page?: string; onOpen?: () => void }) {
  const ctx = useOpenSprout();
  const isLearn = page === "learn";
  const labels: Record<KidMode, { title: string; subtitle: string; emoji: string }> = isLearn
    ? {
        youngest: { title: "Voice Mode!", subtitle: "Ask about lessons & money topics", emoji: "🎤" },
        younger: { title: "Voice Mode", subtitle: "Ask what to learn or get explanations", emoji: "🎙️" },
        older: { title: "Learn with Sprout", subtitle: "Voice Q&A for lessons & concepts", emoji: "🧠" },
        unknown: { title: "Ask Sprout", subtitle: "Your learning coach", emoji: "🌱" },
      }
    : {
        youngest: { title: "Voice Mode!", subtitle: "Ask about jobs & mark them done", emoji: "🎤" },
        younger: { title: "Voice Mode", subtitle: "List jobs & mark complete by voice", emoji: "🎙️" },
        older: { title: "Chat with Sprout", subtitle: "Voice commands for jobs", emoji: "🧠" },
        unknown: { title: "Ask Sprout", subtitle: "Your money coach", emoji: "🌱" },
      };
  const l = labels[mode] ?? labels.unknown;
  const isYoungest = mode === "youngest";

  return (
    <button
      type="button"
      onClick={() => ctx?.openSprout(undefined, mode !== "older")}
      className="w-full text-left rounded-2xl border-2 border-emerald-200 bg-gradient-to-r from-green-50 to-teal-50 p-4 hover:border-primary hover:shadow-md transition-all"
    >
      {isYoungest ? (
        <div className="flex items-center justify-center gap-4">
          <IconText icon={l.emoji} label={l.title} sublabel={l.subtitle} layout="vertical" size="md" />
          <span className="text-4xl">🌱</span>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <span className="text-3xl">{l.emoji}</span>
          <div>
            <p className="font-black text-gray-900">{l.title}</p>
            <p className="text-sm text-gray-600">{l.subtitle}</p>
          </div>
          <span className="ml-auto text-2xl">🌱</span>
        </div>
      )}
    </button>
  );
}
