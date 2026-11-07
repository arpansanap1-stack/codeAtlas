"use client";

import React, { useRef, useState, useEffect } from "react";
import {
  Send,
  RotateCcw,
  Square,
  MessageSquare,
  Loader2,
} from "lucide-react";
import { ChatMessage, ChatMessageItem } from "@/components/chat/ChatMessageItem";
import { PinnedContextBar } from "@/components/chat/PinnedContextBar";

interface ChatPanelProps {
  repoId: string;
  repoName: string;
  onSelectCitation: (filePath: string, startLine: number, endLine: number) => void;
  selectedFiles?: string[];
  onRemoveSelectedFile?: (filePath: string) => void;
  onClearSelectedFiles?: () => void;
  availableFiles?: string[];
  onAddSelectedFile?: (filePath: string) => void;
}

export function ChatPanel({
  repoId,
  repoName,
  onSelectCitation,
  selectedFiles = [],
  onRemoveSelectedFile,
  onClearSelectedFiles,
  availableFiles = [],
  onAddSelectedFile,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: `Hello! I'm your **CodeAtlas AI Assistant** for **${repoName}**.\n\nAsk me anything about the architecture, functions, modules, or dependencies. Every response will cite exact code locations with clickable line ranges.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (userQuestion?: string) => {
    const question = userQuestion || input.trim();
    if (!question || isStreaming) return;

    setInput("");
    const newMessages: ChatMessage[] = [...messages, { role: "user", content: question }];
    setMessages([...newMessages, { role: "assistant", content: "" }]);
    setIsStreaming(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const response = await fetch(`${API_BASE}/api/repos/${repoId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: question,
          selected_files: selectedFiles.length > 0 ? selectedFiles : undefined,
        }),
        signal: abortController.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error("Chat request failed");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamedAnswer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunkText = decoder.decode(value, { stream: true });
        const lines = chunkText.split("\n\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.replace("data: ", "").trim();
            if (dataStr === "[DONE]") {
              break;
            }

            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.content) {
                streamedAnswer += parsed.content;
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: "assistant",
                    content: streamedAnswer,
                  };
                  return updated;
                });
              } else if (parsed.done && parsed.citations) {
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: "assistant",
                    content: streamedAnswer,
                    citations: parsed.citations,
                  };
                  return updated;
                });
              }
            } catch (e) {
              // Ignore non-json lines
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: `Failed to answer: ${err.message || "Network error"}. Please try again.`,
          };
          return updated;
        });
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsStreaming(false);
    }
  };

  const handleClear = () => {
    setMessages([
      {
        role: "assistant",
        content: `Chat history cleared. How can I help you explore **${repoName}**?`,
      },
    ]);
  };

  return (
    <div className="h-full flex flex-col bg-zinc-950 border-l border-zinc-800">
      {/* Header */}
      <div className="h-12 border-b border-zinc-800 px-4 flex items-center justify-between bg-zinc-900/70 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
            <MessageSquare className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-mono font-medium text-zinc-100">
            Codebase AI Assistant
          </span>
        </div>
        <button
          onClick={handleClear}
          className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          title="Clear Conversation"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Pinned Multi-File Context Bar */}
      <PinnedContextBar
        selectedFiles={selectedFiles}
        onRemoveSelectedFile={onRemoveSelectedFile}
        onClearSelectedFiles={onClearSelectedFiles}
        availableFiles={availableFiles}
        onAddSelectedFile={onAddSelectedFile}
      />

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {messages.map((msg, idx) => (
          <ChatMessageItem
            key={idx}
            message={msg}
            onSelectCitation={onSelectCitation}
          />
        ))}

        {isStreaming && (
          <div className="flex items-center gap-2 text-zinc-400 text-xs font-mono py-1 animate-pulse">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
            <span>Retrieving AST chunks & synthesizing answer...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Questions Suggestions */}
      {messages.length <= 2 && selectedFiles.length === 0 && (
        <div className="px-4 py-2 border-t border-zinc-800 flex flex-wrap gap-1.5 bg-zinc-950">
          {[
            "Where is the main entry point?",
            "Explain the architecture flow.",
            "What dependencies exist?",
          ].map((q, i) => (
            <button
              key={i}
              onClick={() => handleSend(q)}
              className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 transition-colors cursor-pointer"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input Box */}
      <div className="p-3 border-t border-zinc-800 bg-zinc-950">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="relative flex items-center"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about architecture, functions, modules..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-3 pr-20 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-700 transition-colors font-sans"
          />

          <div className="absolute right-2 flex items-center gap-1">
            {isStreaming ? (
              <button
                type="button"
                onClick={handleStop}
                className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-rose-400 transition-colors cursor-pointer"
                title="Stop response"
              >
                <Square className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="p-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-zinc-950 transition-all disabled:opacity-40 cursor-pointer"
                title="Send Message"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
