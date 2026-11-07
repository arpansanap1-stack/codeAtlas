"use client";

import React, { useEffect, useState } from "react";
import {
  History,
  X,
  FileCode,
  Loader2,
  TrendingUp,
  AlertCircle,
  MessageSquareCode,
} from "lucide-react";
import { getFileGitHistory } from "@/lib/api";
import { FileGitIntelligenceResponse } from "@/types";
import { GitHistoryContributors } from "@/components/history/GitHistoryContributors";
import { GitHistoryTimeline } from "@/components/history/GitHistoryTimeline";

interface GitHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  repoId: string;
  repoName: string;
  targetFile: string;
  availableFiles: string[];
  onChangeTargetFile: (file: string) => void;
  onSelectFile: (file: string) => void;
  onAddToChatContext?: (file: string) => void;
}

export function GitHistoryModal({
  isOpen,
  onClose,
  repoId,
  repoName,
  targetFile,
  availableFiles,
  onChangeTargetFile,
  onSelectFile,
  onAddToChatContext,
}: GitHistoryModalProps) {
  const [data, setData] = useState<FileGitIntelligenceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !targetFile) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    getFileGitHistory(repoId, targetFile)
      .then((res) => {
        if (isMounted) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || "Failed to load git history");
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, repoId, targetFile]);

  if (!isOpen) return null;

  const getChurnBadge = (churn: string) => {
    switch (churn.toLowerCase()) {
      case "high":
        return {
          bg: "bg-rose-500/15 text-rose-400 border-rose-500/30",
          desc: "Frequently modified hotspot",
        };
      case "moderate":
        return {
          bg: "bg-amber-500/15 text-amber-400 border-amber-500/30",
          desc: "Regular modification cadence",
        };
      default:
        return {
          bg: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
          desc: "Stable low-churn module",
        };
    }
  };

  const churnInfo = data ? getChurnBadge(data.churn_rate) : getChurnBadge("low");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        className="w-full max-w-4xl h-[86vh] bg-panel border border-borderDefault rounded-2xl shadow-elevated flex flex-col overflow-hidden text-zinc-100 animate-scale-in"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-borderSubtle bg-surface/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-accent-sky/15 border border-accent-sky/30 text-accent-sky">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-tight text-white flex items-center gap-2">
                <span>Git History Intelligence & Code Evolution</span>
                {data && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full border font-mono font-medium ${churnInfo.bg}`}
                  >
                    {data.churn_rate} Churn ({data.total_commits} commits)
                  </span>
                )}
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5 font-mono">
                {repoName} • Authorship, temporal coupling, and historical timeline
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg border border-borderSubtle hover:bg-surfaceHover text-zinc-400 hover:text-white transition-colors cursor-pointer"
            title="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Target File Selector Bar */}
        <div className="px-6 py-3 border-b border-borderSubtle bg-surface/40 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 font-mono text-xs text-zinc-300">
            <span className="text-zinc-500">Inspecting Module:</span>
            <select
              value={targetFile}
              onChange={(e) => onChangeTargetFile(e.target.value)}
              className="bg-surface border border-borderSubtle rounded-lg px-2.5 py-1 text-accent-sky font-mono text-xs focus:outline-none focus:border-borderFocus max-w-sm truncate transition-colors"
            >
              {availableFiles.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            {onAddToChatContext && (
              <button
                onClick={() => {
                  onAddToChatContext(targetFile);
                }}
                className="flex items-center gap-1.5 px-3 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-mono text-zinc-200 transition-colors"
                title="Pin this file to the AI Chat targeted context"
              >
                <MessageSquareCode className="w-3.5 h-3.5 text-sky-400" />
                <span>Add to Chat Context</span>
              </button>
            )}

            <button
              onClick={() => {
                onSelectFile(targetFile);
                onClose();
              }}
              className="flex items-center gap-1.5 px-3 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-mono text-zinc-200 transition-colors"
              title="Open in Code Inspector Drawer"
            >
              <FileCode className="w-3.5 h-3.5 text-amber-400" />
              <span>Inspect Code</span>
            </button>
          </div>
        </div>

        {/* Main Body */}
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-zinc-400 font-mono text-xs">
            <Loader2 className="w-7 h-7 animate-spin text-sky-400" />
            <span>Analyzing commit history, authors, and co-changed files...</span>
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <AlertCircle className="w-8 h-8 text-rose-400" />
            <div className="text-sm font-medium text-rose-300">{error}</div>
            <button
              onClick={() => onChangeTargetFile(targetFile)}
              className="px-4 py-2 rounded-lg bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 text-xs font-mono text-zinc-200 mt-2"
            >
              Retry
            </button>
          </div>
        ) : data ? (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Evolution Summary Box */}
            <div className="p-4 rounded-xl border border-sky-500/30 bg-sky-500/10 text-xs font-sans text-sky-200 leading-relaxed flex items-start gap-3">
              <TrendingUp className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-sky-300 font-mono text-[11px] uppercase tracking-wider block mb-1">
                  Evolution Summary
                </span>
                <p>{data.evolution_summary}</p>
              </div>
            </div>

            {/* Top Contributors & Co-Changed Modules (2 Column Grid) */}
            <GitHistoryContributors
              data={data}
              onChangeTargetFile={onChangeTargetFile}
              onSelectFile={onSelectFile}
              onClose={onClose}
            />

            {/* Code Evolution Timeline */}
            <GitHistoryTimeline commits={data.recent_commits} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
