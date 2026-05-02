"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type AudioBlobResult = {
  blob: Blob;
  mimeType: string;
  durationMs: number;
};

export type UseAudioRecorderResult = {
  isSupported: boolean;
  isRecording: boolean;
  error: string | null;
  /** Démarre l'enregistrement. Retourne true si OK, false si erreur. */
  start: () => Promise<boolean>;
  /** Arrête l'enregistrement et résout avec le blob audio. */
  stop: () => Promise<AudioBlobResult | null>;
};

const PREFERRED_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
  "audio/ogg",
];

function pickSupportedMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const t of PREFERRED_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return null;
}

export function useAudioRecorder(): UseAudioRecorderResult {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSupported =
    typeof window !== "undefined" &&
    typeof navigator?.mediaDevices?.getUserMedia === "function" &&
    typeof MediaRecorder !== "undefined" &&
    pickSupportedMimeType() !== null;

  const start = useCallback(async (): Promise<boolean> => {
    setError(null);
    const mimeType = pickSupportedMimeType();
    if (!mimeType) {
      setError("Enregistrement audio non supporté");
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start(1000); // chunks de 1s
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      setIsRecording(true);
      return true;
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Permission micro refusée ou indisponible",
      );
      return false;
    }
  }, []);

  const stop = useCallback((): Promise<AudioBlobResult | null> => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current;
      if (!recorder) {
        resolve(null);
        return;
      }
      const mimeType = recorder.mimeType;
      recorder.onstop = () => {
        const durationMs = Date.now() - startedAtRef.current;
        const blob = new Blob(chunksRef.current, { type: mimeType });
        // Cleanup tracks
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        recorderRef.current = null;
        chunksRef.current = [];
        setIsRecording(false);
        resolve({ blob, mimeType, durationMs });
      };
      try {
        recorder.stop();
      } catch {
        setIsRecording(false);
        resolve(null);
      }
    });
  }, []);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      try {
        recorderRef.current?.stop();
      } catch {
        // ignore
      }
    };
  }, []);

  return { isSupported, isRecording, error, start, stop };
}
