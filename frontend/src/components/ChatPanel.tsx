"use client";

import React, { useRef, useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import {
  Send,
  Sparkles,
  Bot,
  User,
  Loader2,
  FileCode,
  RotateCcw,
  Square,
  MessageSquare,
  X,
  Layers,
  Plus,
} from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  citations?: string[];
}

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

const CITATION_REGEX = /\[([a-zA-Z0-9_\-\.\/]+):(\d+)-(\d+)\]/g;

function renderWithCitations(
  text: string,
  onSelect: (filePath: string, start: number, end: number) => void
) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = CITATION_REGEX.exec(text)) !== null) {
    const [fullMatch, filePath, startStr, endStr] = match;
    const matchIndex = match.index;

    if (matchIndex > lastIndex) {
      parts.push(text.slice(lastIndex, matchIndex));
    }

    const startLine = parseInt(startStr, 10);
    const endLine = parseInt(endStr, 10);
    const fileName = filePath.split("/").pop() || filePath;

    parts.push(
      <button
        key={`${filePath}-${startLine}-${matchIndex}`}
        onClick={() => onSelect(filePath, startLine, endLine)}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-1 rounded bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 text-[11px] font-mono transition-colors group align-baseline"
        title={`Inspect ${filePath} (Lines ${startLine}-${endLine})`}
      >
        <FileCode className="w-3 h-3 group-hover:scale-110 transition-transform" />
        <span>
          {fileName}:{startLine}-{endLine}
        </span>
      </button>
    );

    lastIndex = matchIndex + fullMatch.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
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
  const [messages, setMessages] = useState<Message[]>([
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
    const newMessages: Message[] = [...messages, { role: "user", content: question }];
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
    <div className="h-full flex flex-col bg-zinc-950 border-l border-zinc-800/80">
      {/* Header */}
      <div className="h-12 border-b border-zinc-800/80 px-4 flex items-center justify-between bg-zinc-900/50 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-sky-400" />
          <span className="text-xs font-mono font-medium text-zinc-200">
            Codebase RAG Assistant
          </span>
        </div>
        <button
          onClick={handleClear}
          className="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
          title="Clear Conversation"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" && (
              <div className="w-6 h-6 rounded-md bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shrink-0 mt-0.5">
                <Bot className="w-3.5 h-3.5" />
              </div>
            )}

            <div
              className={`max-w-[85%] rounded-lg p-3 text-xs leading-relaxed ${
                msg.role === "user"
                  ? "bg-zinc-800 text-zinc-100 font-sans border border-zinc-700/60"
                  : "bg-zinc-900/90 text-zinc-200 border border-zinc-800/80 shadow-sm"
              }`}
            >
              {msg.role === "assistant" ? (
                <div className="prose prose-invert prose-zinc max-w-none text-xs">
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => {
                        if (typeof children === "string") {
                          return (
                            <p className="my-1.5 leading-relaxed">
                              {renderWithCitations(children, onSelectCitation)}
                            </p>
                          );
                        }
                        return <p className="my-1.5 leading-relaxed">{children}</p>;
                      },
                      li: ({ children }) => {
                        if (typeof children === "string") {
                          return (
                            <li className="my-0.5">
                              {renderWithCitations(children, onSelectCitation)}
                            </li>
                          );
                        }
                        return <li className="my-0.5">{children}</li>;
                      },
                      code: ({ children }) => {
                        const textContent = String(children);
                        if (CITATION_REGEX.test(textContent)) {
                          return <>{renderWithCitations(textContent, onSelectCitation)}</>;
                        }
                        return (
                          <code className="px-1 py-0.5 rounded bg-zinc-950 border border-zinc-800 font-mono text-[11px] text-sky-300">
                            {children}
                          </code>
                        );
                      },
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>

                  {/* Citation Pills Summary */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-zinc-800/60 flex flex-wrap gap-1.5">
                      <span className="text-[10px] font-mono text-zinc-500 w-full">
                        Referenced declarations:
                      </span>
                      {msg.citations.map((cite, cIdx) => {
                        const match = /\[([a-zA-Z0-9_\-\.\/]+):(\d+)-(\d+)\]/.exec(cite);
                        if (!match) return null;
                        const [, filePath, startStr, endStr] = match;
                        const start = parseInt(startStr, 10);
                        const end = parseInt(endStr, 10);
                        const fileName = filePath.split("/").pop();

                        return (
                          <button
                            key={cIdx}
                            onClick={() => onSelectCitation(filePath, start, end)}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700/60 text-[10px] font-mono transition-colors"
                          >
                            <FileCode className="w-2.5 h-2.5 text-sky-400" />
                            <span>
                              {fileName}:{start}-{end}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <span>{msg.content}</span>
              )}
            </div>

            {msg.role === "user" && (
              <div className="w-6 h-6 rounded-md bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 shrink-0 mt-0.5">
                <User className="w-3.5 h-3.5" />
              </div>
            )}
          </div>
        ))}

        {isStreaming && (
          <div className="flex items-center gap-2 text-zinc-500 text-xs font-mono">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
            <span>Retrieving chunks & generating response...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Targeted Selected Context Banner */}
      {selectedFiles.length > 0 && (
        <div className="px-3 py-2 border-t border-sky-500/30 bg-sky-950/20 text-xs font-mono">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-sky-400 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5" />
              <span>Targeted Context ({selectedFiles.length} file{selectedFiles.length > 1 ? "s" : ""})</span>
            </span>
            {onClearSelectedFiles && (
              <button
                onClick={onClearSelectedFiles}
                className="text-[10px] text-zinc-400 hover:text-rose-400 transition-colors"
                title="Clear all pinned files"
              >
                Clear Context
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5 mb-2">
            {selectedFiles.map((file, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-900 border border-sky-500/40 text-[11px] text-sky-300 font-mono"
              >
                <FileCode className="w-2.5 h-2.5" />
                <span className="truncate max-w-[150px]">{file.split("/").pop() || file}</span>
                {onRemoveSelectedFile && (
                  <button
                    onClick={() => onRemoveSelectedFile(file)}
                    className="hover:text-rose-400 ml-0.5"
                    title={`Remove ${file}`}
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </span>
            ))}
          </div>

          {/* Quick Context Prompt Chips */}
          <div className="flex flex-wrap gap-1 pt-1 border-t border-zinc-800/60">
            {[
              "Explain how these work together.",
              "Compare these two implementations.",
              "Trace the data flow between them.",
            ].map((prompt, pIdx) => (
              <button
                key={pIdx}
                onClick={() => handleSend(prompt)}
                className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/20 transition-colors"
              >
                💡 {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quick Questions Suggestions */}
      {messages.length <= 2 && selectedFiles.length === 0 && (
        <div className="px-4 py-2 border-t border-zinc-800/60 flex flex-wrap gap-1.5 bg-zinc-950">
          {[
            "Where is the main entry point?",
            "Explain the architecture flow.",
            "What dependencies exist?",
          ].map((q, i) => (
            <button
              key={i}
              onClick={() => handleSend(q)}
              className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input Box */}
      <div className="p-3 border-t border-zinc-800/80 bg-zinc-900/40">
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
            placeholder="Ask about this codebase (e.g. Where is config defined?)..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-3 pr-20 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-700"
          />

          <div className="absolute right-2 flex items-center gap-1">
            {isStreaming ? (
              <button
                type="button"
                onClick={handleStop}
                className="p-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-rose-400 transition-colors"
                title="Stop response"
              >
                <Square className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="p-1 rounded-md bg-sky-500 hover:bg-sky-400 text-zinc-950 transition-colors disabled:opacity-40 shadow-sm"
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

