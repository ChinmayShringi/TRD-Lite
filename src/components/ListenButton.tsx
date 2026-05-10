/**
 * Browser-native text-to-speech control. Reads the article body using
 * `window.speechSynthesis` (Web Speech API): zero backend, zero API key,
 * zero per-character cost, and the audio is generated entirely on the
 * reader's device. No analytics, no upload, no third-party voice.
 *
 * Behavior:
 *  - First click: chunks the text on sentence boundaries and queues
 *    SpeechSynthesisUtterance objects so very long articles don't hit
 *    the browser's per-utterance length cap (Chrome empirically cuts
 *    around 32k chars; chunking also lets us stop instantly without
 *    waiting for a giant utterance to drain).
 *  - Subsequent clicks toggle pause / resume.
 *  - Stop button cancels the queue.
 *
 * Accessibility:
 *  - Buttons carry aria-pressed for state, and the live region announces
 *    "Reading", "Paused", "Stopped" so screen-reader users get parity
 *    with the visual state.
 *  - Hidden entirely if the browser doesn't expose speechSynthesis (no
 *    fallback noise; users without TTS just see the article as normal).
 */
"use client";

import { Pause, Play, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Status = "idle" | "playing" | "paused";

export interface ListenButtonProps {
  /**
   * Plain-text body of the article. The caller is responsible for
   * stripping HTML before passing it in (sanitize-html / stripHtml in
   * `src/lib/seo.ts` already do this for excerpts; we apply the same
   * treatment to contentHtml here at the call site).
   */
  text: string;
  /** Optional title prepended to the spoken output. */
  title?: string;
}

function splitForSpeech(input: string): string[] {
  const cleaned = input.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  // Split on sentence-ending punctuation followed by whitespace. Keep
  // the punctuation in the chunk so the synthesizer's prosody honors
  // the pause.
  const sentences = cleaned.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) ?? [
    cleaned,
  ];
  // Re-bucket to ~600-char chunks; very short sentences shouldn't each
  // become their own utterance (queue overhead) and very long ones
  // shouldn't blow past the engine's safe limit.
  const MAX = 600;
  const out: string[] = [];
  let buf = "";
  for (const s of sentences) {
    if ((buf + s).length > MAX && buf.length > 0) {
      out.push(buf.trim());
      buf = s;
    } else {
      buf += s;
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

export function ListenButton({ text, title }: ListenButtonProps) {
  const [supported, setSupported] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const queueRef = useRef<SpeechSynthesisUtterance[]>([]);

  useEffect(() => {
    setSupported(
      typeof window !== "undefined" && "speechSynthesis" in window,
    );
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  function start(): void {
    if (typeof window === "undefined") return;
    const synth = window.speechSynthesis;
    synth.cancel();

    const fullText = title ? `${title}. ${text}` : text;
    const chunks = splitForSpeech(fullText);
    if (chunks.length === 0) return;

    const utterances = chunks.map((chunk, idx) => {
      const u = new SpeechSynthesisUtterance(chunk);
      u.rate = 1;
      u.pitch = 1;
      u.lang = "en-US";
      if (idx === chunks.length - 1) {
        u.onend = () => setStatus("idle");
      }
      return u;
    });
    queueRef.current = utterances;
    utterances.forEach((u) => synth.speak(u));
    setStatus("playing");
  }

  function toggle(): void {
    const synth = window.speechSynthesis;
    if (status === "idle") {
      start();
      return;
    }
    if (status === "playing") {
      synth.pause();
      setStatus("paused");
      return;
    }
    synth.resume();
    setStatus("playing");
  }

  function stop(): void {
    if (typeof window === "undefined") return;
    window.speechSynthesis.cancel();
    queueRef.current = [];
    setStatus("idle");
  }

  if (!supported) return null;

  const playing = status === "playing";
  const paused = status === "paused";

  return (
    <div className="flex flex-wrap items-center gap-3 border-y border-border py-3">
      <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
        Listen
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggle}
          aria-pressed={playing}
          aria-label={
            playing ? "Pause article audio" : paused ? "Resume article audio" : "Play article audio"
          }
          className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 font-sans text-xs font-semibold uppercase tracking-[0.2em] text-foreground transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          {playing ? (
            <Pause className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Play className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          <span>{playing ? "Pause" : paused ? "Resume" : "Play"}</span>
        </button>
        <button
          type="button"
          onClick={stop}
          disabled={status === "idle"}
          aria-label="Stop article audio"
          className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 font-sans text-xs font-semibold uppercase tracking-[0.2em] text-foreground transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Square className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Stop</span>
        </button>
      </div>
      <span className="sr-only" aria-live="polite">
        {playing ? "Reading article" : paused ? "Paused" : "Stopped"}
      </span>
    </div>
  );
}
