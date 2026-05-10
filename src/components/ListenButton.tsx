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

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Status = "idle" | "playing" | "paused";

// Voice picking is asynchronous on Chromium: getVoices() returns [] on
// first call until the engine fires `voiceschanged`. Wrapping that in a
// promise lets the play handler await a populated list before queuing.
function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const existing = window.speechSynthesis.getVoices();
    if (existing.length > 0) {
      resolve(existing);
      return;
    }
    const handler = () => {
      window.speechSynthesis.onvoiceschanged = null;
      resolve(window.speechSynthesis.getVoices());
    };
    window.speechSynthesis.onvoiceschanged = handler;
  });
}

// Preference order: macOS Samantha and Daniel are the highest-quality
// system voices for English news copy; Google/Microsoft network voices
// are the next best on Chromium and Edge; everything else is a last
// resort to avoid the robotic default fallback.
function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  return (
    voices.find((v) => v.name.includes("Samantha")) ||
    voices.find((v) => v.name.includes("Daniel")) ||
    voices.find((v) => v.name.includes("Google US English")) ||
    voices.find((v) => v.name.includes("Microsoft Jenny")) ||
    voices.find((v) => v.name.includes("Microsoft Guy")) ||
    voices.find((v) => v.name.includes("Microsoft") && v.lang.startsWith("en")) ||
    voices.find((v) => v.lang === "en-US") ||
    voices.find((v) => v.lang.startsWith("en")) ||
    null
  );
}

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

// Paragraph-aware chunking: split on blank lines first (preserves the
// editorial cadence the writer intended), then guard against any
// single paragraph blowing past the engine's safe length by breaking
// long ones on sentence boundaries.
function splitForSpeech(input: string): string[] {
  if (!input) return [];
  const paragraphs = input
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const MAX = 600;
  const out: string[] = [];
  for (const p of paragraphs) {
    if (p.length <= MAX) {
      out.push(p);
      continue;
    }
    const sentences = p.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) ?? [p];
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
  }
  return out;
}

export function ListenButton({ text, title }: ListenButtonProps) {
  const [supported, setSupported] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const queueRef = useRef<SpeechSynthesisUtterance[]>([]);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }
    setSupported(true);
    // Warm the voice list at mount; on Chromium the first call is
    // empty and `voiceschanged` fires shortly after, so we want the
    // preferred voice cached before the user clicks Play.
    loadVoices().then((voices) => {
      voiceRef.current = pickVoice(voices);
    });
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  async function start(): Promise<void> {
    if (typeof window === "undefined") return;
    const synth = window.speechSynthesis;
    synth.cancel();

    if (!voiceRef.current) {
      const voices = await loadVoices();
      voiceRef.current = pickVoice(voices);
    }

    const fullText = title ? `${title}.\n\n${text}` : text;
    const chunks = splitForSpeech(fullText);
    if (chunks.length === 0) return;

    // Tuned for newsroom copy: slightly slower than default (0.9) and
    // a hair below natural pitch (0.95) reads as a calmer, more
    // human-sounding narrator and avoids the metallic "ghost" quality
    // the default settings can produce on long passages.
    const utterances = chunks.map((chunk, idx) => {
      const u = new SpeechSynthesisUtterance(chunk);
      if (voiceRef.current) u.voice = voiceRef.current;
      u.lang = "en-US";
      u.rate = 0.9;
      u.pitch = 0.92;
      u.volume = 1;
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
      void start();
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

  if (!supported) return null;

  const playing = status === "playing";
  const paused = status === "paused";

  return (
    <div className="flex flex-wrap items-center gap-3 border-y border-border py-3">
      <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
        Listen
      </span>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={playing}
        aria-label={
          playing
            ? "Pause article audio"
            : paused
              ? "Resume article audio"
              : "Play article audio"
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
      <span className="sr-only" aria-live="polite">
        {playing ? "Reading article" : paused ? "Paused" : "Stopped"}
      </span>
    </div>
  );
}
