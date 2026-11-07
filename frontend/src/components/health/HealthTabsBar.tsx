"use client";

import React from "react";
import { AlertTriangle, TrendingUp, RotateCcw, FileText } from "lucide-react";
import { ArchitectureSmellType, CodebaseHealthResponse } from "@/types";

interface HealthTabsBarProps {
  activeTab: "smells" | "metrics" | "cycles" | "report";
  setActiveTab: (tab: "smells" | "metrics" | "cycles" | "report") => void;
  data: CodebaseHealthResponse;
  reportMarkdown: string | null;
  onFetchReport: () => void;
  selectedSmellFilter: "all" | ArchitectureSmellType;
  setSelectedSmellFilter: (filter: "all" | ArchitectureSmellType) => void;
  searchFilter: string;
  setSearchFilter: (query: string) => void;
}

export function HealthTabsBar({
  activeTab,
  setActiveTab,
  data,
  reportMarkdown,
  onFetchReport,
  selectedSmellFilter,
  setSelectedSmellFilter,
  searchFilter,
  setSearchFilter,
}: HealthTabsBarProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-2.5 border-b border-zinc-800 bg-zinc-950 shrink-0">
      <div className="flex items-center gap-1 font-mono text-xs">
        <button
          onClick={() => setActiveTab("smells")}
          className={`px-3 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
            activeTab === "smells"
              ? "bg-zinc-800 text-sky-400 font-medium"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Architecture Smells ({data.smells.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("metrics")}
          className={`px-3 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
            activeTab === "metrics"
              ? "bg-zinc-800 text-sky-400 font-medium"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Hotspots & Metrics</span>
        </button>
        <button
          onClick={() => setActiveTab("cycles")}
          className={`px-3 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
            activeTab === "cycles"
              ? "bg-zinc-800 text-rose-400 font-medium"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Circular Cycles ({data.circular_dependencies.length})</span>
        </button>
        <button
          onClick={() => {
            setActiveTab("report");
            if (!reportMarkdown) onFetchReport();
          }}
          className={`px-3 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
            activeTab === "report"
              ? "bg-zinc-800 text-emerald-400 font-medium"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Diagnostic Report (.md)</span>
        </button>
      </div>

      {activeTab === "smells" && (
        <div className="flex items-center gap-2">
          <select
            value={selectedSmellFilter}
            onChange={(e) => setSelectedSmellFilter(e.target.value as any)}
            aria-label="Filter by smell type"
            className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs font-mono text-zinc-300 focus:outline-none"
          >
            <option value="all">All Smells</option>
            <option value="circular_dependency">Circular Dependencies</option>
            <option value="god_file">God Files (Over-coupled)</option>
            <option value="oversized_module">Oversized Modules</option>
            <option value="dead_module">Dead Modules</option>
            <option value="tight_coupling">Tightly Coupled Pairs</option>
          </select>

          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Filter by file..."
            aria-label="Filter smells by file or keyword"
            className="bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1 text-xs font-mono text-zinc-300 placeholder-zinc-600 focus:outline-none w-44"
          />
        </div>
      )}
    </div>
  );
}
