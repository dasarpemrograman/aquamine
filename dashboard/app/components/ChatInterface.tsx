"use client";

import { useMemo, useState, FormEvent, useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Volume2, VolumeX, Send } from "lucide-react";
import { GlassPanel } from "@/app/components/ui/GlassPanel";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatInterfaceProps {
  threadId: string;
  onThreadActivity?: () => void;
  className?: string;
}

export default function ChatInterface({ threadId, onThreadActivity, className }: ChatInterfaceProps) {
  const { getToken } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState("");
  const [isTTSEnabled, setIsTTSEnabled] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastSpokenIndexRef = useRef<number>(-1);

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8181";

  // Fetch messages when thread changes
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const token = await getToken();
        const response = await fetch(`${API_BASE}/api/v1/chat/threads/${threadId}/messages`, {
          headers: { "Authorization": `Bearer ${token}` },
        });
        
        if (response.ok) {
          const data = await response.json();
          const formattedMessages = data.messages.map((m: any) => ({
            role: m.role,
            content: m.content,
          }));
          setMessages(formattedMessages);
        }
      } catch (error) {
        console.error("Failed to fetch messages:", error);
      }
    };

    if (threadId) {
      fetchMessages();
    }
  }, [threadId, getToken]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    setIsLoading(true);

    try {
      const token = await getToken();
      const response = await fetch(`${API_BASE}/api/v1/chat/threads/${threadId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ content: trimmed }),
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.compaction_required) {
          // Show compaction modal - simplified for now
          setMessages((prev) => [
            ...prev,
            { 
              role: "assistant", 
              content: "Percakapan sudah cukup panjang. Silakan lakukan compaction untuk melanjutkan." 
            },
          ]);
        } else if (data.response) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: data.response },
          ]);
        }

        // Backend may update thread metadata (e.g., auto-title) after the first message.
        // Refreshing the thread list keeps the sidebar in sync.
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
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <GlassPanel className={`h-full flex flex-col ${className || ''}`} data-testid="chat-interface" data-thread-id={threadId}>
      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4" data-testid="chat-messages">
        {messages.length === 0 && !isLoading && (
          <div className="text-center text-slate-400 mt-10" data-testid="chat-empty-state">
            Mulai percakapan dengan mengirim pesan...
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
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-white/50" data-testid="chat-composer">
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
