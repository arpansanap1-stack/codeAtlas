"use client";

import React, { useMemo } from "react";
import {
  Compass,
  Network,
  BookOpen,
  MessageSquare,
  Route,
  Activity,
  Bug,
  History,
  Camera,
  Layers,
  FileCode,
  GitBranch,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  TrendingUp,
  Cpu,
  BarChart3,
  ExternalLink,
} from "lucide-react";
import { GraphData, RepoIngestResponse } from "@/types";
import { formatBytes } from "@/lib/utils";

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
  // Compute language distribution from graph node file extensions
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

  // Top central hubs in the architecture
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
    <div className="h-full w-full overflow-y-auto p-6 md:p-8 space-y-8 bg-workspace text-zinc-100">
      {/* Hero Header Card */}
      <div className="relative rounded-2xl bg-panel border border-borderDefault p-6 md:p-8 shadow-card overflow-hidden">
        {/* Subtle Ambient Glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-accent-indigo/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-surface border border-borderSubtle flex items-center justify-center text-accent-indigoLight shadow-sm">
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
              className="px-4 py-2 rounded-xl bg-accent-indigo hover:bg-accent-indigoLight text-white text-xs font-medium transition-all shadow-glowIndigo flex items-center gap-2 group cursor-pointer"
            >
              <Network className="w-4 h-4" />
              <span>Explore Graph</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>

            <button
              onClick={() => onNavigateTab("chat")}
              className="px-4 py-2 rounded-xl bg-surface hover:bg-surfaceHover border border-borderDefault text-xs font-medium text-zinc-200 hover:text-white transition-all flex items-center gap-2 cursor-pointer"
            >
              <MessageSquare className="w-4 h-4 text-accent-sky" />
              <span>Open AI Chat</span>
            </button>

            <button
              onClick={() => onOpenModal("explain")}
              className="px-3.5 py-2 rounded-xl bg-surface hover:bg-surfaceHover border border-borderDefault text-xs font-medium text-zinc-300 hover:text-white transition-all flex items-center gap-2 cursor-pointer"
              title="Explain architecture (Beginner, Intermediate, Expert)"
            >
              <Sparkles className="w-3.5 h-3.5 text-accent-indigoLight" />
              <span className="hidden sm:inline">Explain Architecture</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-panel border border-borderSubtle space-y-1 hover:border-borderDefault transition-colors shadow-card">
          <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 flex items-center justify-between">
            <span>Files & Modules</span>
            <FileCode className="w-3.5 h-3.5 text-zinc-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-zinc-100">
            {repo.file_count}
          </div>
          <div className="text-[11px] font-mono text-zinc-500">
            {formatBytes(repo.total_size_bytes)} total source
          </div>
        </div>

        <div className="p-4 rounded-xl bg-panel border border-borderSubtle space-y-1 hover:border-borderDefault transition-colors shadow-card">
          <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 flex items-center justify-between">
            <span>AST Code Chunks</span>
            <Layers className="w-3.5 h-3.5 text-zinc-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-zinc-100">
            {repo.chunk_count}
          </div>
          <div className="text-[11px] font-mono text-zinc-500">
            Functions, classes & interfaces
          </div>
        </div>

        <div className="p-4 rounded-xl bg-panel border border-borderSubtle space-y-1 hover:border-borderDefault transition-colors shadow-card">
          <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 flex items-center justify-between">
            <span>Dependency Edges</span>
            <Cpu className="w-3.5 h-3.5 text-zinc-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-zinc-100">
            {graphData.edges.length}
          </div>
          <div className="text-[11px] font-mono text-zinc-500">
            Static import connections
          </div>
        </div>

        <div className="p-4 rounded-xl bg-panel border border-borderSubtle space-y-1 hover:border-borderDefault transition-colors shadow-card">
          <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 flex items-center justify-between">
            <span>Architecture Density</span>
            <TrendingUp className="w-3.5 h-3.5 text-zinc-400" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold font-mono text-zinc-100">
              {(graphData.edges.length / Math.max(1, graphData.nodes.length)).toFixed(2)}
            </span>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${complexityRating.color}`}>
              {complexityRating.label}
            </span>
          </div>
          <div className="text-[11px] font-mono text-zinc-500">
            Edges per module ratio
          </div>
        </div>
      </div>

      {/* Main Grid: Language Breakdown & Central Hubs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Languages & Stack */}
        <div className="rounded-xl bg-panel border border-borderDefault p-5 space-y-4 shadow-card">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-accent-indigoLight" />
              <span>Language Composition</span>
            </h3>
            <span className="text-[11px] font-mono text-zinc-500">
              {languages.length} types
            </span>
          </div>

          {/* Proportional color bar */}
          <div className="w-full h-2.5 rounded-full overflow-hidden flex bg-surface border border-borderSubtle">
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

          {/* Language Breakdown List */}
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
                  className="flex items-center justify-between text-xs font-mono text-zinc-300 py-1 border-b border-borderSubtle/50 last:border-0"
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
        <div className="lg:col-span-2 rounded-xl bg-panel border border-borderDefault p-5 space-y-4 shadow-card">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
              <Network className="w-4 h-4 text-accent-sky" />
              <span>Core Architecture Hubs (Central Modules)</span>
            </h3>
            <button
              onClick={() => onNavigateTab("map")}
              className="text-[11px] font-mono text-accent-indigoLight hover:underline flex items-center gap-1"
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
                className="p-3 rounded-lg bg-surface hover:bg-surfaceHover border border-borderSubtle hover:border-borderDefault transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 mb-1">
                    <span className="truncate max-w-[180px]">{hub.folder || "./"}</span>
                    <span className="text-accent-indigoLight font-semibold">
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

                <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 mt-2.5 pt-2 border-t border-borderSubtle">
                  <span>In: {hub.in_degree} | Out: {hub.out_degree}</span>
                  <span className="text-accent-sky group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                    Inspect <ArrowRight className="w-2.5 h-2.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Feature Navigation Cards Section */}
      <div className="space-y-3">
        <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-400">
          Developer Intelligence Workspaces
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Guided Journeys */}
          <div
            onClick={() => onOpenModal("journey")}
            className="p-4 rounded-xl bg-panel border border-borderSubtle hover:border-accent-emerald/40 transition-all cursor-pointer group shadow-card flex flex-col justify-between hover:shadow-glowEmerald/10"
          >
            <div className="space-y-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                <Route className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-semibold text-zinc-100 group-hover:text-emerald-300 transition-colors">
                Code Journeys
              </h4>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Follow guided execution paths (UI → Route → Service → DB) synchronized with the canvas and code viewer.
              </p>
            </div>
            <div className="text-[11px] font-mono text-emerald-400 mt-3 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              <span>Start Journey</span>
              <ArrowRight className="w-3 h-3" />
            </div>
          </div>

          {/* Card 2: Codebase Health */}
          <div
            onClick={() => onOpenModal("health")}
            className="p-4 rounded-xl bg-panel border border-borderSubtle hover:border-accent-indigo/40 transition-all cursor-pointer group shadow-card flex flex-col justify-between hover:shadow-glowIndigo/10"
          >
            <div className="space-y-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
                <Activity className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-semibold text-zinc-100 group-hover:text-indigo-300 transition-colors">
                Health & Smells
              </h4>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Audit circular dependencies, god files, dead code modules, and architectural smell metrics.
              </p>
            </div>
            <div className="text-[11px] font-mono text-indigo-400 mt-3 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              <span>Check Health</span>
              <ArrowRight className="w-3 h-3" />
            </div>
          </div>

          {/* Card 3: AI Debugger */}
          <div
            onClick={() => onOpenModal("debug")}
            className="p-4 rounded-xl bg-panel border border-borderSubtle hover:border-accent-rose/40 transition-all cursor-pointer group shadow-card flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center">
                <Bug className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-semibold text-zinc-100 group-hover:text-rose-300 transition-colors">
                AI Error Explorer
              </h4>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Paste error traces or stack failures to locate root causes and generate code diff resolutions.
              </p>
            </div>
            <div className="text-[11px] font-mono text-rose-400 mt-3 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              <span>Diagnose Error</span>
              <ArrowRight className="w-3 h-3" />
            </div>
          </div>

          {/* Card 4: Onboarding Documentation */}
          <div
            onClick={() => onNavigateTab("docs")}
            className="p-4 rounded-xl bg-panel border border-borderSubtle hover:border-accent-sky/40 transition-all cursor-pointer group shadow-card flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center">
                <BookOpen className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-semibold text-zinc-100 group-hover:text-sky-300 transition-colors">
                Onboarding Guide
              </h4>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Synthesized ONBOARDING.md report with interactive Mermaid architecture diagrams and entry points.
              </p>
            </div>
            <div className="text-[11px] font-mono text-sky-400 mt-3 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              <span>Read Guide</span>
              <ArrowRight className="w-3 h-3" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
