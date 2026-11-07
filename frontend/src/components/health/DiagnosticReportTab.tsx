"use client";

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Download, Copy, Check, Loader2 } from "lucide-react";

interface DiagnosticReportTabProps {
  reportMarkdown: string;
  repoName: string;
  loading: boolean;
}

export function DiagnosticReportTab({
  reportMarkdown,
  repoName,
  loading,
}: DiagnosticReportTabProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(reportMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([reportMarkdown], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `CODEBASE_HEALTH_AUDIT_${repoName.replace(/[^a-zA-Z0-9_\-]/g, "_")}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-zinc-500">
        <Loader2 className="w-8 h-8 animate-spin mb-3 text-sky-400" />
        <p className="text-sm">Synthesizing comprehensive diagnostic audit report...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top action bar */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-900 border border-zinc-800">
        <div>
          <h4 className="text-xs font-semibold text-zinc-200">
            Export Architectural Audit Report
          </h4>
          <p className="text-[11px] text-zinc-500">
            Download or copy complete diagnostic markdown breakdown
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 border border-zinc-700 transition-colors cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-zinc-400" />
                <span>Copy Markdown</span>
              </>
            )}
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-xs font-medium text-zinc-950 transition-colors shadow-sm cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download .md</span>
          </button>
        </div>
      </div>

      {/* Rendered report preview */}
      <div className="p-6 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 leading-relaxed font-sans prose prose-invert max-w-none prose-headings:text-zinc-100 prose-a:text-sky-400 prose-code:text-sky-300 prose-code:bg-zinc-900 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-table:text-xs">
        <ReactMarkdown>{reportMarkdown}</ReactMarkdown>
      </div>
    </div>
  );
}
