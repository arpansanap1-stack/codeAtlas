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
  { key: "completed", label: "Ready" },
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
    <main className="relative flex flex-col h-screen w-screen overflow-hidden bg-zinc-950 text-zinc-100">
      {/* Top Navigation & Repository Input Bar */}
      <header className="h-14 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md px-4 flex items-center justify-between gap-4 z-20 shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-sky-400 shadow-sm">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm tracking-tight text-zinc-100">
                CodeAtlas
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-800/80 text-zinc-400 border border-zinc-700/40">
                v0.1
              </span>
            </div>
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleAnalyze} className="flex-1 max-w-xl flex items-center gap-2">
          <div className="relative flex-1">
            <GitBranch className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/owner/repository"
              className="w-full h-8 bg-zinc-900/90 border border-zinc-800 rounded-md pl-9 pr-3 text-xs font-mono text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="h-8 px-3.5 rounded-md bg-zinc-100 text-zinc-900 hover:bg-white text-xs font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50 shrink-0 shadow-sm"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Cloning...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-zinc-700" />
                <span>Analyze Repo</span>
              </>
            )}
          </button>
        </form>

        {/* Right Info / Sample Buttons & Gemini AI Badge */}
        <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
          <GeminiKeyModal />
          <span className="text-[11px] text-zinc-500 hidden md:inline ml-1">Try:</span>
          <button
            type="button"
            onClick={() => {
              setRepoUrl("https://github.com/octocat/Spoon-Knife");
            }}
            className="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-[11px] text-zinc-300 border border-zinc-800 transition-colors"
          >
            Spoon-Knife
          </button>
          <button
            type="button"
            onClick={() => {
              setRepoUrl("https://github.com/octocat/Hello-World");
            }}
            className="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-[11px] text-zinc-300 border border-zinc-800 transition-colors"
          >
            Hello-World
          </button>
        </div>
      </header>

      {/* Status Progress Bar (if processing or loading) */}
      {loading && !repoData && (
        <div className="h-9 bg-zinc-900/90 border-b border-zinc-800/80 px-4 flex items-center justify-between text-xs font-mono z-10">
          <div className="flex items-center gap-4">
            <span className="text-zinc-400 flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
              <span>Cloning GitHub repository & parsing AST chunks...</span>
            </span>
            <span className="text-zinc-500 text-[11px] hidden sm:inline">
              (Shallow clone, noise filter, AST tree-sitter & graph indexing)
            </span>
          </div>
        </div>
      )}

      {repoData && repoData.status !== "completed" && repoData.status !== "failed" && (
        <div className="h-9 bg-zinc-900/90 border-b border-zinc-800/80 px-4 flex items-center justify-between text-xs font-mono z-10">
          <div className="flex items-center gap-4">
            <span className="text-zinc-400 flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
              <span>Analyzing {repoData.repo_name}...</span>
            </span>
            <div className="flex items-center gap-2">
              {STATUS_STEPS.map((s, idx) => (
                <div key={s.key} className="flex items-center gap-1.5">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      repoData.status === s.key ? "bg-sky-400 animate-pulse" : "bg-zinc-700"
                    }`}
                  />
                  <span
                    className={`text-[11px] ${
                      repoData.status === s.key ? "text-zinc-200" : "text-zinc-500"
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
        <div className="p-3 bg-rose-500/10 border-b border-rose-500/20 text-xs font-mono text-rose-400 flex items-center justify-between z-10">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-zinc-400 hover:text-white">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Workspace Area */}
      <div className="relative flex-1 w-full h-full overflow-hidden">
        {loading && !graphData ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-sky-400 mb-4 shadow-md">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
            <h2 className="text-base font-medium text-zinc-200 mb-1">
              Analyzing Codebase Architecture...
            </h2>
            <p className="text-xs text-zinc-500 max-w-sm mb-4 leading-relaxed font-mono">
              Cloning repository from GitHub, generating AST dependency graph, and extracting syntax-aware code chunks.
            </p>
          </div>
        ) : graphData && graphData.nodes.length > 0 ? (
          <ArchitectureMap
            graphData={graphData}
            onSelectFile={(path) => setSelectedFile(path)}
            selectedFile={selectedFile}
          />
        ) : (
          /* Empty / Welcome State */
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 mb-4 shadow-md">
              <Layers className="w-6 h-6" />
            </div>
            <h1 className="text-base font-medium text-zinc-200 mb-1">
              Visual Architecture Dependency Map
            </h1>
            <p className="text-xs text-zinc-500 max-w-sm mb-6 leading-relaxed">
              Enter any public GitHub repository URL above to clone, parse AST declarations, and
              render an interactive dependency graph with code citations.
            </p>
            <button
              onClick={() => handleAnalyze()}
              className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-mono text-zinc-200 flex items-center gap-2 transition-colors shadow-sm"
            >
              <span>Analyze Sample Repository</span>
              <ArrowRight className="w-3.5 h-3.5 text-sky-400" />
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
        <footer className="h-9 border-t border-zinc-800/80 bg-zinc-950 px-4 flex items-center justify-between text-[11px] font-mono text-zinc-400 z-10 shrink-0">
          <div className="flex items-center gap-4">
            <span className="text-zinc-200 font-medium">{repoData.repo_name}</span>
            <span className="text-zinc-600">|</span>
            <span>{repoData.file_count} files</span>
            <span className="text-zinc-600">|</span>
            <span>{formatBytes(repoData.total_size_bytes)}</span>
            <span className="text-zinc-600">|</span>
            <span>{repoData.chunk_count} AST chunks</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-zinc-300 capitalize">{repoData.status}</span>
            </span>

            <Link
              href={`/repo/${repoData.repo_id}`}
              className="px-2.5 py-1 rounded bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 font-medium flex items-center gap-1.5 transition-colors"
            >
              <MessageSquare className="w-3 h-3" />
              <span>Open AI Workspace</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </footer>
      )}
    </main>
  );
}

