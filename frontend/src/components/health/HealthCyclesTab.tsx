"use client";

import React from "react";
import { ShieldCheck } from "lucide-react";
import { CodebaseHealthResponse } from "@/types";

interface HealthCyclesTabProps {
  cycles: CodebaseHealthResponse["circular_dependencies"];
  onHighlightOnMap: (filePaths: string[], targetFile: string) => void;
  onClose: () => void;
}

export function HealthCyclesTab({
  cycles,
  onHighlightOnMap,
  onClose,
}: HealthCyclesTabProps) {
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4">
      {cycles.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-zinc-800 rounded-xl bg-zinc-900/20">
          <ShieldCheck className="w-10 h-10 text-emerald-400 mb-2" />
          <div className="text-sm font-semibold text-zinc-200">
            No Circular Dependency Cycles
          </div>
          <p className="text-xs text-zinc-400 mt-1 max-w-md font-mono">
            The module dependency graph forms a clean Directed Acyclic Graph (DAG).
          </p>
        </div>
      ) : (
        cycles.map((cycle, idx) => (
          <div
            key={idx}
            className="p-4 rounded-xl border border-rose-900/40 bg-rose-950/20"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-rose-300">
                Cycle #{idx + 1} ({cycle.length - 1} hops)
              </span>
              <button
                onClick={() => {
                  onHighlightOnMap(cycle, cycle[0]);
                  onClose();
                }}
                className="px-2.5 py-1 rounded bg-rose-500/20 text-rose-300 text-xs font-mono hover:bg-rose-500/30 transition-colors"
              >
                Highlight Loop on Map
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono text-zinc-300">
              {cycle.map((node, cIdx) => (
                <React.Fragment key={cIdx}>
                  <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                    {node}
                  </span>
                  {cIdx < cycle.length - 1 && (
                    <span className="text-rose-400">➔</span>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
