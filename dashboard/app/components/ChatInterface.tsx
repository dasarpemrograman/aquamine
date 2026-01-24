"use client";

import { useMemo, useState, FormEvent, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { Mic, Volume2, VolumeX } from "lucide-react";
import { sendChatMessage } from "@/lib/api";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: any) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: any) => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

export default function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState("");
  const [isTTSEnabled, setIsTTSEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const lastSpokenIndexRef = useRef<number | null>(null);
  const speechRecognitionConstructor = useMemo(() => {
    if (typeof window === "undefined") {
      return null;
    }

    const windowWithSpeech = window as typeof window & {
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
      SpeechRecognition?: SpeechRecognitionConstructor;
    };

    return (
      windowWithSpeech.SpeechRecognition ??
      windowWithSpeech.webkitSpeechRecognition ??
      null
    );
  }, []);
  const isSpeechRecognitionSupported = Boolean(speechRecognitionConstructor);
  const isTTSSupported =
    typeof window !== "undefined" && "speechSynthesis" in window;
  const sessionId = useMemo(() => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }

    return `session-${Date.now()}`;
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = input.trim();

    if (!trimmed || isLoading) {
      return;
    }

    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    setIsLoading(true);

    try {
      const data = await sendChatMessage(trimmed, sessionId);
      setMessages((prev) => [...prev, { role: "assistant", content: data.response }]);
    } catch (error) {
      const fallback =
        error instanceof Error
          ? error.message
          : "Unable to reach the assistant right now.";
      setMessages((prev) => [...prev, { role: "assistant", content: fallback }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMicClick = () => {
    if (!speechRecognitionConstructor || isLoading) {
      return;
    }

    if (!recognitionRef.current) {
      const recognition = new speechRecognitionConstructor();
      recognition.lang = "id-ID";
      recognition.interimResults = false;
      recognition.continuous = false;
      recognition.onresult = (event) => {
        const transcript = event?.results?.[0]?.[0]?.transcript;
        if (transcript) {
          setInput(transcript);
        }
      };
      recognition.onend = () => {
        setIsListening(false);
      };
      recognition.onerror = () => {
        setIsListening(false);
      };
      recognitionRef.current = recognition;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    setIsListening(true);

    try {
      recognitionRef.current?.start();
    } catch (error) {
      setIsListening(false);
    }
  };

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    const lastIndex = messages.length - 1;
    const lastMessage = messages[lastIndex];

    if (!lastMessage || lastMessage.role !== "assistant") {
      return;
    }

    if (!isTTSSupported || !isTTSEnabled) {
      lastSpokenIndexRef.current = lastIndex;
      return;
    }

    if (lastSpokenIndexRef.current === lastIndex) {
      return;
    }

    const utterance = new SpeechSynthesisUtterance(lastMessage.content);
    utterance.lang = "id-ID";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    lastSpokenIndexRef.current = lastIndex;
  }, [messages, isTTSEnabled, isTTSSupported]);

  return (
    <div className="relative flex h-full flex-col rounded-3xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="absolute right-4 top-4 z-10">
        <button
          type="button"
          onClick={() => setIsTTSEnabled((prev) => !prev)}
          className={`flex h-10 w-10 items-center justify-center rounded-full border text-sm shadow-sm transition ${
            isTTSEnabled
              ? "border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-800 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
              : "border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-zinc-200"
          } ${!isTTSSupported ? "cursor-not-allowed opacity-50" : ""}`}
          disabled={!isTTSSupported}
          aria-pressed={isTTSEnabled}
          aria-label={isTTSEnabled ? "Disable voice output" : "Enable voice output"}
          title={isTTSEnabled ? "Disable voice output" : "Enable voice output"}
        >
          {isTTSEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
        </button>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-6 pb-6 pt-14">
        {messages.length === 0 && !isLoading && (
          <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-6 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
            Ask about sensor anomalies, AMD insights, or remediation steps.
          </div>
        )}

        {messages.map((message, index) => {
          const isUser = message.role === "user";
          return (
            <div
              key={`${message.role}-${index}`}
              className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                isUser
                  ? "ml-auto bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900"
                  : "mr-auto border border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              }`}
            >
              {isUser ? (
                <p className="whitespace-pre-wrap">{message.content}</p>
              ) : (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{message.content}</ReactMarkdown>
                </div>
              )}
            </div>
          );
        })}

        {isLoading && (
          <div className="mr-auto max-w-[75%] rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
            Thinking...
          </div>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-3 border-t border-zinc-200 bg-zinc-50 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900/50"
      >
        <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Message
        </label>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Type a question about AquaMine data..."
              className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 pr-12 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-600 dark:focus:ring-zinc-800"
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={handleMicClick}
              disabled={!isSpeechRecognitionSupported || isLoading}
              aria-pressed={isListening}
              aria-label={isListening ? "Stop voice input" : "Start voice input"}
              title={isListening ? "Stop voice input" : "Start voice input"}
              className={`absolute right-2 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-lg border px-2.5 py-2 text-zinc-500 shadow-sm transition ${
                isListening
                  ? "border-red-500/70 bg-red-50 text-red-600 shadow-red-200/60 animate-pulse dark:border-red-500/60 dark:bg-red-500/10 dark:text-red-400 dark:shadow-red-900/40"
                  : "border-zinc-200 bg-white hover:border-zinc-300 hover:text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-zinc-200"
              } ${!isSpeechRecognitionSupported || isLoading ? "cursor-not-allowed opacity-50" : ""}`}
            >
              <Mic className="h-4 w-4" />
            </button>
          </div>
          <button
            type="submit"
            disabled={isLoading || input.trim().length === 0}
            className="rounded-xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white dark:disabled:bg-zinc-700 dark:disabled:text-zinc-300"
          >
            {isLoading ? "Sending" : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}
