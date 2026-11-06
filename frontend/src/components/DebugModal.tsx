"use client";

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  Bug,
  X,
  Play,
  Loader2,
  AlertTriangle,
  FileCode,
  Check,
  Copy,
  ExternalLink,
  GitBranch,
  ShieldAlert,
} from "lucide-react";
import { debugError } from "@/lib/api";
import { DebugResponse } from "@/types";

interface DebugModalProps {
  isOpen: boolean;
  onClose: () => void;
  repoId: string;
  repoName: string;
  onSelectCitation: (filePath: string, startLine: number, endLine: number) => void;
}

export function DebugModal({
  isOpen,
  onClose,
  repoId,
  repoName,
  onSelectCitation,
}: DebugModalProps) {
  const [errorMessage, setErrorMessage] = useState("");
  const [contextHint, setContextHint] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DebugResponse | null>(null);
  const [copiedFix, setCopiedFix] = useState(false);

  if (!isOpen) return null;

  const handleDiagnose = async () => {
    if (!errorMessage.trim()) return;

    try {
      setLoading(true);
      setError(null);
      const res = await debugError(repoId, errorMessage.trim(), contextHint.trim() || undefined);
      setResult(res);
    } catch (err: any) {
      setError(err.message || "Failed to analyze error");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyFix = () => {
    if (!result?.suggested_fix) return;
    navigator.clipboard.writeText(result.suggested_fix);
    setCopiedFix(true);
    setTimeout(() => setCopiedFix(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl h-[90vh] bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="h-16 px-6 border-b border-zinc-800/80 bg-zinc-900/60 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <Bug className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <span>AI Debugger & Error Explorer</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700/60 font-mono">
                  {repoName}
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Paste any runtime error or stack trace to locate suspicious code and generate fixes
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Input Section */}
          <div className="space-y-3 p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/70">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-200 flex items-center justify-between">
                <span>Error Message or Stack Trace:</span>
                <span className="text-[10px] text-zinc-400 font-mono">
                  Supports TypeError, Python tracebacks, 500 errors
                </span>
              </label>
              <textarea
                value={errorMessage}
                onChange={(e) => setErrorMessage(e.target.value)}
                placeholder="Paste error trace here, for example:&#10;TypeError: Cannot read properties of undefined (reading 'token')&#10;  at handleLogin (src/components/Login.tsx:24:12)"
                rows={4}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-rose-500/60 resize-y"
              />
            </div>

            <div className="flex items-center gap-3">
              <input
                type="text"
                value={contextHint}
                onChange={(e) => setContextHint(e.target.value)}
                placeholder="Optional context hint (e.g. Occurred when user clicked Submit without email)"
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-rose-500/60 font-mono"
              />

              <button
                onClick={handleDiagnose}
                disabled={loading || !errorMessage.trim()}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50 shrink-0"
              >
                {loading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-current" />
                )}
                <span>Diagnose Error</span>
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono">
              {error}
            </div>
          )}

          {/* Results Section */}
          {result && (
            <div className="space-y-5 animate-in fade-in duration-300">
              {/* Error Header Badge */}
              <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-500/30 text-xs font-mono font-semibold">
                    {result.error_type}
                  </span>
                  <span className="text-xs text-zinc-300 font-medium">
                    Diagnostic Analysis Complete
                  </span>
                </div>
                <div className="text-[11px] font-mono text-zinc-400">
                  Confidence:{" "}
                  <span className="text-emerald-400 font-semibold">
                    {Math.round(result.confidence_score * 100)}%
                  </span>
                </div>
              </div>

              {/* Root Cause Card */}
              <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-rose-400">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Root Cause Analysis</span>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed font-sans">
                  {result.root_cause_analysis}
                </p>
              </div>

              {/* Execution Path Explanation */}
              <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-sky-400">
                  <GitBranch className="w-4 h-4 shrink-0" />
                  <span>Causal Execution Path</span>
                </div>
                <div className="text-xs text-zinc-300 whitespace-pre-line leading-relaxed font-sans">
                  {result.execution_path_explanation}
                </div>
              </div>

              {/* Suspicious Code Locations */}
              <div className="space-y-3">
                <div className="text-xs font-semibold text-amber-400 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4" />
                  <span>Suspicious Code Locations in Codebase</span>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {result.suspicious_locations.map((loc, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 transition-all space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <button
                          onClick={() => {
                            onSelectCitation(loc.file_path, loc.start_line, loc.end_line);
                            onClose();
                          }}
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 text-xs font-mono font-medium transition-colors group"
                          title="Open in Monaco Editor & Highlight"
                        >
                          <FileCode className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                          <span>
                            {loc.file_path}:{loc.start_line}-{loc.end_line}
                          </span>
                          <ExternalLink className="w-3 h-3 opacity-60" />
                        </button>

                        {loc.symbol_name && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">
                            {loc.symbol_name}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-zinc-300">{loc.reason}</p>

                      {loc.code_snippet && (
                        <pre className="p-2.5 rounded bg-zinc-950 border border-zinc-800/80 text-[11px] font-mono text-zinc-300 overflow-x-auto">
                          <code>{loc.code_snippet}</code>
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Proposed Code Fix */}
              <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-emerald-400 flex items-center gap-2">
                    <Check className="w-4 h-4" />
                    <span>Proposed Fix & Verification</span>
                  </span>

                  <button
                    onClick={handleCopyFix}
                    className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-xs font-mono text-zinc-300 hover:text-white flex items-center gap-1.5 transition-colors"
                  >
                    {copiedFix ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Fix</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="prose prose-invert prose-zinc max-w-none text-xs leading-relaxed prose-pre:bg-zinc-950 prose-pre:border prose-pre:border-zinc-800">
                  <ReactMarkdown>{result.suggested_fix}</ReactMarkdown>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

