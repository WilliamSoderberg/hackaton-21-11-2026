"use client";

import { useEffect, useRef, useState } from "react";

// Minimal typings for the Web Speech API, which TypeScript's DOM lib does not include.
type SpeechRecognitionResultLike = { isFinal: boolean; 0: { transcript: string } };
type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechRecognitionResultLike };
};
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export function isSpeechRecognitionSupported() {
  return getRecognitionCtor() !== undefined;
}

const errorMessages: Record<string, string> = {
  "not-allowed": "Microphone access was blocked. Allow it in the browser's address bar and answer the call again.",
  "service-not-allowed": "Speech recognition is not allowed in this browser.",
  "audio-capture": "No microphone was found.",
  network: "Speech recognition needs an internet connection. Answer the call again once you are online.",
};

// Listens to the microphone while `listening` is true. Finished phrases go to `onFinal`;
// the phrase currently being spoken is returned as `interim`.
export function useSpeechRecognition({
  listening,
  lang,
  onFinal,
  onError,
}: {
  listening: boolean;
  lang: string;
  onFinal: (text: string) => void;
  onError: (message: string) => void;
}) {
  const [interim, setInterim] = useState("");
  const callbacks = useRef({ onFinal, onError });
  useEffect(() => {
    callbacks.current = { onFinal, onError };
  });

  useEffect(() => {
    const Ctor = getRecognitionCtor();
    if (!listening || !Ctor) return;

    let stopped = false;
    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;

    recognition.onresult = (event) => {
      let pending = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript.trim();
        if (result.isFinal) {
          if (text) callbacks.current.onFinal(text);
        } else {
          pending += result[0].transcript;
        }
      }
      setInterim(pending.trim());
    };

    recognition.onerror = (event) => {
      // Silence and our own abort() are expected; everything else is shown to the user.
      if (event.error === "no-speech" || event.error === "aborted") return;
      callbacks.current.onError(errorMessages[event.error] ?? `Speech recognition error: ${event.error}`);
      stopped = true;
    };

    // Browsers end recognition after a pause, so keep restarting until the call ends.
    recognition.onend = () => {
      setInterim("");
      if (!stopped) recognition.start();
    };

    recognition.start();
    return () => {
      stopped = true;
      // stop(), not abort(): the phrase still being spoken is delivered as a
      // final result, so muting right after talking doesn't lose the last words.
      recognition.stop();
    };
  }, [listening, lang]);

  return listening ? interim : "";
}
