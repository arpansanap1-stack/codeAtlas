"use client";

import React from "react";
import { GitCommit, Calendar } from "lucide-react";
import { FileGitIntelligenceResponse } from "@/types";

interface GitHistoryTimelineProps {
  commits: FileGitIntelligenceResponse["recent_commits"];
}

export function GitHistoryTimeline({ commits }: GitHistoryTimelineProps) {
  return (
    <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 font-mono mb-3 flex items-center gap-1.5">
        <GitCommit className="w-4 h-4 text-emerald-400" />
        <span>Code Evolution Timeline ({commits.length} recorded events)</span>
      </h3>

      <div className="space-y-3 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-zinc-800">
        {commits.map((commit, idx) => (
          <div key={idx} className="relative flex items-start gap-4 pl-8 group">
            <div className="absolute left-2 top-2 w-3.5 h-3.5 rounded-full border-2 border-zinc-800 bg-zinc-950 group-hover:border-sky-400 transition-colors shrink-0" />

            <div className="flex-1 p-3 rounded-lg bg-zinc-900/90 border border-zinc-800/80 hover:border-zinc-700 transition-all text-xs font-mono">
              <div className="flex items-center justify-between gap-3 text-zinc-400 text-[11px] mb-1">
                <span className="font-semibold text-zinc-200">{commit.author_name}</span>
                <div className="flex items-center gap-2 text-zinc-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {commit.date}
                  </span>
                  <span className="px-1.5 py-0.2 rounded bg-zinc-800 text-sky-400 text-[10px]">
                    {commit.commit_hash}
                  </span>
                </div>
              </div>

              <div className="text-zinc-200 font-sans text-xs mt-1 leading-snug">
                {commit.message}
              </div>

              {(commit.insertions > 0 || commit.deletions > 0) && (
                <div className="flex items-center gap-2 mt-2 pt-1.5 border-t border-zinc-800/60 text-[10px] font-mono">
                  {commit.insertions > 0 && (
                    <span className="text-emerald-400 font-semibold">+{commit.insertions}</span>
                  )}
                  {commit.deletions > 0 && (
                    <span className="text-rose-400 font-semibold">-{commit.deletions}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
