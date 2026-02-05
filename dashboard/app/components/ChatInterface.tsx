"use client";

import { useMemo, useState, FormEvent, useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Volume2, VolumeX, Send, ArrowLeft, ClipboardCheck } from "lucide-react";
import { GlassPanel } from "@/app/components/ui/GlassPanel";
import { sendChatMessage } from "@/lib/api";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatInterfaceProps {
  threadId: string;
  onThreadActivity?: () => void;
  onMobileBack?: () => void;
  className?: string;
}

export default function ChatInterface({ threadId, onThreadActivity, onMobileBack, className }: ChatInterfaceProps) {
  const { getToken } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState("");
  const [isCompactionRequired, setIsCompactionRequired] = useState(false);
  const [isTTSEnabled, setIsTTSEnabled] = useState(false);
  const [isFieldMode, setIsFieldMode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastSpokenIndexRef = useRef<number>(-1);

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8181";

  const SUGGESTED_PROMPTS = [
    "Analisis tren pH di Pit A minggu ini",
    "Buat laporan insiden kekeruhan tinggi",
    "Cek status sensor di Station 4",
    "Rekomendasi mitigasi untuk curah hujan tinggi"
  ];

  // Fetch messages when thread changes
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const token = await getToken();
        const response = await fetch(`${API_BASE}/api/v1/chat/threads/${threadId}/messages`, {
          headers: { "Authorization": `Bearer ${token}` },
        });
        
        if (response.ok) {
          const data: unknown = await response.json();
          const messagesValue =
            typeof data === "object" && data !== null && "messages" in data
              ? (data as { messages?: unknown }).messages
              : undefined;

          if (Array.isArray(messagesValue)) {
            const formattedMessages: ChatMessage[] = messagesValue
              .map((message) => {
                if (typeof message !== "object" || message === null) {
                  return null;
                }

                const role = "role" in message ? (message as { role?: unknown }).role : undefined;
                const content = "content" in message ? (message as { content?: unknown }).content : undefined;
                if (typeof role !== "string" || typeof content !== "string") {
                  return null;
                }

                if (role !== "user" && role !== "assistant") {
                  return null;
                }

                return { role, content };
              })
              .filter((message): message is ChatMessage => message !== null);

            setMessages(formattedMessages);
          }
        }
      } catch (error) {
        console.error("Failed to fetch messages:", error);
      }
    };

    if (threadId) {
      fetchMessages();
    }
  }, [threadId, getToken, API_BASE]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleCompaction = async () => {
    if (!threadId) return;
    setIsLoading(true);
    try {
      const token = await getToken();
      
      // 1. Preview
      const previewRes = await fetch(`${API_BASE}/api/v1/chat/threads/${threadId}/compaction/preview`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify({ pending_message: input })
      });
      
      if (!previewRes.ok) throw new Error("Preview failed");
      const previewData = await previewRes.json();

      // 2. Commit (using draft from preview)
      const commitRes = await fetch(`${API_BASE}/api/v1/chat/threads/${threadId}/compaction/commit`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify({ summary: previewData.summary_draft })
      });

      if (!commitRes.ok) throw new Error("Commit failed");

      // 3. Clear messages and reload
      setMessages([]);
      setIsCompactionRequired(false);
      
      // 4. Retry sending the pending message if exists
      if (input.trim()) {
        const fakeEvent = { preventDefault: () => {} } as FormEvent;
        handleSubmit(fakeEvent);
      } else {
        // Just refresh messages
        onThreadActivity?.();
      }
      
    } catch (error) {
      console.error("Compaction failed:", error);
      alert("Failed to compact chat. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    // Optimistic update
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput(""); // Clear input immediately
    setIsLoading(true);

    try {
      const token = await getToken();
      // Using sendChatMessage from API library if possible, but it takes sessionId which might be threadId?
      // Looking at lib/api.ts: sendChatMessage(message, sessionId, token) -> POST /api/v1/chat
      // But here we are posting to /api/v1/chat/threads/${threadId}/messages
      // So we should keep using fetch here for now as it's a different endpoint.
      
      const response = await fetch(`${API_BASE}/api/v1/chat/threads/${threadId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          content: isFieldMode 
            ? `${trimmed} \n\n(Mode: Ringkas Lapangan - Berikan status 1 baris, 3 langkah mitigasi, dan checklist bukti)` 
            : trimmed 
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.compaction_required) {
          setIsCompactionRequired(true);
          setMessages((prev) => [
            ...prev,
            { 
              role: "assistant", 
              content: "⚠️ Memory penuh. Klik tombol di bawah untuk meringkas percakapan dan melanjutkan." 
            },
          ]);
          // Restore input so user can send it after compaction
          setInput(trimmed);
        } else if (data.response) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: data.response },
          ]);
        }

        onThreadActivity?.();
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { 
          role: "assistant", 
          content: "Maaf, terjadi kesalahan. Silakan coba lagi." 
        },
      ]);
      setInput(trimmed); // Restore input on error
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <GlassPanel className={`h-full flex flex-col ${className || ''}`} data-testid="chat-interface" data-thread-id={threadId}>
      {/* Header Mobile & Field Mode */}
      <div className="flex items-center justify-between p-3 border-b border-white/20 bg-white/5">
        <div className="flex items-center gap-2">
          {onMobileBack && (
            <button 
              onClick={onMobileBack}
              className="md:hidden p-2 hover:bg-white/10 rounded-full transition-colors"
              aria-label="Back to threads"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
          )}
        </div>
        
        <button
          onClick={() => setIsFieldMode(!isFieldMode)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            isFieldMode 
              ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" 
              : "bg-white/10 text-slate-500 hover:bg-white/20"
          }`}
        >
          <ClipboardCheck className="w-3.5 h-3.5" />
          Field Summary Mode
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4" data-testid="chat-messages">
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 p-6" data-testid="chat-empty-state">
            <p className="mb-6 text-lg font-medium">Mulai percakapan dengan mengirim pesan...</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl">
              {SUGGESTED_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => setInput(prompt)}
                  className="p-3 text-sm text-left bg-white/40 hover:bg-white/60 border border-white/40 rounded-xl transition-all hover:scale-[1.02] text-slate-700 shadow-sm"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {messages.map((msg, idx) => (
          <div
            key={idx}
            data-testid="chat-message"
            data-role={msg.role}
            className={`max-w-[80%] rounded-2xl px-4 py-3 ${
              msg.role === "user"
                ? "ml-auto bg-cyan-500 text-white rounded-tr-sm"
                : "mr-auto bg-white/60 border border-white/50 text-slate-800 rounded-tl-sm"
            }`}
          >
            {msg.role === "user" ? (
              <p className="whitespace-pre-wrap">{msg.content}</p>
            ) : (
              <div className="prose prose-sm prose-slate max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
              </div>
            )}
          </div>
        ))}
        
        {isLoading && (
          <div className="mr-auto max-w-[75%] rounded-2xl rounded-tl-sm border border-white/50 bg-white/60 px-4 py-3">
            <div className="flex space-x-2">
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        
        {isCompactionRequired && (
          <div className="flex justify-center py-4">
            <button
              onClick={handleCompaction}
              disabled={isLoading}
              className="px-6 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-full font-medium shadow-lg transition-all transform hover:scale-105 flex items-center gap-2"
            >
              <span>⚡ Ringkas Percakapan (Memory Penuh)</span>
            </button>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-white/50 bg-white/5" data-testid="chat-composer">
        <div className="flex gap-2">
          <div className="flex-1">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ketik pesan..."
              data-testid="chat-message-input"
              className="w-full rounded-xl border border-white/50 bg-white/50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
              disabled={isLoading}
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            data-testid="chat-send"
            aria-label="Send message"
            className="px-4 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium disabled:opacity-50"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </form>
    </GlassPanel>
  );
}
