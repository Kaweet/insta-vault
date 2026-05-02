"use client";

import { useCallback, useRef, useState } from "react";
import { saveIdea } from "@/lib/offline";
import { useAudioRecorder } from "@/lib/useAudioRecorder";
import { useSpeechRecognition } from "@/lib/useSpeechRecognition";

type Toast = { id: number; kind: "ok" | "err"; message: string };

type SaveState = "idle" | "saving" | "saved" | "error";

export function IdeaCapture({ initialCount }: { initialCount: number }) {
  const [content, setContent] = useState("");
  const [count, setCount] = useState(initialCount);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [transcriptionSource, setTranscriptionSource] = useState<
    "text" | "audio"
  >("text");

  const speech = useSpeechRecognition("fr-FR");
  const recorder = useAudioRecorder();

  // Texte présent au démarrage de la dictée — ré-injecté en préfixe pendant.
  const [baseText, setBaseText] = useState("");
  const [isDictationMode, setIsDictationMode] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const persistInFlightRef = useRef(false);

  const pushToast = useCallback((kind: Toast["kind"], message: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, kind, message }]);
    setTimeout(
      () => setToasts((prev) => prev.filter((t) => t.id !== id)),
      2500,
    );
  }, []);

  // Pendant la dictée : baseText + transcript final + interim. Sinon content.
  const displayedContent = isDictationMode
    ? `${baseText}${
        baseText && (speech.finalTranscript || speech.interimTranscript)
          ? "\n"
          : ""
      }${speech.finalTranscript}${speech.interimTranscript}`
    : content;

  // ============================================================
  // Sauvegarde — chaque save crée une nouvelle idée. Pas d'auto-save.
  // ============================================================
  const speechReset = speech.reset;
  const doSave = useCallback(
    async (params: {
      content: string;
      transcriptionSource: "text" | "audio";
      audio?: { blob: Blob; mimeType: string; durationMs: number };
    }): Promise<boolean> => {
      const trimmed = params.content.trim();
      if (!trimmed && !params.audio) return false;
      if (persistInFlightRef.current) return false;
      persistInFlightRef.current = true;
      setSaveState("saving");
      try {
        const result = await saveIdea({
          content: trimmed,
          transcriptionSource: params.transcriptionSource,
          audio: params.audio,
        });
        setSaveState("saved");
        setCount((c) => c + 1);
        const hint = result.kind === "pending" ? " (en attente)" : "";
        pushToast("ok", `Idée enregistrée ✓${hint}`);
        return true;
      } catch (e) {
        setSaveState("error");
        pushToast("err", e instanceof Error ? e.message : "Erreur");
        return false;
      } finally {
        persistInFlightRef.current = false;
      }
    },
    [pushToast],
  );

  const onSave = useCallback(async () => {
    const ok = await doSave({ content, transcriptionSource });
    if (ok) {
      setContent("");
      setBaseText("");
      setTranscriptionSource("text");
      setSaveState("idle");
      speechReset();
      textareaRef.current?.focus();
    }
  }, [content, transcriptionSource, doSave, speechReset]);

  // ============================================================
  // Dictée
  // ============================================================
  const speechStart = speech.start;
  const speechStop = speech.stop;
  const speechIsSupported = speech.isSupported;
  const recorderStart = recorder.start;
  const recorderStop = recorder.stop;
  const recorderIsSupported = recorder.isSupported;
  const recorderError = recorder.error;
  const recorderIsRecording = recorder.isRecording;

  const startDictation = useCallback(async () => {
    setBaseText(content);
    setIsDictationMode(true);
    setTranscriptionSource("audio");
    speechReset();
    if (recorderIsSupported) {
      const ok = await recorderStart();
      if (!ok) {
        pushToast("err", recorderError ?? "Micro indisponible");
        setIsDictationMode(false);
        return;
      }
    }
    if (speechIsSupported) {
      speechStart();
    } else {
      pushToast("ok", "Audio enregistré (transcription indisponible)");
    }
  }, [
    content,
    recorderIsSupported,
    recorderStart,
    recorderError,
    speechIsSupported,
    speechStart,
    speechReset,
    pushToast,
  ]);

  const stopDictation = useCallback(async () => {
    speechStop();
    const transcript = speech.finalTranscript + speech.interimTranscript;
    const finalContent = (
      baseText + (baseText && transcript ? "\n" : "") + transcript
    ).trim();
    setContent(finalContent);
    setIsDictationMode(false);

    if (!recorderIsRecording) return;
    const audio = await recorderStop();
    if (!audio) return;

    const ok = await doSave({
      content: finalContent,
      transcriptionSource: "audio",
      audio: {
        blob: audio.blob,
        mimeType: audio.mimeType,
        durationMs: audio.durationMs,
      },
    });
    if (ok) {
      setContent("");
      setBaseText("");
      setTranscriptionSource("text");
      setSaveState("idle");
      speechReset();
    }
  }, [
    baseText,
    doSave,
    recorderIsRecording,
    recorderStop,
    speechStop,
    speech.finalTranscript,
    speech.interimTranscript,
    speechReset,
  ]);

  // ============================================================
  // UI
  // ============================================================
  const isDictating = speech.isListening || recorder.isRecording;
  const charCount = content.trim().length;

  return (
    <div className="flex w-full max-w-2xl flex-col gap-4">
      <div className="relative">
        <textarea
          ref={textareaRef}
          autoFocus
          value={displayedContent}
          readOnly={isDictationMode}
          onChange={(e) => {
            if (isDictationMode) return;
            setContent(e.target.value);
            setTranscriptionSource("text");
            // Si on édite après une sauvegarde, on repasse en idle
            // pour que l'auto-save puisse re-déclencher.
            setSaveState((prev) => (prev === "saved" ? "idle" : prev));
          }}
          placeholder={
            isDictating ? "🎙️ Parle…" : "Quelle est ton idée ?"
          }
          rows={6}
          className="w-full resize-none rounded-2xl border border-neutral-200 bg-white px-5 py-4 text-base text-neutral-900 shadow-sm outline-none transition focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-50 dark:focus:border-neutral-600 dark:focus:ring-neutral-700"
        />
        {isDictating ? (
          <div className="absolute right-3 top-3 flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
            </span>
            <span className="text-xs font-medium text-red-600 dark:text-red-400">
              REC
            </span>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {!isDictating ? (
          <button
            type="button"
            onClick={startDictation}
            className="inline-flex h-12 flex-1 min-w-[140px] items-center justify-center gap-2 rounded-full border border-neutral-200 bg-white px-5 text-sm font-medium text-neutral-900 shadow-sm transition hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-50 dark:hover:bg-neutral-800"
          >
            🎤 Dicter
          </button>
        ) : (
          <button
            type="button"
            onClick={stopDictation}
            className="inline-flex h-12 flex-1 min-w-[140px] items-center justify-center gap-2 rounded-full bg-red-500 px-5 text-sm font-medium text-white shadow-sm transition hover:bg-red-600"
          >
            ⏹ Stop
          </button>
        )}
        <button
          type="button"
          onClick={onSave}
          disabled={charCount === 0 || saveState === "saving" || isDictating}
          className="inline-flex h-12 flex-1 min-w-[140px] items-center justify-center gap-2 rounded-full bg-neutral-900 px-5 text-sm font-medium text-white shadow-sm transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          {saveState === "saving" ? "…" : "✓ Sauver"}
        </button>
      </div>

      {/* Status line */}
      <div className="flex items-center justify-between gap-3 px-2 text-xs text-neutral-500 dark:text-neutral-400">
        <span className="shrink-0">
          {charCount} car.
          {saveState === "saved" && !isDictating ? " · enregistré" : ""}
        </span>
        <span
          className={`truncate text-right ${
            recorder.error || (speech.error && !isDictating)
              ? "text-amber-600 dark:text-amber-400"
              : ""
          }`}
        >
          {recorder.error
            ? `🎤 ${recorder.error}`
            : speech.error && !isDictating
              ? `🗣️ ${speech.error}`
              : isDictating && speech.isListening
                ? speech.finalTranscript || speech.interimTranscript
                  ? `🗣️ Transcription en cours…`
                  : `🗣️ En écoute…`
                : isDictating && !speech.isSupported
                  ? "🗣️ Transcription indispo (audio gardé)"
                  : !speech.isSupported && !isDictating
                    ? ""
                    : ""}
        </span>
      </div>

      <p className="mt-2 self-center text-xs text-neutral-400">
        {count} idée{count > 1 ? "s" : ""} dans le carnet
      </p>

      {/* Toasts */}
      <div className="pointer-events-none fixed inset-x-0 bottom-6 flex justify-center px-4">
        <div className="flex w-full max-w-sm flex-col gap-2">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`pointer-events-auto rounded-full px-4 py-2 text-sm font-medium shadow-lg ${
                t.kind === "ok"
                  ? "bg-neutral-900 text-white dark:bg-neutral-50 dark:text-neutral-900"
                  : "bg-red-500 text-white"
              }`}
            >
              {t.message}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
