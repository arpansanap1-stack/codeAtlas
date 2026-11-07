"use client";

import React from "react";
import { Users, GitFork, Eye } from "lucide-react";
import { FileGitIntelligenceResponse } from "@/types";

interface GitHistoryContributorsProps {
  data: FileGitIntelligenceResponse;
  onChangeTargetFile: (file: string) => void;
  onSelectFile: (file: string) => void;
  onClose: () => void;
}

export function GitHistoryContributors({
  data,
  onChangeTargetFile,
  onSelectFile,
  onClose,
}: GitHistoryContributorsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Who Changed It Most? */}
      <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 flex flex-col">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 font-mono mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Users className="w-4 h-4 text-sky-400" />
            <span>Who Changed It Most?</span>
          </span>
          <span className="text-[10px] text-zinc-500">by commit volume</span>
        </h3>

        <div className="space-y-2.5 mt-2 flex-1">
          {data.contributors.length === 0 ? (
            <div className="text-xs font-mono text-zinc-500">
              No contributor records found.
            </div>
          ) : (
            data.contributors.map((c, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-lg bg-zinc-900/90 border border-zinc-800 flex items-center justify-between gap-3 text-xs font-mono"
              >
                <div className="min-w-0">
                  <div className="font-medium text-zinc-200 truncate">{c.name}</div>
                  <div className="text-[10px] text-zinc-500 truncate">{c.email}</div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-sky-400 font-semibold">{c.percentage}%</div>
                  <div className="text-[10px] text-zinc-400">
                    {c.commits_count} commit{c.commits_count > 1 ? "s" : ""}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Which Files Usually Change Together? (Temporal Coupling) */}
      <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 flex flex-col">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 font-mono mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <GitFork className="w-4 h-4 text-amber-400" />
            <span>Which Files Usually Change Together?</span>
          </span>
          <span className="text-[10px] text-zinc-500">temporal coupling</span>
        </h3>

        <div className="space-y-2 mt-2 flex-1">
          {data.co_changed_files.length === 0 ? (
            <div className="text-xs font-mono text-zinc-500">
              This file evolves independently with no co-modification partners.
            </div>
          ) : (
            data.co_changed_files.map((cf, idx) => (
              <div
                key={idx}
                className="p-2 rounded-lg bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 flex items-center justify-between gap-3 text-xs font-mono group"
              >
                <button
                  onClick={() => onChangeTargetFile(cf.file_path)}
                  className="text-amber-300 hover:text-amber-200 truncate text-left font-medium"
                  title={`Switch to ${cf.file_path}`}
                >
                  {cf.file_path}
                </button>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[10px]"
                    title="Co-change coupling strength (0.0 to 1.0)"
                  >
                    {(cf.coupling_strength * 100).toFixed(0)}% co-changed
                  </span>
                  <button
                    onClick={() => {
                      onSelectFile(cf.file_path);
                      onClose();
                    }}
                    className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white"
                    title="Inspect Code"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
