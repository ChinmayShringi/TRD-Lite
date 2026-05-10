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
// Strict allowlist of natural-sounding US English female voices.
// Order is preference. We deliberately do NOT fall through to a
// generic en-US voice: the platform-default voice on most devices is
// the robotic eSpeak / Microsoft David variant, which undermines the
// "human narrator" feel we want for editorial copy. If none of these
// match, the caller hides the Listen control entirely.
function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  // The "Online" suffix on Edge ships as "Microsoft Jenny Online
  // (Natural) - English (United States)". `includes` matches the
  // common substring across browser variants.
  const enUsFemaleHints = [
    "female",
    "samantha",
    "jenny",
    "aria",
    "zira",
    "ava",
    "nova",
    "sonia",
  ];
  return (
    voices.find((v) => v.name.includes("Microsoft Jenny Online")) ||
    voices.find((v) => v.name.includes("Microsoft Aria Online")) ||
    voices.find(
      (v) => v.name.includes("Samantha") && v.lang.startsWith("en"),
    ) ||
    voices.find(
      (v) =>
        v.name.includes("Google US English") &&
        v.name.toLowerCase().includes("female"),
    ) ||
    voices.find((v) => v.name.includes("Microsoft Zira")) ||
    voices.find((v) => {
      if (v.lang !== "en-US") return false;
      const lower = v.name.toLowerCase();
      return enUsFemaleHints.some((hint) => lower.includes(hint));
    }) ||
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
  // `null` while we're still resolving voice availability; once
  // resolved, `false` means hide the button (no suitable voice on
  // this device) and `true` means show it. Three-state avoids the
  // flicker of mounting the button and then yanking it once voices
  // arrive on Chromium.
  const [available, setAvailable] = useState<boolean | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const queueRef = useRef<SpeechSynthesisUtterance[]>([]);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setAvailable(false);
      return;
    }
    let cancelled = false;
    loadVoices().then((voices) => {
      if (cancelled) return;
      const picked = pickVoice(voices);
      voiceRef.current = picked;
      setAvailable(picked !== null);
    });
    return () => {
      cancelled = true;
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
    if (!voiceRef.current) {
      // Refuse to fall back to the platform default robotic voice.
      // The button is normally hidden when no preferred voice is
      // available; this guards a race where the user clicks before
      // the voice list resolved.
      return;
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
      u.rate = 0.88;
      u.pitch = 1.02;
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

  // Render nothing while we're still checking, and nothing if no
  // suitable voice was found.
  if (available !== true) return null;

  const playing = status === "playing";
  const paused = status === "paused";

  return (
    <div className="flex items-center gap-3 border-y border-border py-3">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={playing}
        aria-label={playing ? "Pause article audio" : "Play article audio"}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      >
        {playing ? (
          <Pause className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Play className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
      <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
        Listen
      </span>
      <span className="sr-only" aria-live="polite">
        {playing ? "Reading article" : paused ? "Paused" : "Stopped"}
      </span>
    </div>
  );
}
