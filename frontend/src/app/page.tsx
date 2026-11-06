"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Compass,
  GitBranch,
  Search,
  Sparkles,
  Loader2,
  CheckCircle2,
  FileCode,
  Layers,
  ArrowRight,
  ExternalLink,
  MessageSquare,
  Network,
  Route,
  Activity,
  Bug,
} from "lucide-react";
import { ArchitectureMap } from "@/components/ArchitectureMap";
import { CodeDrawer } from "@/components/CodeDrawer";
import GeminiKeyModal from "@/components/GeminiKeyModal";
import { ingestRepository, getRepository, getRepositoryGraph } from "@/lib/api";
import { GraphData, RepoIngestResponse, RepoStatus } from "@/types";
import { formatBytes } from "@/lib/utils";

const STATUS_STEPS: { key: RepoStatus; label: string }[] = [
  { key: "cloning", label: "Cloning Repository" },
  { key: "parsing", label: "AST Parsing & Graph" },
  { key: "indexing", label: "Vector Embeddings" },
  { key: "completed", label: "Workspace Ready" },
];

export default function Home() {
  const [repoUrl, setRepoUrl] = useState("https://github.com/octocat/Spoon-Knife");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [repoData, setRepoData] = useState<RepoIngestResponse | null>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  // Poll repository status until completed or failed
  useEffect(() => {
    if (!repoData || repoData.status === "completed" || repoData.status === "failed") {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const updated = await getRepository(repoData.repo_id);
        if (updated.status !== repoData.status) {
          setRepoData((prev) => (prev ? { ...prev, status: updated.status } : prev));
        }

        if (updated.status === "completed") {
          const graph = await getRepositoryGraph(repoData.repo_id);
          setGraphData(graph);
          clearInterval(interval);
        }
      } catch (e) {
        console.error("Polling error:", e);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [repoData]);

  const handleAnalyze = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!repoUrl.trim()) return;

    setLoading(true);
    setError(null);
    setSelectedFile(null);

    try {
      const res = await ingestRepository(repoUrl.trim());
      setRepoData(res);

      if (res.status === "completed" || res.graph_nodes_count > 0) {
        const graph = await getRepositoryGraph(res.repo_id);
        setGraphData(graph);
      }
    } catch (err: any) {
      setError(err.message || "Failed to analyze repository. Check URL and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative flex flex-col h-screen w-screen overflow-hidden bg-workspace text-zinc-100 font-sans">
      {/* Top Navigation & Repository Input Bar */}
      <header className="h-14 border-b border-borderSubtle bg-panel/90 backdrop-blur-xl px-4 md:px-6 flex items-center justify-between gap-4 z-20 shrink-0">
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-surface border border-borderSubtle flex items-center justify-center text-accent-indigoLight shadow-glowIndigo">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm tracking-tight text-white">
                CodeAtlas
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface border border-borderSubtle text-zinc-400">
                v1.1
              </span>
            </div>
          </div>
        </div>

        {/* Center: Repository URL Input Form */}
        <form onSubmit={handleAnalyze} className="flex-1 max-w-xl flex items-center gap-2">
          <div className="relative flex-1">
            <GitBranch className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/owner/repository"
              className="w-full h-9 bg-surface border border-borderSubtle rounded-xl pl-9 pr-3 text-xs font-mono text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-borderFocus transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="h-9 px-4 rounded-xl bg-accent-indigo hover:bg-accent-indigoLight text-white text-xs font-medium transition-all flex items-center gap-1.5 disabled:opacity-50 shrink-0 shadow-glowIndigo cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Ingesting...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-white" />
                <span>Analyze Repo</span>
              </>
            )}
          </button>
        </form>

        {/* Right Info: Sample Repos & Gemini AI Badge */}
        <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
          <GeminiKeyModal />
          <span className="text-[11px] text-zinc-500 hidden lg:inline ml-1">Try:</span>
          <button
            type="button"
            onClick={() => setRepoUrl("https://github.com/octocat/Spoon-Knife")}
            className="hidden sm:inline-block px-2.5 py-1 rounded-lg bg-surface hover:bg-surfaceHover text-[11px] text-zinc-300 border border-borderSubtle transition-colors cursor-pointer"
          >
            Spoon-Knife
          </button>
          <button
            type="button"
            onClick={() => setRepoUrl("https://github.com/octocat/Hello-World")}
            className="hidden md:inline-block px-2.5 py-1 rounded-lg bg-surface hover:bg-surfaceHover text-[11px] text-zinc-300 border border-borderSubtle transition-colors cursor-pointer"
          >
            Hello-World
          </button>
        </div>
      </header>

      {/* Ingestion Status Progress Tracker */}
      {loading && !repoData && (
        <div className="h-10 bg-panel border-b border-borderSubtle px-6 flex items-center justify-between text-xs font-mono z-10 animate-fade-in">
          <div className="flex items-center gap-4">
            <span className="text-zinc-300 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-accent-indigoLight" />
              <span>Cloning GitHub repository & parsing AST chunks...</span>
            </span>
            <span className="text-zinc-500 text-[11px] hidden sm:inline">
              (Shallow clone, noise filter, AST tree-sitter & dependency graph indexing)
            </span>
          </div>
        </div>
      )}

      {repoData && repoData.status !== "completed" && repoData.status !== "failed" && (
        <div className="h-10 bg-panel border-b border-borderSubtle px-6 flex items-center justify-between text-xs font-mono z-10 animate-fade-in">
          <div className="flex items-center gap-4">
            <span className="text-zinc-300 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-accent-indigoLight" />
              <span>Analyzing {repoData.repo_name}...</span>
            </span>
            <div className="flex items-center gap-2">
              {STATUS_STEPS.map((s, idx) => (
                <div key={s.key} className="flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      repoData.status === s.key ? "bg-accent-indigoLight animate-pulse" : "bg-zinc-700"
                    }`}
                  />
                  <span
                    className={`text-[11px] ${
                      repoData.status === s.key ? "text-zinc-200 font-medium" : "text-zinc-500"
                    }`}
                  >
                    {s.label}
                  </span>
                  {idx < STATUS_STEPS.length - 1 && (
                    <span className="text-zinc-600">→</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="p-3 bg-rose-500/10 border-b border-rose-500/20 text-xs font-mono text-rose-400 flex items-center justify-between px-6 z-10">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-zinc-400 hover:text-white cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Viewport Area */}
      <div className="relative flex-1 w-full h-full overflow-hidden bg-workspace">
        {loading && !graphData ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-panel border border-borderDefault flex items-center justify-center text-accent-indigoLight shadow-glowIndigo">
              <Loader2 className="w-7 h-7 animate-spin" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-white">
                Parsing Codebase Architecture...
              </h2>
              <p className="text-xs text-zinc-400 max-w-sm leading-relaxed font-mono">
                Cloning repository, building syntax-aware AST dependency graph, and generating embeddings.
              </p>
            </div>
          </div>
        ) : graphData && graphData.nodes.length > 0 ? (
          <ArchitectureMap
            graphData={graphData}
            onSelectFile={(path) => setSelectedFile(path)}
            selectedFile={selectedFile}
          />
        ) : (
          /* Empty / Welcome Hero State */
          <div className="flex flex-col items-center justify-center h-full text-center px-4 max-w-2xl mx-auto space-y-6">
            <div className="w-16 h-16 rounded-3xl bg-panel border border-borderDefault flex items-center justify-center text-accent-indigoLight shadow-card">
              <Layers className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
                Developer Intelligence & Architecture Explorer
              </h1>
              <p className="text-xs md:text-sm text-zinc-400 leading-relaxed max-w-lg mx-auto">
                Enter any public GitHub repository URL above to generate an interactive AST dependency graph,
                trace execution journeys, diagnose stack traces, and chat with exact code line citations.
              </p>
            </div>

            {/* Feature Highlights Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full pt-2">
              <div className="p-3 rounded-xl bg-panel border border-borderSubtle text-left space-y-1 shadow-card">
                <Network className="w-4 h-4 text-accent-indigoLight" />
                <div className="text-xs font-semibold text-zinc-200">AST Graph</div>
                <div className="text-[11px] text-zinc-500">Static dependencies</div>
              </div>
              <div className="p-3 rounded-xl bg-panel border border-borderSubtle text-left space-y-1 shadow-card">
                <Route className="w-4 h-4 text-accent-emerald" />
                <div className="text-xs font-semibold text-zinc-200">Code Journeys</div>
                <div className="text-[11px] text-zinc-500">Step-by-step flows</div>
              </div>
              <div className="p-3 rounded-xl bg-panel border border-borderSubtle text-left space-y-1 shadow-card">
                <Bug className="w-4 h-4 text-rose-400" />
                <div className="text-xs font-semibold text-zinc-200">AI Debugger</div>
                <div className="text-[11px] text-zinc-500">Stack trace fixes</div>
              </div>
              <div className="p-3 rounded-xl bg-panel border border-borderSubtle text-left space-y-1 shadow-card">
                <MessageSquare className="w-4 h-4 text-accent-sky" />
                <div className="text-xs font-semibold text-zinc-200">Hybrid RAG</div>
                <div className="text-[11px] text-zinc-500">Exact line citations</div>
              </div>
            </div>

            <button
              onClick={() => handleAnalyze()}
              className="px-5 py-2.5 rounded-xl bg-accent-indigo hover:bg-accent-indigoLight text-white text-xs font-medium flex items-center gap-2 transition-all shadow-glowIndigo cursor-pointer"
            >
              <span>Analyze Sample Repository</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Slide-over Code Inspector Drawer */}
        {repoData && selectedFile && graphData && (
          <CodeDrawer
            repoId={repoData.repo_id}
            filePath={selectedFile}
            graphData={graphData}
            onClose={() => setSelectedFile(null)}
            onNavigateFile={(path) => setSelectedFile(path)}
          />
        )}
      </div>

      {/* Bottom Status & Metrics Bar */}
      {repoData && (
        <footer className="h-11 border-t border-borderSubtle bg-panel px-6 flex items-center justify-between text-[11px] font-mono text-zinc-400 z-10 shrink-0">
          <div className="flex items-center gap-4">
            <span className="text-white font-semibold">{repoData.repo_name}</span>
            <span className="text-zinc-600">|</span>
            <span>{repoData.file_count} files</span>
            <span className="text-zinc-600">|</span>
            <span>{formatBytes(repoData.total_size_bytes)}</span>
            <span className="text-zinc-600">|</span>
            <span>{repoData.chunk_count} AST chunks</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-zinc-300 capitalize">{repoData.status}</span>
            </span>

            <Link
              href={`/repo/${repoData.repo_id}`}
              className="px-3.5 py-1.5 rounded-xl bg-accent-indigo hover:bg-accent-indigoLight text-white font-medium flex items-center gap-1.5 transition-all shadow-glowIndigo cursor-pointer"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Enter Workspace</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </footer>
      )}
    </main>
  );
}
