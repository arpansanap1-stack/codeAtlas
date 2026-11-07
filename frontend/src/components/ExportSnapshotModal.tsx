"use client";

import React, { useState } from "react";
import {
  Camera,
  X,
  Download,
  Copy,
  Check,
  FileCode,
  Image as ImageIcon,
  FileText,
  Sparkles,
  Layers,
  Code2,
} from "lucide-react";
import { GraphData, CodebaseHealthResponse } from "@/types";
import {
  exportGraphAsPNG,
  exportGraphAsSVG,
  generateMarkdownArchitectureReport,
  generateMermaidDiagram,
} from "@/lib/exportUtils";

interface ExportSnapshotModalProps {
  isOpen: boolean;
  onClose: () => void;
  repoName: string;
  repoId: string;
  graphData: GraphData;
  healthData?: CodebaseHealthResponse | null;
  selectedFile?: string | null;
}

export function ExportSnapshotModal({
  isOpen,
  onClose,
  repoName,
  repoId,
  graphData,
  healthData,
  selectedFile,
}: ExportSnapshotModalProps) {
  const [copiedMermaid, setCopiedMermaid] = useState(false);
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);

  if (!isOpen) return null;

  const handleDownloadMarkdown = () => {
    const md = generateMarkdownArchitectureReport(repoName, repoId, graphData, healthData);
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${repoName}-architecture-snapshot.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyMermaid = async () => {
    const mermaid = generateMermaidDiagram(graphData);
    await navigator.clipboard.writeText(mermaid);
    setCopiedMermaid(true);
    setTimeout(() => setCopiedMermaid(false), 2000);
  };

  const handleCopyMarkdown = async () => {
    const md = generateMarkdownArchitectureReport(repoName, repoId, graphData, healthData);
    await navigator.clipboard.writeText(md);
    setCopiedMarkdown(true);
    setTimeout(() => setCopiedMarkdown(false), 2000);
  };

  const totalNodes = graphData.nodes.length;
  const totalEdges = graphData.edges.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        className="w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden text-zinc-100 animate-scale-in"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/80">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-400">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-tight text-white flex items-center gap-2">
                <span>Architecture Snapshots & Export</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full border border-sky-500/30 bg-sky-500/10 text-sky-400 font-mono">
                  SVG · PNG · Markdown
                </span>
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5 font-mono">
                {repoName} • {totalNodes} modules, {totalEdges} edges
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg border border-zinc-700 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Card 1: Visual Vector Canvas Export */}
          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 transition-colors">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 shrink-0">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-zinc-200">
                    Interactive Map Canvas Snapshot
                  </h3>
                  <p className="text-[11px] text-zinc-400 mt-0.5 font-mono">
                    High-res vector diagram with dependency edges and module badges
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-zinc-800/80">
              <button
                onClick={() => exportGraphAsPNG(repoName, graphData)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-mono text-zinc-200 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-sky-400" />
                <span>Export High-Res PNG (2x)</span>
              </button>
              <button
                onClick={() => exportGraphAsSVG(repoName, graphData)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-mono text-zinc-200 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-sky-400" />
                <span>Export Scalable Vector (SVG)</span>
              </button>
            </div>
          </div>

          {/* Card 2: Markdown Report Export */}
          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 transition-colors">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-zinc-200">
                    Markdown Architecture Specification
                  </h3>
                  <p className="text-[11px] text-zinc-400 mt-0.5 font-mono">
                    Standalone report with embedded Mermaid topology & module tables
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-zinc-800/80">
              <button
                onClick={handleDownloadMarkdown}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-xs font-mono text-emerald-300 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Report (.md)</span>
              </button>
              <button
                onClick={handleCopyMarkdown}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-mono text-zinc-300 transition-colors cursor-pointer"
              >
                {copiedMarkdown ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Copy Markdown</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Card 3: Mermaid.js Export */}
          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 transition-colors">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 shrink-0">
                  <Code2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-zinc-200">
                    Live Mermaid.js Diagram Definition
                  </h3>
                  <p className="text-[11px] text-zinc-400 mt-0.5 font-mono">
                    Paste directly into GitHub PRs, Notion, Obsidian, or documentation wikis
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-zinc-800/80">
              <button
                onClick={handleCopyMermaid}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-xs font-mono text-amber-300 transition-colors cursor-pointer"
              >
                {copiedMermaid ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied to Clipboard!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Mermaid Code</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
