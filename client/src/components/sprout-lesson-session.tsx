import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { useSpeechInput } from "@/hooks/use-speech-input";
import { useQuizSpeech } from "@/hooks/use-quiz-speech";
import type { KidMode } from "@/hooks/use-kid-mode";
import { Mic, MicOff, Volume2, X, Trophy } from "lucide-react";
import { IconText } from "@/components/icon-text";

type VoiceSessionResponse = {
  stepIndex: number;
  totalSteps: number;
  narration: string;
  prompt?: string;
  feedback?: string;
  prepared: boolean;
  audioBase64?: string;
  mimeType?: string;
};

type SproutLessonSessionProps = {
  lesson: { id: number; title: string };
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
  kidMode: KidMode;
};

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

export function SproutLessonSession({ lesson, open, onClose, onComplete, kidMode }: SproutLessonSessionProps) {
  const queryClient = useQueryClient();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const [narration, setNarration] = useState("");
  const [prompt, setPrompt] = useState<string | undefined>();
  const [feedback, setFeedback] = useState<string | undefined>();
  const [phase, setPhase] = useState<"loading" | "narrating" | "prompt" | "complete">("loading");
  const [error, setError] = useState<string | null>(null);
  const [typedAnswer, setTypedAnswer] = useState("");
  const { speak, stop: stopSpeech, isSpeaking, supported: browserSpeechSupported } = useQuizSpeech(kidMode);

  const sessionMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await apiRequest("POST", `/api/lessons/${lesson.id}/voice-session`, {
        withSpeech: true,
        ...body,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Voice session failed");
      }
      return (await res.json()) as VoiceSessionResponse;
    },
  });

  const playNarration = useCallback(
    (text: string, audioBase64?: string, mimeType?: string, onDone?: () => void) => {
      if (!text.trim()) {
        onDone?.();
        return;
      }
      if (audioBase64 && mimeType) {
        playBase64Audio(audioBase64, mimeType, audioRef, onDone);
        return;
      }
      if (browserSpeechSupported) {
        stopSpeech();
        const utter = new SpeechSynthesisUtterance(text);
        utter.onend = () => onDone?.();
        utter.onerror = () => onDone?.();
        window.speechSynthesis.speak(utter);
        return;
      }
      onDone?.();
    },
    [browserSpeechSupported, stopSpeech],
  );

  const applyStep = useCallback(
    (data: VoiceSessionResponse) => {
      setStepIndex(data.stepIndex);
      setTotalSteps(data.totalSteps);
      setNarration(data.narration);
      setPrompt(data.prompt);
      setFeedback(data.feedback);

      if (data.prepared) {
        setPhase("complete");
        void queryClient.invalidateQueries({ queryKey: ["/api/learning-progress"] });
        return;
      }

      setPhase("narrating");
      playNarration(data.narration, data.audioBase64, data.mimeType, () => {
        if (data.prompt) {
          setPhase("prompt");
        } else {
          sessionMutation.mutate(
            { action: "advance", stepIndex: data.stepIndex },
            {
              onSuccess: (next) => applyStep(next),
              onError: (err) => setError(err instanceof Error ? err.message : "Something went wrong"),
            },
          );
        }
      });
    },
    [playNarration, queryClient, sessionMutation],
  );

  useEffect(() => {
    if (!open) return;
    setError(null);
    setPhase("loading");
    setStepIndex(0);
    setFeedback(undefined);
    setTypedAnswer("");
    sessionMutation.mutate(
      { action: "start" },
      {
        onSuccess: (data) => applyStep(data),
        onError: (err) => setError(err instanceof Error ? err.message : "Could not start lesson"),
      },
    );
    return () => {
      stopSpeech();
      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lesson.id]);

  const submitAnswer = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || phase !== "prompt" || sessionMutation.isPending) return;
      setTypedAnswer("");
      sessionMutation.mutate(
        { action: "respond", stepIndex, userMessage: trimmed },
        {
          onSuccess: (data) => applyStep(data),
          onError: (err) => setError(err instanceof Error ? err.message : "Something went wrong"),
        },
      );
    },
    [applyStep, phase, sessionMutation, stepIndex],
  );

  const { isSupported: micSupported, isListening, interimTranscript, toggleListening } = useSpeechInput({
    onFinalTranscript: (text) => {
      if (phase !== "prompt" || sessionMutation.isPending) return;
      sessionMutation.mutate(
        { action: "respond", stepIndex, userMessage: text },
        {
          onSuccess: (data) => applyStep(data),
          onError: (err) => setError(err instanceof Error ? err.message : "Something went wrong"),
        },
      );
    },
  });

  if (!open) return null;

  const progressPct = totalSteps > 0 ? Math.min(100, ((stepIndex + 1) / totalSteps) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto mint-card shadow-xl">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <span className="text-2xl">🌱</span>
              Learn with Sprout
            </CardTitle>
            <Button type="button" variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm text-gray-600">{lesson.title}</p>
          {totalSteps > 0 && (
            <div className="space-y-1 pt-2">
              <div className="text-xs text-gray-500">
                Step {Math.min(stepIndex + 1, totalSteps)} of {totalSteps}
              </div>
              <Progress value={progressPct} className="h-2" />
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
          )}

          {phase === "loading" && (
            <p className="text-sm text-gray-600">Sprout is getting your lesson ready…</p>
          )}

          {phase === "complete" && (
            <div className="text-center space-y-4 py-4">
              <Trophy className="h-12 w-12 text-amber-500 mx-auto" />
              <p className="font-semibold text-emerald-800 text-lg">You're ready for the quiz!</p>
              <p className="text-sm text-gray-600">Great listening and sharing. Let's see what you learned!</p>
              <Button
                className="mint-primary w-full"
                onClick={() => {
                  onComplete();
                  onClose();
                }}
              >
                Take Quiz
              </Button>
            </div>
          )}

          {(phase === "narrating" || phase === "prompt") && (
            <>
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4">
                <div className="flex items-center gap-2 text-emerald-800 font-medium mb-2">
                  <Volume2 className="h-4 w-4" />
                  {isSpeaking ? "Sprout is talking…" : phase === "prompt" ? "Your turn!" : "Listen to Sprout"}
                </div>
                {narration && <p className="text-sm text-gray-800 leading-relaxed">{narration}</p>}
                {feedback && <p className="text-sm text-emerald-700 mt-2 font-medium">{feedback}</p>}
              </div>

              {phase === "prompt" && prompt && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-800">{prompt}</p>
                  {interimTranscript && (
                    <p className="text-xs text-gray-500 italic">"{interimTranscript}"</p>
                  )}
                  {micSupported ? (
                    <Button
                      type="button"
                      variant={isListening ? "destructive" : "outline"}
                      className="w-full"
                      disabled={sessionMutation.isPending}
                      onClick={toggleListening}
                    >
                      {isListening ? (
                        <>
                          <MicOff className="h-4 w-4 mr-2" /> Stop listening
                        </>
                      ) : kidMode === "youngest" ? (
                        <IconText icon="🎤" label="Tap to answer" size="sm" />
                      ) : (
                        <>
                          <Mic className="h-4 w-4 mr-2" /> Tap to answer
                        </>
                      )}
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      <Input
                        value={typedAnswer}
                        onChange={(e) => setTypedAnswer(e.target.value)}
                        placeholder={kidMode === "youngest" ? "Type your answer here" : "Type your answer"}
                        disabled={sessionMutation.isPending}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") submitAnswer(typedAnswer);
                        }}
                      />
                      <Button
                        type="button"
                        className="w-full"
                        disabled={sessionMutation.isPending || !typedAnswer.trim()}
                        onClick={() => submitAnswer(typedAnswer)}
                      >
                        Send answer
                      </Button>
                      <p className="text-xs text-gray-500">Mic not available — type your answer instead.</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
