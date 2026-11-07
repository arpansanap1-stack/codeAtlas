"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import { Bot, User, FileCode } from "lucide-react";
import { renderWithCitations } from "@/lib/citationUtils";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  citations?: string[];
}

interface ChatMessageItemProps {
  message: ChatMessage;
  onSelectCitation: (filePath: string, startLine: number, endLine: number) => void;
}

export function ChatMessageItem({
  message,
  onSelectCitation,
}: ChatMessageItemProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={`flex gap-3 text-xs leading-relaxed ${
        isUser ? "justify-end" : "justify-start"
      }`}
    >
      {!isUser && (
        <div className="w-6 h-6 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center shrink-0 mt-0.5">
          <Bot className="w-3.5 h-3.5" />
        </div>
      )}

      <div
        className={`max-w-[85%] rounded-xl px-3.5 py-2.5 ${
          isUser
            ? "bg-sky-500 text-zinc-950 font-medium"
            : "bg-zinc-900 border border-zinc-800 text-zinc-200"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="space-y-2">
            <div className="prose prose-invert prose-xs max-w-none text-zinc-300">
              {renderWithCitations(message.content, onSelectCitation)}
            </div>

            {message.citations && message.citations.length > 0 && (
              <div className="pt-2 border-t border-zinc-800/80 flex flex-wrap gap-1 mt-2">
                <span className="text-[10px] text-zinc-500 font-mono block w-full mb-1">
                  Citations:
                </span>
                {message.citations.map((c, i) => {
                  const match = c.match(/\[([a-zA-Z0-9_\-\.\/]+):(\d+)-(\d+)\]/);
                  if (!match) return null;
                  const [, filePath, startStr, endStr] = match;
                  const startLine = parseInt(startStr, 10);
                  const endLine = parseInt(endStr, 10);
                  const fileName = filePath.split("/").pop() || filePath;

                  return (
                    <button
                      key={i}
                      onClick={() => onSelectCitation(filePath, startLine, endLine)}
                      className="px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800 hover:border-sky-500/40 text-[10px] font-mono text-zinc-400 hover:text-sky-300 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <FileCode className="w-3 h-3 text-sky-400" />
                      <span>
                        {fileName}:{startLine}-{endLine}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {isUser && (
        <div className="w-6 h-6 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 flex items-center justify-center shrink-0 mt-0.5">
          <User className="w-3.5 h-3.5" />
        </div>
      )}
    </div>
  );
}
