"use client";

import React, { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  X,
  Sparkles,
  Baby,
  Layers,
  Zap,
  Copy,
  Check,
  FileCode,
  Loader2,
  BookOpen,
} from "lucide-react";
import { MermaidRenderer } from "./MermaidRenderer";
import { getArchitectureExplanation } from "@/lib/api";
import { ArchitectureLevel } from "@/types";

interface ArchitectureExplanationModalProps {
  isOpen: boolean;
  onClose: () => void;
  repoId: string;
  repoName: string;
  onSelectCitation: (filePath: string, startLine: number, endLine: number) => void;
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
        className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-1 rounded-md bg-accent-indigo/10 hover:bg-accent-indigo/25 text-accent-indigoLight border border-accent-indigo/30 text-[11px] font-mono transition-colors group align-baseline cursor-pointer"
        title={`View ${filePath} (Lines ${startLine}-${endLine})`}
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

export function ArchitectureExplanationModal({
  isOpen,
  onClose,
  repoId,
  repoName,
  onSelectCitation,
}: ArchitectureExplanationModalProps) {
  const [level, setLevel] = useState<ArchitectureLevel>("intermediate");
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    getArchitectureExplanation(repoId, level)
      .then((res) => {
        if (isMounted) {
          setContent(res.markdown_content);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || "Failed to generate architecture explanation");
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, repoId, level]);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (!content) return;
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-4xl h-[88vh] bg-panel border border-borderDefault rounded-2xl shadow-elevated flex flex-col overflow-hidden animate-scale-in">
        {/* Modal Header */}
        <div className="h-16 px-6 border-b border-borderSubtle bg-surface/80 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-accent-indigo/15 border border-accent-indigo/30 flex items-center justify-center text-accent-indigoLight">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <span>AI Architecture Explanation</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-surfaceElevated text-zinc-400 border border-borderSubtle font-mono">
                  {repoName}
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Deep architectural walkthrough tailored to your experience level
              </p>
            </div>
          </div>

          {/* Depth / Audience Level Selector */}
          <div className="flex items-center gap-1 bg-panel p-1 rounded-xl border border-borderSubtle text-xs font-mono">
            <button
              onClick={() => setLevel("beginner")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                level === "beginner"
                  ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
              title="Beginner: Mental models, analogies, entry points, zero jargon"
            >
              <Baby className="w-3.5 h-3.5" />
              <span>Beginner</span>
            </button>

            <button
              onClick={() => setLevel("intermediate")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                level === "intermediate"
                  ? "bg-accent-indigo/20 text-accent-indigoLight border border-accent-indigo/35 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
              title="Intermediate: Architecture patterns, request lifecycles, and component interactions"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Intermediate</span>
            </button>

            <button
              onClick={() => setLevel("expert")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                level === "expert"
                  ? "bg-purple-500/15 text-purple-300 border border-purple-500/30 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
              title="Expert: Concurrency, scalability, dependency boundaries, design trade-offs"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Expert</span>
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              disabled={loading || !content}
              className="px-3 py-1.5 rounded-lg bg-surface hover:bg-surfaceHover border border-borderSubtle text-xs text-zinc-300 hover:text-white flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
              title="Copy Markdown"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-surfaceHover transition-colors cursor-pointer"
              title="Close Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 bg-workspace">
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-3 text-zinc-400 font-mono text-xs">
              <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
              <span>Generating {level.toUpperCase()} architecture walkthrough...</span>
            </div>
          ) : error ? (
            <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-mono">
              {error}
            </div>
          ) : (
            <article className="prose prose-invert prose-zinc max-w-none text-sm leading-relaxed prose-headings:font-semibold prose-headings:tracking-tight prose-h1:text-xl prose-h2:text-lg prose-h3:text-sm prose-p:text-zinc-300 prose-li:text-zinc-300 prose-strong:text-zinc-100 prose-code:font-mono prose-code:text-sky-300 prose-code:bg-zinc-900 prose-code:px-1 prose-code:py-0.5 prose-code:rounded">
              <ReactMarkdown
                components={{
                  code({ node, className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || "");
                    const isMermaid = match && match[1] === "mermaid";

                    if (isMermaid) {
                      return <MermaidRenderer code={String(children).replace(/\n$/, "")} />;
                    }

                    return (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    );
                  },
                  p({ children }) {
                    if (typeof children === "string") {
                      return <p>{renderWithCitations(children, onSelectCitation)}</p>;
                    }
                    if (Array.isArray(children)) {
                      return (
                        <p>
                          {children.map((child, i) =>
                            typeof child === "string" ? (
                              <React.Fragment key={i}>
                                {renderWithCitations(child, onSelectCitation)}
                              </React.Fragment>
                            ) : (
                              child
                            )
                          )}
                        </p>
                      );
                    }
                    return <p>{children}</p>;
                  },
                  li({ children }) {
                    if (typeof children === "string") {
                      return <li>{renderWithCitations(children, onSelectCitation)}</li>;
                    }
                    if (Array.isArray(children)) {
                      return (
                        <li>
                          {children.map((child, i) =>
                            typeof child === "string" ? (
                              <React.Fragment key={i}>
                                {renderWithCitations(child, onSelectCitation)}
                              </React.Fragment>
                            ) : (
                              child
                            )
                          )}
                        </li>
                      );
                    }
                    return <li>{children}</li>;
                  },
                }}
              >
                {content}
              </ReactMarkdown>
            </article>
          )}
        </div>
      </div>
    </div>
  );
}

