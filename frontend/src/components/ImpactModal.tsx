"use client";

import React, { useEffect, useState } from "react";
import {
  AlertOctagon,
  X,
  FileCode,
  ShieldAlert,
  GitFork,
  ArrowRight,
  ExternalLink,
  Layers,
  Sparkles,
  Loader2,
  CheckCircle2,
  Network,
} from "lucide-react";
import { getImpactAnalysis } from "@/lib/api";
import { ImpactAnalysisResponse, ImpactRiskLevel } from "@/types";

interface ImpactModalProps {
  isOpen: boolean;
  onClose: () => void;
  repoId: string;
  repoName: string;
  targetFile: string;
  availableFiles: string[];
  onChangeTargetFile: (file: string) => void;
  onHighlightOnMap: (affectedPaths: string[], targetFile: string) => void;
  onSelectCitation: (filePath: string, startLine: number, endLine: number) => void;
}

function getRiskBadge(level: ImpactRiskLevel) {
  switch (level) {
    case "critical":
      return {
        bg: "bg-rose-500/15 text-rose-400 border-rose-500/30",
        label: "CRITICAL BLAST RADIUS",
      };
    case "high":
      return {
        bg: "bg-amber-500/15 text-amber-400 border-amber-500/30",
        label: "HIGH IMPACT",
      };
    case "moderate":
      return {
        bg: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
        label: "MODERATE IMPACT",
      };
    case "low":
    default:
      return {
        bg: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
        label: "LOW IMPACT (SAFE)",
      };
  }
}

export function ImpactModal({
  isOpen,
  onClose,
  repoId,
  repoName,
  targetFile,
  availableFiles,
  onChangeTargetFile,
  onHighlightOnMap,
  onSelectCitation,
}: ImpactModalProps) {
  const [data, setData] = useState<ImpactAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !targetFile) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    getImpactAnalysis(repoId, targetFile)
      .then((res) => {
        if (isMounted) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || "Failed to analyze impact");
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, repoId, targetFile]);

  if (!isOpen) return null;

  const riskBadge = data ? getRiskBadge(data.risk_level) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl h-[85vh] bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="h-16 px-6 border-b border-zinc-800/80 bg-zinc-900/60 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <AlertOctagon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2 truncate">
                <span>Impact Analysis Engine</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700/60 font-mono">
                  What Happens If I Change This?
                </span>
              </h2>
              <p className="text-xs text-zinc-400 truncate">
                Downstream blast radius & caller dependency inspection
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* File Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-zinc-900/50 border border-zinc-800">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-semibold text-zinc-300 shrink-0">
                Evaluating File:
              </span>
              <select
                value={targetFile}
                onChange={(e) => onChangeTargetFile(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 rounded-md px-2.5 py-1 text-xs font-mono text-zinc-100 focus:outline-none focus:border-amber-500/60 max-w-xs truncate"
              >
                {availableFiles.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>

            {data && (
              <button
                onClick={() => {
                  onHighlightOnMap(data.all_affected_file_paths, targetFile);
                  onClose();
                }}
                className="px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-400 text-xs font-mono flex items-center gap-1.5 transition-colors shrink-0"
                title="Highlight affected nodes on React Flow Canvas"
              >
                <Network className="w-3.5 h-3.5" />
                <span>Show Blast Radius on Map</span>
              </button>
            )}
          </div>

          {loading ? (
            <div className="h-56 flex flex-col items-center justify-center gap-3 text-zinc-400 font-mono text-xs">
              <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
              <span>Calculating reverse dependency blast radius...</span>
            </div>
          ) : error ? (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono">
              {error}
            </div>
          ) : data ? (
            <div className="space-y-5 animate-in fade-in duration-300">
              {/* Score & Risk Banner */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-1">
                  <span className="text-[11px] font-mono text-zinc-400">Risk Severity</span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-mono font-bold border ${riskBadge?.bg}`}
                    >
                      {riskBadge?.label}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-1">
                  <span className="text-[11px] font-mono text-zinc-400">Blast Radius Score</span>
                  <div className="text-lg font-bold font-mono text-zinc-100 flex items-center gap-2">
                    <span>{data.blast_radius_score}</span>
                    <span className="text-xs text-zinc-400 font-normal">
                      affected module{data.blast_radius_score === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-1">
                  <span className="text-[11px] font-mono text-zinc-400">Direct Importers</span>
                  <div className="text-lg font-bold font-mono text-sky-400">
                    {data.direct_dependents.length}
                  </div>
                </div>
              </div>

              {/* Summary Card */}
              <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-2">
                <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Executive Impact Summary</span>
                </span>
                <p className="text-xs text-zinc-300 leading-relaxed font-sans">
                  {data.summary}
                </p>

                {/* Subsystems pills */}
                <div className="pt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-mono text-zinc-400 mr-1">
                    Exposed Subsystems:
                  </span>
                  {data.affected_subsystems.map((sub, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700/60 text-[10px] font-mono"
                    >
                      {sub}
                    </span>
                  ))}
                </div>
              </div>

              {/* Direct Dependents (Depth 1) */}
              <div className="space-y-2.5">
                <span className="text-xs font-semibold text-zinc-200 flex items-center justify-between">
                  <span>Direct Dependents (Files directly importing this module):</span>
                  <span className="text-[11px] font-mono text-zinc-500">
                    {data.direct_dependents.length} total
                  </span>
                </span>

                {data.direct_dependents.length === 0 ? (
                  <div className="p-3 rounded-lg bg-zinc-900/40 border border-zinc-800 text-xs text-zinc-400 font-mono">
                    Zero direct callers. This module is an isolated leaf.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {data.direct_dependents.map((dep, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          onSelectCitation(dep.file_path, 1, 30);
                          onClose();
                        }}
                        className="text-left p-2.5 rounded-lg bg-zinc-900/60 hover:bg-zinc-850 border border-zinc-800/80 hover:border-sky-500/40 transition-colors flex items-center justify-between gap-2 group"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <FileCode className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                          <span className="text-xs font-mono text-zinc-200 group-hover:text-white truncate">
                            {dep.file_path}
                          </span>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 font-mono shrink-0">
                          Direct
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Indirect Transitive Dependents (Depth 2+) */}
              {data.indirect_dependents.length > 0 && (
                <div className="space-y-2.5">
                  <span className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
                    <span>Indirect Transitive Dependents (Downstream consumers):</span>
                    <span className="text-[11px] font-mono text-zinc-500">
                      {data.indirect_dependents.length} total
                    </span>
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {data.indirect_dependents.map((dep, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          onSelectCitation(dep.file_path, 1, 30);
                          onClose();
                        }}
                        className="text-left p-2.5 rounded-lg bg-zinc-900/40 hover:bg-zinc-850 border border-zinc-800/70 hover:border-amber-500/40 transition-colors flex items-center justify-between gap-2 group"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <FileCode className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="text-xs font-mono text-zinc-300 group-hover:text-white truncate">
                            {dep.file_path}
                          </span>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono shrink-0">
                          Depth {dep.depth}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800 space-y-2">
                <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Refactoring & Safety Recommendations</span>
                </span>
                <ul className="space-y-1.5 list-disc list-inside text-xs text-zinc-300">
                  {data.recommendations.map((rec, i) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

