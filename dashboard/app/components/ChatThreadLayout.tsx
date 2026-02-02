"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { Plus, Search, Trash2, Edit2, MessageSquare } from "lucide-react";
import ChatInterface from "./ChatInterface";

interface Thread {
  id: string;
  title: string;
  updated_at: string;
  active_segment_id: string | null;
}

const TITLE_MAX_LENGTH = 200;

export default function ChatThreadLayout() {
  const { getToken, userId } = useAuth();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8181";

  const fetchThreads = useCallback(async () => {
    if (!userId) return;
    
    try {
      const token = await getToken();
      const response = await fetch(`${API_BASE}/api/v1/chat/threads?query=${encodeURIComponent(searchQuery)}`, {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setThreads(data.threads || []);
      }
    } catch (error) {
      console.error("Failed to fetch threads:", error);
    }
  }, [userId, searchQuery, getToken]);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  const createThread = async () => {
    try {
      setIsLoading(true);
      const token = await getToken();
      const response = await fetch(`${API_BASE}/api/v1/chat/threads`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });

      if (response.ok) {
        const newThread = await response.json();
        setThreads((prev: Thread[]) => [newThread, ...prev]);
        setSelectedThreadId(newThread.id);
      }
    } catch (error) {
      console.error("Failed to create thread:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteThread = async (threadId: string) => {
    try {
      const token = await getToken();
      const response = await fetch(`${API_BASE}/api/v1/chat/threads/${threadId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (response.ok) {
        setThreads((prev: Thread[]) => prev.filter((t: Thread) => t.id !== threadId));
        if (selectedThreadId === threadId) {
          setSelectedThreadId(null);
        }
      }
    } catch (error) {
      console.error("Failed to delete thread:", error);
    }
  };

  const renameThread = async (threadId: string, newTitle: string) => {
    if (newTitle.length > TITLE_MAX_LENGTH) {
      setRenameError(`Title must be ${TITLE_MAX_LENGTH} characters or less`);
      return;
    }
    setRenameError(null);

    try {
      const token = await getToken();
      const response = await fetch(`${API_BASE}/api/v1/chat/threads/${threadId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ title: newTitle }),
      });

      if (response.ok) {
        const updatedThread = await response.json();
        setThreads((prev: Thread[]) =>
          prev.map((t: Thread) => (t.id === threadId ? updatedThread : t))
        );
      } else {
        const errorData = await response.json().catch(() => ({}));
        setRenameError(errorData.detail || "Failed to rename thread");
      }
    } catch (error) {
      console.error("Failed to rename thread:", error);
      setRenameError("Network error");
    } finally {
      setEditingThreadId(null);
      setEditTitle("");
    }
  };

  const startEditing = (thread: Thread) => {
    setEditingThreadId(thread.id);
    setEditTitle(thread.title);
    setRenameError(null);
  };

  const handleEditSubmit = (threadId: string) => {
    if (editTitle.trim()) {
      renameThread(threadId, editTitle.trim());
    } else {
      setEditingThreadId(null);
    }
  };

  return (
    <div className="glass-panel flex h-[calc(100vh-80px)] min-h-[600px] rounded-3xl overflow-hidden shadow-2xl" data-testid="chat-thread-layout">
      {/* Sidebar */}
      <div className="w-72 flex flex-col border-r border-white/20 bg-white/10" data-testid="chat-thread-sidebar">
        {/* Header */}
        <div className="p-4 border-b border-white/20">
          <button
            onClick={createThread}
            disabled={isLoading}
            data-testid="chat-new-chat"
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium shadow-lg shadow-cyan-500/20 hover:shadow-xl hover:shadow-cyan-500/30 transition-all disabled:opacity-50"
          >
            <Plus className="w-5 h-5" />
            New Chat
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-white/20">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search threads..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="chat-thread-search"
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-white/50 border border-white/20 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
            />
          </div>
        </div>

        {/* Thread List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1" data-testid="chat-thread-list">
          {threads.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm" data-testid="chat-thread-empty">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
              No chats yet
            </div>
          ) : (
            threads.map((thread: Thread) => (
              <div
                key={thread.id}
                onClick={() => setSelectedThreadId(thread.id)}
                data-testid="chat-thread-item"
                data-thread-id={thread.id}
                data-selected={selectedThreadId === thread.id ? "true" : "false"}
                className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all ${
                  selectedThreadId === thread.id
                    ? "bg-cyan-100/50 text-cyan-900"
                    : "hover:bg-white/50 text-slate-600"
                }`}
              >
                <MessageSquare className="w-4 h-4 flex-shrink-0" />
                
                {editingThreadId === thread.id ? (
                  <div className="flex-1 min-w-0">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onBlur={() => handleEditSubmit(thread.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleEditSubmit(thread.id);
                        if (e.key === "Escape") setEditingThreadId(null);
                      }}
                      maxLength={TITLE_MAX_LENGTH}
                      autoFocus
                      data-testid="chat-thread-rename-input"
                      className="w-full bg-white/80 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"
                      onClick={(e) => e.stopPropagation()}
                    />
                    {renameError && (
                      <p className="text-xs text-red-500 mt-1">{renameError}</p>
                    )}
                  </div>
                ) : (
                  <span className="flex-1 min-w-0 truncate text-sm font-medium" data-testid="chat-thread-title">
                    {thread.title}
                  </span>
                )}

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      startEditing(thread);
                    }}
                    data-testid="chat-thread-edit"
                    aria-label="Rename thread"
                    className="p-1 rounded hover:bg-white/50 text-slate-400 hover:text-slate-600"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteThread(thread.id);
                    }}
                    data-testid="chat-thread-delete"
                    aria-label="Delete thread"
                    className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 bg-white/5 h-full overflow-hidden" data-testid="chat-main">
        {selectedThreadId ? (
          <ChatInterface 
            threadId={selectedThreadId} 
            onThreadActivity={fetchThreads}
            className="rounded-none border-none shadow-none bg-transparent backdrop-blur-none" 
          />
        ) : (
          <div className="h-full flex items-center justify-center text-slate-400" data-testid="chat-no-thread-selected">
            <div className="text-center">
              <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">Select a chat or start a new one</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
