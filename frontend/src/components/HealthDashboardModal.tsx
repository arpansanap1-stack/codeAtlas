"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  Activity,
  X,
  AlertTriangle,
  RotateCcw,
  Layers,
  FileCode,
  CheckCircle2,
  AlertOctagon,
  TrendingUp,
  Eye,
  RefreshCw,
  Code2,
  Filter,
  Flame,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  HelpCircle,
} from "lucide-react";
import { getCodebaseHealth } from "@/lib/api";
import {
  ArchitectureSmell,
  ArchitectureSmellType,
  CodebaseHealthResponse,
} from "@/types";

interface HealthDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  repoId: string;
  repoName: string;
  onHighlightOnMap: (filePaths: string[], targetFile: string) => void;
  onSelectFile: (filePath: string) => void;
}

export function HealthDashboardModal({
  isOpen,
  onClose,
  repoId,
  repoName,
  onHighlightOnMap,
  onSelectFile,
}: HealthDashboardModalProps) {
  const [data, setData] = useState<CodebaseHealthResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSmellFilter, setSelectedSmellFilter] = useState<
    "all" | ArchitectureSmellType
  >("all");
  const [activeTab, setActiveTab] = useState<"smells" | "metrics" | "cycles">("smells");
  const [searchFilter, setSearchFilter] = useState("");

  const loadHealthData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getCodebaseHealth(repoId);
      setData(res);
    } catch (err: any) {
      setError(err.message || "Failed to analyze codebase health");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadHealthData();
    }
  }, [isOpen, repoId]);

  const filteredSmells = useMemo(() => {
    if (!data) return [];
    return data.smells.filter((smell) => {
      const matchesType =
        selectedSmellFilter === "all" || smell.smell_type === selectedSmellFilter;
      const matchesSearch =
        !searchFilter.trim() ||
        smell.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
        smell.description.toLowerCase().includes(searchFilter.toLowerCase()) ||
        smell.affected_files.some((f) =>
          f.toLowerCase().includes(searchFilter.toLowerCase())
        );
      return matchesType && matchesSearch;
    });
  }, [data, selectedSmellFilter, searchFilter]);

  if (!isOpen) return null;

  // Score color helper
  const getScoreColor = (score: number) => {
    if (score >= 85) return { text: "text-emerald-400", ring: "stroke-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/30" };
    if (score >= 70) return { text: "text-sky-400", ring: "stroke-sky-500", bg: "bg-sky-500/10 border-sky-500/30" };
    if (score >= 50) return { text: "text-amber-400", ring: "stroke-amber-500", bg: "bg-amber-500/10 border-amber-500/30" };
    return { text: "text-rose-400", ring: "stroke-rose-500", bg: "bg-rose-500/10 border-rose-500/30" };
  };

  const scoreTheme = data ? getScoreColor(data.health_score) : getScoreColor(100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-5xl h-[88vh] bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl flex flex-col overflow-hidden text-zinc-100"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-tight text-white flex items-center gap-2">
                <span>Codebase Health & Architecture Smell Detection</span>
                {data && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full border font-mono font-medium ${scoreTheme.bg} ${scoreTheme.text}`}
                  >
                    Score: {data.health_score}/100 • {data.health_rating}
                  </span>
                )}
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5 font-mono">
                {repoName} • Graph metrics, structural smells, and refactoring insights
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadHealthData}
              disabled={loading}
              className="p-1.5 rounded-lg border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
              title="Refresh Health Analysis"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
              title="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        {loading && !data ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-zinc-400 font-mono text-xs">
            <Loader2 className="w-7 h-7 animate-spin text-sky-400" />
            <span>Analyzing graph topology, cycles, and architecture smells...</span>
          </div>
        ) : error && !data ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <AlertTriangle className="w-8 h-8 text-rose-400" />
            <div className="text-sm font-medium text-rose-300">{error}</div>
            <button
              onClick={loadHealthData}
              className="px-4 py-2 rounded-lg bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 text-xs font-mono text-zinc-200 mt-2"
            >
              Try Again
            </button>
          </div>
        ) : data ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Top Stat Cards & Health Gauge */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-6 border-b border-zinc-800/80 bg-zinc-900/30 shrink-0">
              {/* Health Score Gauge */}
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

              {/* Total Files */}
              <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800">
                <div className="flex items-center justify-between text-zinc-400 text-[10px] font-mono uppercase">
                  <span>Files</span>
                  <FileCode className="w-3.5 h-3.5 text-sky-400" />
                </div>
                <div className="text-lg font-bold font-mono text-zinc-100 mt-1">
                  {data.total_files}
                </div>
                <div className="text-[10px] text-zinc-400 font-mono truncate">
                  {data.total_lines.toLocaleString()} lines total
                </div>
              </div>

              {/* Graph Density */}
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

              {/* Circular Dependencies */}
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

              {/* Architecture Smells */}
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
                  Architecture issues
                </div>
              </div>
            </div>

            {/* Navigation Tabs & Search */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-2.5 border-b border-zinc-800/80 bg-zinc-950">
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
              </div>

              {activeTab === "smells" && (
                <div className="flex items-center gap-2">
                  {/* Smell Type Filter */}
                  <div className="flex items-center gap-1 text-[11px] font-mono">
                    <span className="text-zinc-500">Type:</span>
                    <select
                      value={selectedSmellFilter}
                      onChange={(e) => setSelectedSmellFilter(e.target.value as any)}
                      aria-label="Filter by smell type"
                      className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-zinc-300 focus:outline-none focus:border-zinc-700"
                    >
                      <option value="all">All Smells</option>
                      <option value="circular_dependency">Circular Dependencies</option>
                      <option value="god_file">God Files (Over-coupled)</option>
                      <option value="oversized_module">Oversized Modules</option>
                      <option value="dead_module">Dead Modules</option>
                      <option value="tight_coupling">Tightly Coupled Pairs</option>
                    </select>
                  </div>

                  {/* Search Input */}
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Filter by file or keyword..."
                    aria-label="Filter smells by file or keyword"
                    className="bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1 text-xs font-mono text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-700 w-44"
                  />
                </div>
              )}
            </div>

            {/* Tab 1: Architecture Smells */}
            {activeTab === "smells" && (
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {filteredSmells.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-zinc-800 rounded-xl bg-zinc-900/20">
                    <ShieldCheck className="w-10 h-10 text-emerald-400 mb-2" />
                    <div className="text-sm font-semibold text-zinc-200">
                      No matching architecture smells found
                    </div>
                    <p className="text-xs text-zinc-400 mt-1 max-w-md font-mono">
                      {data.smells.length === 0
                        ? "Congratulations! Your codebase exhibits clean separation of concerns, no circular imports, and balanced module boundaries."
                        : "Try adjusting your smell type filter or search keyword."}
                    </p>
                  </div>
                ) : (
                  filteredSmells.map((smell, idx) => {
                    const isCritical = smell.severity === "critical";
                    const isWarning = smell.severity === "warning";

                    return (
                      <div
                        key={idx}
                        className={`p-4 rounded-xl border transition-all ${
                          isCritical
                            ? "bg-rose-950/20 border-rose-900/40 hover:border-rose-700/60"
                            : isWarning
                            ? "bg-amber-950/20 border-amber-900/40 hover:border-amber-700/60"
                            : "bg-sky-950/20 border-sky-900/40 hover:border-sky-700/60"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[10px] font-mono px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold border ${
                                  isCritical
                                    ? "bg-rose-500/20 text-rose-400 border-rose-500/40"
                                    : isWarning
                                    ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                                    : "bg-sky-500/20 text-sky-400 border-sky-500/40"
                                }`}
                              >
                                {smell.severity}
                              </span>
                              <h3 className="text-sm font-semibold text-zinc-100 font-mono">
                                {smell.title}
                              </h3>
                            </div>
                            <p className="text-xs text-zinc-300 leading-relaxed font-sans">
                              {smell.description}
                            </p>
                          </div>

                          {/* Quick Map Action */}
                          {smell.affected_files.length > 0 && (
                            <button
                              onClick={() => {
                                onHighlightOnMap(smell.affected_files, smell.affected_files[0]);
                                onClose();
                              }}
                              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-mono text-zinc-200 transition-colors"
                              title="Dim other files and focus these nodes on the Architecture Map"
                            >
                              <Eye className="w-3.5 h-3.5 text-sky-400" />
                              <span>Focus on Map</span>
                            </button>
                          )}
                        </div>

                        {/* Affected Files List */}
                        <div className="mt-3 pt-3 border-t border-zinc-800/80">
                          <div className="text-[11px] font-mono text-zinc-400 mb-1.5 flex items-center gap-1">
                            <FileCode className="w-3 h-3 text-zinc-500" />
                            <span>Affected Modules ({smell.affected_files.length}):</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {smell.affected_files.map((file, fIdx) => (
                              <button
                                key={fIdx}
                                onClick={() => {
                                  onSelectFile(file);
                                  onClose();
                                }}
                                className="px-2 py-0.5 rounded bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 text-[11px] font-mono text-sky-300 hover:text-sky-200 transition-colors flex items-center gap-1"
                                title="Click to view file code"
                              >
                                <span>{file}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Refactoring Advice */}
                        <div className="mt-3 p-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800/80 text-xs font-mono text-zinc-300 flex items-start gap-2">
                          <span className="text-emerald-400 font-semibold shrink-0">💡 Fix Tip:</span>
                          <span className="text-zinc-300 font-sans leading-relaxed">
                            {smell.refactoring_tip}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Tab 2: Hotspots & Metrics */}
            {activeTab === "metrics" && (
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Languages Breakdown */}
                <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 font-mono mb-3 flex items-center gap-1.5">
                    <Code2 className="w-4 h-4 text-sky-400" />
                    <span>Language Distribution</span>
                  </h3>

                  {/* Multi-segment Progress Bar */}
                  <div className="h-2.5 w-full bg-zinc-800 rounded-full overflow-hidden flex mb-3">
                    {data.languages.map((lang, lIdx) => {
                      const colors = [
                        "bg-sky-500",
                        "bg-emerald-500",
                        "bg-amber-500",
                        "bg-indigo-500",
                        "bg-rose-500",
                        "bg-purple-500",
                        "bg-teal-500",
                      ];
                      const color = colors[lIdx % colors.length];
                      return (
                        <div
                          key={lIdx}
                          style={{ width: `${lang.percentage}%` }}
                          className={`${color} h-full transition-all`}
                          title={`${lang.language}: ${lang.percentage}% (${lang.file_count} files)`}
                        />
                      );
                    })}
                  </div>

                  {/* Language Pills */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {data.languages.map((lang, lIdx) => (
                      <div
                        key={lIdx}
                        className="p-2 rounded-lg bg-zinc-900/90 border border-zinc-800 flex items-center justify-between text-xs font-mono"
                      >
                        <span className="text-zinc-200 font-medium">{lang.language}</span>
                        <span className="text-zinc-400">
                          {lang.file_count} ({lang.percentage}%)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Two Column Grid: Most Connected Files & Largest Files */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Most Connected (Centrality Hotspots) */}
                  <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 flex flex-col">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 font-mono mb-2 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Flame className="w-4 h-4 text-rose-400" />
                        <span>Most Connected Modules (Hotspots)</span>
                      </span>
                      <span className="text-[10px] text-zinc-500 lowercase">by total degree</span>
                    </h3>
                    <p className="text-[11px] text-zinc-400 mb-3">
                      Modules with highest inward and outward dependency coupling. Changes here pose highest regression risk.
                    </p>

                    <div className="space-y-2 flex-1">
                      {data.most_connected_files.length === 0 ? (
                        <div className="text-xs font-mono text-zinc-500">No hotspot connections recorded.</div>
                      ) : (
                        data.most_connected_files.map((mod, mIdx) => (
                          <div
                            key={mIdx}
                            className="p-2.5 rounded-lg bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 flex items-center justify-between gap-3 text-xs font-mono group"
                          >
                            <button
                              onClick={() => {
                                onSelectFile(mod.file_path);
                                onClose();
                              }}
                              className="text-sky-300 hover:text-sky-200 truncate text-left font-medium"
                              title={mod.file_path}
                            >
                              {mod.file_path}
                            </button>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[10px]">
                                {mod.metric_label}
                              </span>
                              <button
                                onClick={() => {
                                  onHighlightOnMap([mod.file_path], mod.file_path);
                                  onClose();
                                }}
                                className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white"
                                title="Inspect on Map"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Largest Modules */}
                  <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 flex flex-col">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 font-mono mb-2 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <FileCode className="w-4 h-4 text-amber-400" />
                        <span>Largest Modules (LOC)</span>
                      </span>
                      <span className="text-[10px] text-zinc-500 lowercase">by line count</span>
                    </h3>
                    <p className="text-[11px] text-zinc-400 mb-3">
                      Files with the highest line count. Consider splitting these into cohesive submodules.
                    </p>

                    <div className="space-y-2 flex-1">
                      {data.largest_modules.length === 0 ? (
                        <div className="text-xs font-mono text-zinc-500">No module sizing recorded.</div>
                      ) : (
                        data.largest_modules.map((mod, mIdx) => (
                          <div
                            key={mIdx}
                            className="p-2.5 rounded-lg bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 flex items-center justify-between gap-3 text-xs font-mono group"
                          >
                            <button
                              onClick={() => {
                                onSelectFile(mod.file_path);
                                onClose();
                              }}
                              className="text-amber-300 hover:text-amber-200 truncate text-left font-medium"
                              title={mod.file_path}
                            >
                              {mod.file_path}
                            </button>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[10px]">
                                {mod.metric_label}
                              </span>
                              <button
                                onClick={() => {
                                  onSelectFile(mod.file_path);
                                  onClose();
                                }}
                                className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white"
                                title="View Code"
                              >
                                <FileCode className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Dead Files / Unconnected Modules */}
                {data.dead_files.length > 0 && (
                  <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 font-mono mb-2 flex items-center gap-1.5">
                      <HelpCircle className="w-4 h-4 text-zinc-400" />
                      <span>Potential Dead Modules ({data.dead_files.length})</span>
                    </h3>
                    <p className="text-[11px] text-zinc-400 mb-3">
                      These files are never imported by any other module in this repository and do not match standard entrypoints (main, index, app, config). Check if they are obsolete.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {data.dead_files.map((file, dIdx) => (
                        <button
                          key={dIdx}
                          onClick={() => {
                            onSelectFile(file);
                            onClose();
                          }}
                          className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs font-mono text-zinc-300 hover:text-white transition-colors"
                          title="Inspect file"
                        >
                          🍂 {file}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Circular Cycles */}
            {activeTab === "cycles" && (
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {data.circular_dependencies.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-zinc-800 rounded-xl bg-zinc-900/20">
                    <CheckCircle2 className="w-10 h-10 text-emerald-400 mb-2" />
                    <div className="text-sm font-semibold text-zinc-200">
                      No Circular Dependencies Detected
                    </div>
                    <p className="text-xs text-zinc-400 mt-1 max-w-md font-mono">
                      The dependency graph is a strict Directed Acyclic Graph (DAG). There are no circular import loops causing runtime import errors or memory retain cycles.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-center gap-2">
                      <AlertOctagon className="w-4 h-4 shrink-0 text-rose-400" />
                      <span>
                        Found {data.circular_dependencies.length} circular dependency cycle(s). Circular imports can trigger runtime <code>ImportError</code> / <code>NameError</code> on startup or tight coupling.
                      </span>
                    </div>

                    <div className="space-y-3">
                      {data.circular_dependencies.map((cycle, cIdx) => (
                        <div
                          key={cIdx}
                          className="p-4 rounded-xl border border-rose-900/40 bg-zinc-900/80 hover:border-rose-700/60 transition-all space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-mono font-semibold text-rose-400 flex items-center gap-1.5">
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Cycle #{cIdx + 1} ({cycle.length} steps)</span>
                            </span>
                            <button
                              onClick={() => {
                                onHighlightOnMap(cycle, cycle[0]);
                                onClose();
                              }}
                              className="px-3 py-1 rounded-md bg-rose-500/15 border border-rose-500/30 hover:bg-rose-500/25 text-rose-300 text-xs font-mono transition-colors flex items-center gap-1"
                              title="Highlight this circular loop on the Architecture Map"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Highlight Cycle on Map</span>
                            </button>
                          </div>

                          {/* Interactive cycle chain */}
                          <div className="flex flex-wrap items-center gap-1.5 p-3 rounded-lg bg-zinc-950 border border-zinc-800">
                            {cycle.map((file, fIdx) => (
                              <React.Fragment key={fIdx}>
                                <button
                                  onClick={() => {
                                    onSelectFile(file);
                                    onClose();
                                  }}
                                  className="px-2 py-1 rounded bg-zinc-900 border border-zinc-700 text-xs font-mono text-sky-300 hover:text-sky-200 hover:border-sky-500 transition-colors"
                                  title="View file"
                                >
                                  {file}
                                </button>
                                <ArrowRight className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                              </React.Fragment>
                            ))}
                            <button
                              onClick={() => {
                                onSelectFile(cycle[0]);
                                onClose();
                              }}
                              className="px-2 py-1 rounded bg-rose-950/60 border border-rose-700 text-xs font-mono text-rose-300 hover:text-white"
                              title="Loop closes back to initial module"
                            >
                              {cycle[0]} (closes loop)
                            </button>
                          </div>

                          <div className="text-[11px] font-mono text-zinc-400">
                            💡 <span className="text-zinc-300">Suggested resolution:</span> Extract shared interfaces, types, or utility functions into a separate leaf module that neither file depends on cyclically.
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
