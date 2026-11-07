"use client";

import React, { useMemo } from "react";
import {
  Compass,
  Network,
  MessageSquare,
  FileCode,
  Layers,
  Cpu,
  TrendingUp,
  BarChart3,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { GraphData, RepoIngestResponse } from "@/types";
import { formatBytes } from "@/lib/utils";
import { OverviewMetricCard } from "@/components/overview/OverviewMetricCard";
import { QuickActionsGrid } from "@/components/overview/QuickActionsGrid";

interface RepoOverviewViewProps {
  repo: RepoIngestResponse;
  graphData: GraphData;
  onNavigateTab: (tab: string) => void;
  onOpenModal: (
    modal:
      | "explain"
      | "journey"
      | "debug"
      | "impact"
      | "health"
      | "history"
      | "snapshot"
      | "gemini"
  ) => void;
  onSelectFile: (filePath: string) => void;
}

export function RepoOverviewView({
  repo,
  graphData,
  onNavigateTab,
  onOpenModal,
  onSelectFile,
}: RepoOverviewViewProps) {
  const languages = useMemo(() => {
    const counts: Record<string, number> = {};
    graphData.nodes.forEach((n) => {
      const ext = n.id.split(".").pop()?.toLowerCase() || "other";
      const name =
        ext === "ts" || ext === "tsx"
          ? "TypeScript"
          : ext === "js" || ext === "jsx"
          ? "JavaScript"
          : ext === "py"
          ? "Python"
          : ext === "json"
          ? "JSON"
          : ext === "md"
          ? "Markdown"
          : ext === "sql"
          ? "SQL"
          : ext.toUpperCase();
      counts[name] = (counts[name] || 0) + 1;
    });

    const total = graphData.nodes.length || 1;
    return Object.entries(counts)
      .map(([lang, count]) => ({
        lang,
        count,
        percent: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);
  }, [graphData.nodes]);

  const topHubs = useMemo(() => {
    return [...graphData.nodes]
      .sort((a, b) => b.in_degree + b.out_degree - (a.in_degree + a.out_degree))
      .slice(0, 6);
  }, [graphData.nodes]);

  const complexityRating = useMemo(() => {
    const ratio = graphData.edges.length / Math.max(1, graphData.nodes.length);
    if (ratio > 2.5) return { label: "High Coupling", color: "text-amber-400 bg-amber-500/10 border-amber-500/20" };
    if (ratio > 1.2) return { label: "Modular", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" };
    return { label: "Decoupled", color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20" };
  }, [graphData]);

  return (
    <div className="h-full w-full overflow-y-auto p-6 md:p-8 space-y-8 bg-zinc-950 text-zinc-100">
      {/* Hero Header Card */}
      <div className="relative rounded-2xl bg-zinc-900 border border-zinc-800 p-6 md:p-8 shadow-xl overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-sky-400 shadow-sm">
                <Compass className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">
                    {repo.repo_name}
                  </h1>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Indexed & Ready</span>
                  </span>
                </div>
                <p className="text-xs font-mono text-zinc-400 truncate max-w-lg mt-0.5">
                  {repo.repo_url}
                </p>
              </div>
            </div>

            <p className="text-xs text-zinc-400 max-w-2xl leading-relaxed">
              CodeAtlas parsed this repository's Abstract Syntax Tree, mapped static dependencies,
              and generated hybrid embeddings for real-time RAG question-answering with exact line citations.
            </p>
          </div>

          {/* Quick Primary Actions */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={() => onNavigateTab("map")}
              className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-zinc-950 text-xs font-medium transition-all shadow-md flex items-center gap-2 group cursor-pointer"
            >
              <Network className="w-4 h-4" />
              <span>Explore Graph</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>

            <button
              onClick={() => onNavigateTab("chat")}
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-medium text-zinc-200 hover:text-white transition-all flex items-center gap-2 cursor-pointer"
            >
              <MessageSquare className="w-4 h-4 text-sky-400" />
              <span>Open AI Chat</span>
            </button>

            <button
              onClick={() => onOpenModal("explain")}
              className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-medium text-zinc-300 hover:text-white transition-all flex items-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Explain Architecture</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <OverviewMetricCard
          label="Files & Modules"
          icon={<FileCode className="w-3.5 h-3.5 text-zinc-400" />}
          value={repo.file_count}
          subtext={`${formatBytes(repo.total_size_bytes)} total source`}
        />
        <OverviewMetricCard
          label="AST Code Chunks"
          icon={<Layers className="w-3.5 h-3.5 text-zinc-400" />}
          value={repo.chunk_count}
          subtext="Functions, classes & interfaces"
        />
        <OverviewMetricCard
          label="Dependency Edges"
          icon={<Cpu className="w-3.5 h-3.5 text-zinc-400" />}
          value={graphData.edges.length}
          subtext="Static import connections"
        />
        <OverviewMetricCard
          label="Architecture Density"
          icon={<TrendingUp className="w-3.5 h-3.5 text-zinc-400" />}
          value={(graphData.edges.length / Math.max(1, graphData.nodes.length)).toFixed(2)}
          subtext="Edges per module ratio"
          badge={{
            text: complexityRating.label,
            color: complexityRating.color,
          }}
        />
      </div>

      {/* Main Grid: Language Breakdown & Central Hubs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Languages & Stack */}
        <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-sky-400" />
              <span>Language Composition</span>
            </h3>
            <span className="text-[11px] font-mono text-zinc-500">
              {languages.length} types
            </span>
          </div>

          <div className="w-full h-2.5 rounded-full overflow-hidden flex bg-zinc-950 border border-zinc-800">
            {languages.slice(0, 5).map((l, idx) => {
              const bgColors = [
                "bg-indigo-500",
                "bg-sky-400",
                "bg-emerald-400",
                "bg-amber-400",
                "bg-purple-400",
              ];
              return (
                <div
                  key={l.lang}
                  style={{ width: `${l.percent}%` }}
                  className={`h-full ${bgColors[idx % bgColors.length]}`}
                  title={`${l.lang}: ${l.count} files (${l.percent}%)`}
                />
              );
            })}
          </div>

          <div className="space-y-2 pt-1">
            {languages.slice(0, 6).map((l, idx) => {
              const dotColors = [
                "bg-indigo-500",
                "bg-sky-400",
                "bg-emerald-400",
                "bg-amber-400",
                "bg-purple-400",
              ];
              return (
                <div
                  key={l.lang}
                  className="flex items-center justify-between text-xs font-mono text-zinc-300 py-1 border-b border-zinc-800/50 last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        dotColors[idx % dotColors.length] || "bg-zinc-500"
                      }`}
                    />
                    <span>{l.lang}</span>
                  </div>
                  <div className="flex items-center gap-3 text-zinc-400">
                    <span>{l.count} files</span>
                    <span className="font-semibold text-zinc-200 w-10 text-right">
                      {l.percent}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Center & Right: Most Connected Architecture Hubs */}
        <div className="lg:col-span-2 rounded-xl bg-zinc-900 border border-zinc-800 p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
              <Network className="w-4 h-4 text-sky-400" />
              <span>Core Architecture Hubs (Central Modules)</span>
            </h3>
            <button
              onClick={() => onNavigateTab("map")}
              className="text-[11px] font-mono text-sky-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>View full canvas</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {topHubs.map((hub) => (
              <div
                key={hub.id}
                onClick={() => onSelectFile(hub.id)}
                className="p-3 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-zinc-800/80 hover:border-zinc-700 transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 mb-1">
                    <span className="truncate max-w-[180px]">{hub.folder || "./"}</span>
                    <span className="text-sky-400 font-semibold">
                      {hub.in_degree + hub.out_degree} deps
                    </span>
                  </div>
                  <div className="text-xs font-mono font-medium text-zinc-200 group-hover:text-white truncate">
                    {hub.label}
                  </div>
                  {hub.summary && (
                    <p className="text-[11px] text-zinc-400 line-clamp-2 mt-1">
                      {hub.summary}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 mt-2.5 pt-2 border-t border-zinc-800">
                  <span>In: {hub.in_degree} | Out: {hub.out_degree}</span>
                  <span className="text-sky-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                    Inspect <ArrowRight className="w-2.5 h-2.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Developer Intelligence Workspaces Grid */}
      <div className="space-y-3">
        <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-400">
          Developer Intelligence Workspaces
        </h3>
        <QuickActionsGrid onOpenModal={onOpenModal} />
      </div>
    </div>
  );
}
