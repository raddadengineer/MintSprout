import { useCallback, useEffect, useRef, useState } from "react";
import type { KidMode } from "@/hooks/use-kid-mode";

function pickVoice(mode: KidMode): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;
  const en = voices.filter((v) => v.lang.startsWith("en"));
  const pool = en.length > 0 ? en : voices;
  const prefer =
    mode === "youngest"
      ? pool.find((v) => /samantha|karen|zira|female/i.test(v.name))
      : pool.find((v) => /samantha|alex|daniel|google us english/i.test(v.name));
  return prefer ?? pool[0] ?? null;
}

function speechRate(mode: KidMode): number {
  if (mode === "youngest") return 0.82;
  if (mode === "younger") return 0.9;
  return 1;
}

export function useQuizSpeech(kidMode: KidMode = "older") {
  const [supported] = useState(
    () => typeof window !== "undefined" && "speechSynthesis" in window,
  );
  const [isSpeaking, setIsSpeaking] = useState(false);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);

  useEffect(() => {
    if (!supported) return;
    const load = () => {
      voiceRef.current = pickVoice(kidMode);
    };
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, [kidMode, supported]);

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, [supported]);

  const speak = useCallback(
    (text: string) => {
      if (!supported || !text.trim()) return;
      stop();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = speechRate(kidMode);
      utterance.pitch = kidMode === "youngest" ? 1.15 : 1.05;
      if (voiceRef.current) utterance.voice = voiceRef.current;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    },
    [kidMode, stop, supported],
  );

  const speakQuizQuestion = useCallback(
    (question: string, options: string[]) => {
      const letters = options.map((opt, i) => `Option ${String.fromCharCode(65 + i)}: ${opt}`);
      speak([question, ...letters].join(". "));
    },
    [speak],
  );

  return { supported, speak, speakQuizQuestion, stop, isSpeaking };
}
