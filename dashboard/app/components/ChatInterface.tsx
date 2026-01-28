"use client";

import { useMemo, useState, FormEvent, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { Mic, Volume2, VolumeX, Send } from "lucide-react";
import { sendChatMessage } from "@/lib/api";
import { GlassPanel } from "@/app/components/ui/GlassPanel";

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

interface ChatInterfaceProps {
  header?: React.ReactNode;
}

export default function ChatInterface({ header }: ChatInterfaceProps) {
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
  const [isTTSSupported, setIsTTSSupported] = useState(false);
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
    setIsTTSSupported(typeof window !== "undefined" && "speechSynthesis" in window);
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
    <GlassPanel 
      className="h-full relative" 
      header={header}
      footer={
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3"
        >
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Message
          </label>
          <div className="flex gap-3">
            <div className="relative flex-1 group">
              <input
                type="text"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Type a question about AquaMine data..."
                className="w-full rounded-2xl border border-white/20 bg-white/10 px-5 py-3 pr-12 text-sm text-slate-800 placeholder-slate-500 shadow-inner outline-none transition focus:border-cyan-400 focus:bg-white/20 focus:ring-2 focus:ring-cyan-100/30"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={handleMicClick}
                disabled={!isSpeechRecognitionSupported || isLoading}
                aria-pressed={isListening}
                aria-label={isListening ? "Stop voice input" : "Start voice input"}
                title={isListening ? "Stop voice input" : "Start voice input"}
                className={`absolute right-2 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-lg p-2 transition ${
                  isListening
                    ? "text-red-500 animate-pulse bg-red-50/50"
                    : "text-slate-400 hover:text-cyan-600 hover:bg-white/20"
                } ${!isSpeechRecognitionSupported || isLoading ? "cursor-not-allowed opacity-50" : ""}`}
              >
                <Mic className="h-4 w-4" />
              </button>
            </div>
            <button
              type="submit"
              disabled={isLoading || input.trim().length === 0}
              className="flex items-center justify-center rounded-xl bg-gradient-to-r from-teal-400 to-cyan-400 px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? "..." : <Send className="h-5 w-5" />}
            </button>
          </div>
        </form>
      }
    >
      <div className="absolute right-6 top-6 z-10">
        <button
          type="button"
          onClick={() => setIsTTSEnabled((prev) => !prev)}
          className={`flex h-10 w-10 items-center justify-center rounded-full border shadow-sm transition backdrop-blur-sm ${
            isTTSEnabled
              ? "border-cyan-200 bg-cyan-50 text-cyan-600"
              : "border-white/40 bg-white/30 text-slate-400 hover:bg-white/50 hover:text-slate-600"
          } ${!isTTSSupported ? "cursor-not-allowed opacity-50" : ""}`}
          disabled={!isTTSSupported}
          aria-pressed={isTTSEnabled}
          aria-label={isTTSEnabled ? "Disable voice output" : "Enable voice output"}
          title={isTTSEnabled ? "Disable voice output" : "Enable voice output"}
        >
          {isTTSEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
        </button>
      </div>

      <div className="flex-1 h-full overflow-y-auto space-y-4 pt-8 pr-2">
        {messages.length === 0 && !isLoading && (
          <div className="mx-auto mt-10 max-w-sm rounded-2xl border border-dashed border-slate-300 bg-white/20 p-8 text-center text-sm text-slate-500 backdrop-blur-sm">
            Ask about sensor anomalies, AMD insights, or remediation steps.
          </div>
        )}

        {messages.map((message, index) => {
          const isUser = message.role === "user";
          return (
            <div
              key={`${message.role}-${index}`}
              className={`max-w-[80%] rounded-2xl px-5 py-4 text-sm leading-relaxed shadow-sm backdrop-blur-md ${
                isUser
                  ? "ml-auto bg-cyan-500 text-white rounded-tr-sm"
                  : "mr-auto bg-white/60 border border-white/50 text-slate-800 rounded-tl-sm"
              }`}
            >
              {isUser ? (
                <p className="whitespace-pre-wrap">{message.content}</p>
              ) : (
                <div className="prose prose-sm prose-slate max-w-none">
                  <ReactMarkdown>{message.content}</ReactMarkdown>
                </div>
              )}
            </div>
          );
        })}

        {isLoading && (
          <div className="mr-auto max-w-[75%] rounded-2xl rounded-tl-sm border border-white/50 bg-white/60 px-5 py-4 text-sm text-slate-500 shadow-sm backdrop-blur-md">
            <div className="flex space-x-2">
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        )}
      </div>
    </GlassPanel>
  );
}
