"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Web Speech API typings (SpeechRecognition pas dans lib.dom standard)
type SpeechRecognitionAlternative = { transcript: string; confidence: number };
type SpeechRecognitionResult = {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternative;
};
type SpeechRecognitionResultList = {
  length: number;
  [index: number]: SpeechRecognitionResult;
};
type SpeechRecognitionEvent = {
  resultIndex: number;
  results: SpeechRecognitionResultList;
};
type SpeechRecognitionErrorEvent = { error: string; message?: string };

type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: ((event: Event) => void) | null;
  onend: ((event: Event) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type UseSpeechRecognitionResult = {
  isSupported: boolean;
  isListening: boolean;
  /** Texte final déjà transcrit (committé) */
  finalTranscript: string;
  /** Texte en cours de transcription (provisoire, peut changer) */
  interimTranscript: string;
  /** Erreur la plus récente, null si tout va bien */
  error: string | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
};

/**
 * Hook autour de la Web Speech API.
 * Sur iOS Safari, peut être instable — on expose isSupported et error pour fallback.
 */
export function useSpeechRecognition(
  lang: string = "fr-FR",
): UseSpeechRecognitionResult {
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [finalTranscript, setFinalTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Détection capability : sync au render (évite cascading renders)
  const isSupported =
    typeof window !== "undefined" && getSpeechRecognitionCtor() !== null;

  const start = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setError("Transcription non supportée sur ce navigateur");
      return;
    }
    setError(null);
    setFinalTranscript("");
    setInterimTranscript("");

    const r = new Ctor();
    r.lang = lang;
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;

    r.onstart = () => setIsListening(true);
    r.onend = () => setIsListening(false);
    r.onerror = (e) => {
      // "no-speech" et "aborted" sont normaux, on les ignore
      if (e.error !== "no-speech" && e.error !== "aborted") {
        setError(e.error || "Erreur de transcription");
      }
      setIsListening(false);
    };
    r.onresult = (event) => {
      let interim = "";
      let finalAccum = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) {
          finalAccum += transcript;
        } else {
          interim += transcript;
        }
      }
      if (finalAccum) {
        setFinalTranscript((prev) => prev + finalAccum);
      }
      setInterimTranscript(interim);
    };

    recognitionRef.current = r;
    try {
      r.start();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur au démarrage");
      setIsListening(false);
    }
  }, [lang]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const reset = useCallback(() => {
    setFinalTranscript("");
    setInterimTranscript("");
    setError(null);
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  return {
    isSupported,
    isListening,
    finalTranscript,
    interimTranscript,
    error,
    start,
    stop,
    reset,
  };
}
