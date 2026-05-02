"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  queuedCreateIdea,
  queuedUpdateIdea,
} from "@/lib/offline-queue";
import { useAudioRecorder } from "@/lib/useAudioRecorder";
import { useSpeechRecognition } from "@/lib/useSpeechRecognition";

const AUTOSAVE_DELAY_MS = 5000;
const AUTOSAVE_MIN_CHARS = 20;

type Toast = { id: number; kind: "ok" | "err"; message: string };

type SaveState = "idle" | "saving" | "saved" | "error";

export function IdeaCapture({ initialCount }: { initialCount: number }) {
  const [content, setContent] = useState("");
  const [ideaId, setIdeaId] = useState<string | null>(null);
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
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pousse un toast (auto-disparaît au bout de 2.5s)
  const pushToast = useCallback((kind: Toast["kind"], message: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, kind, message }]);
    setTimeout(
      () => setToasts((prev) => prev.filter((t) => t.id !== id)),
      2500,
    );
  }, []);

  // Pendant la dictée, on affiche : baseText + transcript final + interim.
  // En dehors de la dictée, on affiche le content tapé.
  const displayedContent = isDictationMode
    ? `${baseText}${
        baseText && (speech.finalTranscript || speech.interimTranscript)
          ? "\n"
          : ""
      }${speech.finalTranscript}${speech.interimTranscript}`
    : content;

  // ============================================================
  // Sauvegarde
  // ============================================================
  const persist = useCallback(
    async (opts: { silent: boolean }): Promise<boolean> => {
      const trimmed = content.trim();
      if (!trimmed) return false;
      setSaveState("saving");
      try {
        if (ideaId) {
          await queuedUpdateIdea(ideaId, {
            content: trimmed,
          });
          setSaveState("saved");
          if (!opts.silent) pushToast("ok", "Idée enregistrée ✓");
        } else {
          const idea = await queuedCreateIdea({
            content: trimmed,
            transcriptionSource,
          });
          setIdeaId(idea.id);
          setSaveState("saved");
          setCount((c) => c + 1);
          if (!opts.silent) {
            const offlineHint =
              typeof navigator !== "undefined" && !navigator.onLine
                ? " (en attente)"
                : "";
            pushToast("ok", `Idée enregistrée ✓${offlineHint}`);
          }
        }
        return true;
      } catch (e) {
        setSaveState("error");
        const msg = e instanceof Error ? e.message : "Erreur de sauvegarde";
        if (!opts.silent) pushToast("err", msg);
        return false;
      }
    },
    [content, ideaId, transcriptionSource, pushToast],
  );

  // Submit manuel ("Sauver")
  const speechReset = speech.reset;
  const onSave = useCallback(async () => {
    const ok = await persist({ silent: false });
    if (ok) {
      setContent("");
      setBaseText("");
      setIdeaId(null);
      setTranscriptionSource("text");
      setSaveState("idle");
      speechReset();
      textareaRef.current?.focus();
    }
  }, [persist, speechReset]);

  // Auto-save debounce
  useEffect(() => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    if (content.trim().length < AUTOSAVE_MIN_CHARS) return;
    if (speech.isListening) return; // pas pendant la dictée
    autosaveTimerRef.current = setTimeout(() => {
      void persist({ silent: true });
    }, AUTOSAVE_DELAY_MS);
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [content, persist, speech.isListening]);

  // Sauvegarde au beforeunload (fermeture onglet/app)
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (
        content.trim().length >= AUTOSAVE_MIN_CHARS &&
        saveState !== "saved"
      ) {
        // On tente une sauvegarde sync. Note: les browsers limitent fortement
        // ce qu'on peut faire ici. On utilise sendBeacon-like via fetch keepalive.
        e.preventDefault();
        void persist({ silent: true });
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [content, persist, saveState]);

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
    // Démarrer enregistrement audio en parallèle (backup) — si supporté
    if (recorderIsSupported) {
      const ok = await recorderStart();
      if (!ok) {
        pushToast("err", recorderError ?? "Micro indisponible");
        setIsDictationMode(false);
        return;
      }
    }
    // Démarrer transcription si supportée
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

    // Commit la transcription finale dans le state `content`.
    // On inclut aussi interimTranscript : sur Safari iOS, la dernière phrase
    // peut rester en "interim" si on stoppe vite après avoir parlé.
    const transcript = speech.finalTranscript + speech.interimTranscript;
    const finalContent = (
      baseText + (baseText && transcript ? "\n" : "") + transcript
    ).trim();
    setContent(finalContent);
    setIsDictationMode(false);

    if (!recorderIsRecording) return;

    const audio = await recorderStop();
    if (!audio) return;

    setSaveState("saving");
    try {
      if (!ideaId) {
        // Nouvelle idée : queuedCreate gère insert + upload audio (online ou queue)
        const idea = await queuedCreateIdea({
          content: finalContent,
          transcriptionSource: "audio",
          audio: {
            blob: audio.blob,
            mimeType: audio.mimeType,
            durationMs: audio.durationMs,
          },
        });
        setIdeaId(idea.id);
        setCount((c) => c + 1);
      } else {
        // Idée existante : update content + tente upload audio
        await queuedUpdateIdea(ideaId, {
          content: finalContent,
        });
        // Pour l'audio sur idée existante : si online on tente direct,
        // si fail réseau queuedCreateIdea-like behavior n'est pas dispo.
        // Fallback simple : tente l'upload, ignore l'erreur sinon (pas idéal
        // mais le cas est rare : créer une idée à partir d'un texte tapé,
        // PUIS dicter par-dessus avec réseau qui tombe juste à ce moment).
        try {
          const { uploadAudioForIdea } = await import("@/lib/ideas");
          await uploadAudioForIdea(ideaId, audio);
        } catch {
          pushToast("err", "Audio non uploadé (réessaie plus tard)");
        }
      }
      setSaveState("saved");
      const offlineHint =
        typeof navigator !== "undefined" && !navigator.onLine
          ? " (en attente)"
          : "";
      pushToast("ok", `Audio enregistré ✓${offlineHint}`);
    } catch (e) {
      setSaveState("error");
      pushToast("err", e instanceof Error ? e.message : "Erreur");
    }
  }, [
    baseText,
    recorderIsRecording,
    recorderStop,
    speechStop,
    speech.finalTranscript,
    speech.interimTranscript,
    ideaId,
    pushToast,
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
