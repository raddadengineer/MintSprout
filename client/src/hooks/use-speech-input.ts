import { useCallback, useEffect, useRef, useState } from "react";

interface SpeechRecognitionResultItem {
  transcript: string;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResultItem;
  isFinal: boolean;
}

interface SpeechRecognitionResultEvent {
  resultIndex: number;
  results: {
    readonly length: number;
    [index: number]: SpeechRecognitionResultList;
  };
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

type UseSpeechInputOptions = {
  onFinalTranscript?: (text: string) => void;
  lang?: string;
};

export function useSpeechInput({ onFinalTranscript, lang = "en-US" }: UseSpeechInputOptions = {}) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const onFinalRef = useRef(onFinalTranscript);
  onFinalRef.current = onFinalTranscript;

  useEffect(() => {
    const SR = getSpeechRecognition();
    setIsSupported(!!SR);
    if (!SR) return;

    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = lang;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionResultEvent) => {
      let interim = "";
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) finalText += text;
        else interim += text;
      }
      setInterimTranscript(interim);
      if (finalText.trim()) {
        setInterimTranscript("");
        onFinalRef.current?.(finalText.trim());
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript("");
    };

    recognition.onerror = () => {
      setIsListening(false);
      setInterimTranscript("");
    };

    recognitionRef.current = recognition;
    return () => {
      try {
        recognition.abort();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
    };
  }, [lang]);

  const startListening = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition || isListening) return;
    try {
      setInterimTranscript("");
      recognition.start();
      setIsListening(true);
    } catch {
      setIsListening(false);
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition || !isListening) return;
    try {
      recognition.stop();
    } catch {
      setIsListening(false);
    }
  }, [isListening]);

  const toggleListening = useCallback(() => {
    if (isListening) stopListening();
    else startListening();
  }, [isListening, startListening, stopListening]);

  return {
    isSupported,
    isListening,
    interimTranscript,
    startListening,
    stopListening,
    toggleListening,
  };
}
