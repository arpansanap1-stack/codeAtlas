"use client";

import React, { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  Copy,
  Download,
  Check,
  RefreshCw,
  Loader2,
  FileCode,
  BookOpen,
} from "lucide-react";
import { MermaidRenderer } from "./MermaidRenderer";
import { getOnboardingDocs } from "@/lib/api";

interface OnboardingViewProps {
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
        className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-1 rounded bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 text-[11px] font-mono transition-colors group align-baseline"
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

export function OnboardingView({
  repoId,
  repoName,
  onSelectCitation,
}: OnboardingViewProps) {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchDocs = async () => {
    try {
      setLoading(true);
      const res = await getOnboardingDocs(repoId);
      setContent(res.markdown_content);
    } catch (err) {
      console.error("Failed to load onboarding doc:", err);
    } finally {
      setLoading(false);
    }
  };

  const regenerateDocs = async () => {
    try {
      setRefreshing(true);
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const res = await fetch(`${API_BASE}/api/repos/${repoId}/onboarding`, {
        method: "POST",
      });
      const data = await res.json();
      setContent(data.markdown_content);
    } catch (err) {
      console.error("Failed to regenerate docs:", err);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, [repoId]);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${repoName}-ONBOARDING.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col bg-zinc-950 overflow-hidden">
      {/* Top Action Header */}
      <div className="h-12 border-b border-zinc-800/80 px-6 flex items-center justify-between bg-zinc-900/50 backdrop-blur-md shrink-0 z-10">
        <div className="flex items-center gap-2 text-xs font-mono text-zinc-300">
          <BookOpen className="w-4 h-4 text-sky-400" />
          <span className="font-medium text-zinc-100">{repoName}</span>
          <span className="text-zinc-600">/</span>
          <span className="text-zinc-400">ONBOARDING.md</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={regenerateDocs}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700/60 transition-colors disabled:opacity-50"
            title="Regenerate documentation"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-sky-400" : ""}`}
            />
            <span>{refreshing ? "Synthesizing..." : "Regenerate"}</span>
          </button>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700/60 transition-colors"
            title="Copy Raw Markdown"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy MD</span>
              </>
            )}
          </button>

          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded bg-zinc-100 hover:bg-white text-zinc-900 font-medium transition-colors shadow-sm"
            title="Download ONBOARDING.md file"
          >
            <Download className="w-3.5 h-3.5 text-zinc-800" />
            <span>Download</span>
          </button>
        </div>
      </div>

      {/* Main Document Content */}
      <div className="flex-1 overflow-y-auto px-6 py-8 max-w-4xl mx-auto w-full">
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center gap-3 text-zinc-400 text-xs font-mono">
            <Loader2 className="w-5 h-5 animate-spin text-sky-400" />
            <span>Loading developer onboarding guide...</span>
          </div>
        ) : (
          <div className="prose prose-invert prose-zinc max-w-none text-zinc-300 text-sm leading-relaxed">
            <ReactMarkdown
              components={{
                h1: ({ children }) => (
                  <h1 className="text-xl font-bold text-zinc-100 tracking-tight pb-3 border-b border-zinc-800 mb-6">
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-base font-semibold text-zinc-100 tracking-tight mt-8 mb-4 pb-2 border-b border-zinc-800/60">
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-sm font-semibold text-zinc-200 mt-6 mb-2">
                    {children}
                  </h3>
                ),
                p: ({ children }) => {
                  if (typeof children === "string") {
                    return (
                      <p className="my-3 text-zinc-300 leading-relaxed">
                        {renderWithCitations(children, onSelectCitation)}
                      </p>
                    );
                  }
                  return <p className="my-3 text-zinc-300 leading-relaxed">{children}</p>;
                },
                li: ({ children }) => {
                  if (typeof children === "string") {
                    return (
                      <li className="my-1 text-zinc-300">
                        {renderWithCitations(children, onSelectCitation)}
                      </li>
                    );
                  }
                  return <li className="my-1 text-zinc-300">{children}</li>;
                },
                code: ({ className, children, ...props }) => {
                  const match = /language-(\w+)/.exec(className || "");
                  const isMermaid = match && match[1] === "mermaid";

                  if (isMermaid) {
                    return <MermaidRenderer code={String(children).replace(/\n$/, "")} />;
                  }

                  const textContent = String(children);
                  if (CITATION_REGEX.test(textContent)) {
                    return (
                      <>{renderWithCitations(textContent, onSelectCitation)}</>
                    );
                  }

                  return (
                    <code
                      className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-sky-300 font-mono text-xs"
                      {...props}
                    >
                      {children}
                    </code>
                  );
                },
                pre: ({ children }) => (
                  <pre className="p-4 rounded-xl bg-zinc-900/90 border border-zinc-800/80 overflow-x-auto my-4 text-xs font-mono text-zinc-200 shadow-sm">
                    {children}
                  </pre>
                ),
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

