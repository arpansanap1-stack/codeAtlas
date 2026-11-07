"use client";

import React from "react";
import { FileCode, TrendingUp, RotateCcw, Flame } from "lucide-react";
import { CodebaseHealthResponse } from "@/types";

interface HealthScoreCardsProps {
  data: CodebaseHealthResponse;
  scoreTheme: { text: string; ring: string; bg: string };
}

export function HealthScoreCards({ data, scoreTheme }: HealthScoreCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-6 border-b border-zinc-800 bg-zinc-900/30 shrink-0">
      <div className="col-span-2 sm:col-span-1 flex items-center gap-3 p-3 rounded-lg bg-zinc-900/80 border border-zinc-800">
        <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
          <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 36 36">
            <path
              className="text-zinc-800"
              strokeWidth="3.5"
              stroke="currentColor"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
            <path
              className={`${scoreTheme.ring} transition-all duration-1000`}
              strokeDasharray={`${data.health_score}, 100`}
              strokeWidth="3.5"
              strokeLinecap="round"
              stroke="currentColor"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
          </svg>
          <span className={`absolute text-xs font-bold font-mono ${scoreTheme.text}`}>
            {data.health_score}
          </span>
        </div>
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider font-mono text-zinc-400">
            Health Score
          </div>
          <div className="text-xs font-semibold text-zinc-200 truncate">
            {data.health_rating}
          </div>
        </div>
      </div>

      <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800">
        <div className="flex items-center justify-between text-zinc-400 text-[10px] font-mono uppercase">
          <span>Files</span>
          <FileCode className="w-3.5 h-3.5 text-sky-400" />
        </div>
        <div className="text-lg font-bold font-mono text-zinc-100 mt-1">
          {data.total_files}
        </div>
        <div className="text-[10px] text-zinc-400 font-mono truncate">
          {data.total_lines.toLocaleString()} lines
        </div>
      </div>

      <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800">
        <div className="flex items-center justify-between text-zinc-400 text-[10px] font-mono uppercase">
          <span>Graph Density</span>
          <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
        </div>
        <div className="text-lg font-bold font-mono text-zinc-100 mt-1">
          {(data.graph_density * 100).toFixed(1)}%
        </div>
        <div className="text-[10px] text-zinc-400 font-mono truncate">
          Coupling intensity
        </div>
      </div>

      <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800">
        <div className="flex items-center justify-between text-zinc-400 text-[10px] font-mono uppercase">
          <span>Cycles</span>
          <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
        </div>
        <div
          className={`text-lg font-bold font-mono mt-1 ${
            data.circular_dependencies.length > 0 ? "text-rose-400" : "text-emerald-400"
          }`}
        >
          {data.circular_dependencies.length}
        </div>
        <div className="text-[10px] text-zinc-400 font-mono truncate">
          {data.circular_dependencies.length > 0 ? "Circular loops" : "Clean DAG"}
        </div>
      </div>

      <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800">
        <div className="flex items-center justify-between text-zinc-400 text-[10px] font-mono uppercase">
          <span>Smells</span>
          <Flame className="w-3.5 h-3.5 text-amber-400" />
        </div>
        <div
          className={`text-lg font-bold font-mono mt-1 ${
            data.smells.length > 0 ? "text-amber-400" : "text-emerald-400"
          }`}
        >
          {data.smells.length}
        </div>
        <div className="text-[10px] text-zinc-400 font-mono truncate">
          Issues detected
        </div>
      </div>
    </div>
  );
}
