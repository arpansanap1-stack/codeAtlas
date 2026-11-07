"use client";

import React from "react";
import { TrendingUp, FileCode } from "lucide-react";
import { CodebaseHealthResponse } from "@/types";

interface HealthMetricsTabProps {
  data: CodebaseHealthResponse;
  onSelectFile: (filePath: string) => void;
  onClose: () => void;
}

export function HealthMetricsTab({
  data,
  onSelectFile,
  onClose,
}: HealthMetricsTabProps) {
  return (
    <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Most Connected Hubs */}
      <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40">
        <h3 className="text-sm font-semibold text-zinc-200 mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-sky-400" />
          <span>Most Connected Files (Degree Centrality)</span>
        </h3>
        <div className="space-y-2">
          {data.most_connected_files.map((file, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-2 rounded-lg bg-zinc-950 border border-zinc-800/80"
            >
              <button
                onClick={() => {
                  onSelectFile(file.file_path);
                  onClose();
                }}
                className="text-xs font-mono text-zinc-300 hover:text-sky-400 truncate max-w-[280px] text-left"
              >
                {file.file_path}
              </button>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                {file.value} edges
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Largest Modules */}
      <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40">
        <h3 className="text-sm font-semibold text-zinc-200 mb-3 flex items-center gap-2">
          <FileCode className="w-4 h-4 text-emerald-400" />
          <span>Largest Modules (Lines of Code)</span>
        </h3>
        <div className="space-y-2">
          {data.largest_modules.map((mod, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-2 rounded-lg bg-zinc-950 border border-zinc-800/80"
            >
              <button
                onClick={() => {
                  onSelectFile(mod.file_path);
                  onClose();
                }}
                className="text-xs font-mono text-zinc-300 hover:text-emerald-400 truncate max-w-[280px] text-left"
              >
                {mod.file_path}
              </button>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {mod.value} lines
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Languages Breakdown */}
      <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 md:col-span-2">
        <h3 className="text-sm font-semibold text-zinc-200 mb-3">
          Language Distribution
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {data.languages.map((l, idx) => (
            <div
              key={idx}
              className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80"
            >
              <div className="text-xs font-semibold text-zinc-200">
                {l.language}
              </div>
              <div className="text-lg font-bold font-mono text-sky-400 mt-1">
                {l.percentage}%
              </div>
              <div className="text-[10px] text-zinc-500 font-mono">
                {l.file_count} files
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
