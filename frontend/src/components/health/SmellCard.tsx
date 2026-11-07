"use client";

import React from "react";
import {
  AlertTriangle,
  RotateCcw,
  Layers,
  FileCode,
  AlertOctagon,
  Eye,
  HelpCircle,
} from "lucide-react";
import { ArchitectureSmell } from "@/types";

interface SmellCardProps {
  smell: ArchitectureSmell;
  onHighlightOnMap?: (affectedFiles: string[], targetFile: string) => void;
  onSelectFile?: (filePath: string) => void;
  onCloseModal?: () => void;
}

export function SmellCard({
  smell,
  onHighlightOnMap,
  onSelectFile,
  onCloseModal,
}: SmellCardProps) {
  const isCircular = smell.smell_type === "circular_dependency";
  const isGod = smell.smell_type === "god_file";
  const isOversized = smell.smell_type === "oversized_module";
  const isTight = smell.smell_type === "tight_coupling";

  return (
    <div
      className={`p-4 rounded-xl border transition-all ${
        smell.severity === "critical"
          ? "bg-rose-950/20 border-rose-900/40 hover:border-rose-700/60"
          : smell.severity === "warning"
          ? "bg-amber-950/20 border-amber-900/40 hover:border-amber-700/60"
          : "bg-zinc-900/40 border-zinc-800 hover:border-zinc-700"
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2.5">
          <div
            className={`p-1.5 rounded-lg shrink-0 ${
              smell.severity === "critical"
                ? "bg-rose-500/15 text-rose-400"
                : smell.severity === "warning"
                ? "bg-amber-500/15 text-amber-400"
                : "bg-zinc-800 text-zinc-400"
            }`}
          >
            {isCircular ? (
              <RotateCcw className="w-4 h-4 animate-spin-slow" />
            ) : isGod ? (
              <Layers className="w-4 h-4" />
            ) : isOversized ? (
              <FileCode className="w-4 h-4" />
            ) : isTight ? (
              <AlertOctagon className="w-4 h-4" />
            ) : (
              <AlertTriangle className="w-4 h-4" />
            )}
          </div>
          <div>
            <h4 className="text-sm font-semibold text-zinc-200">
              {smell.title}
            </h4>
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
              {smell.smell_type}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
              smell.severity === "critical"
                ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                : smell.severity === "warning"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                : "bg-zinc-800 text-zinc-400 border border-zinc-700"
            }`}
          >
            {smell.severity}
          </span>

          {onHighlightOnMap && smell.affected_files.length > 0 && (
            <button
              onClick={() => {
                onHighlightOnMap(smell.affected_files, smell.affected_files[0]);
                onCloseModal?.();
              }}
              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-sky-500/20 text-zinc-400 hover:text-sky-300 border border-zinc-700/60 hover:border-sky-500/30 transition-all text-xs flex items-center gap-1 cursor-pointer"
              title="Highlight affected modules on Map"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <p className="text-xs text-zinc-400 leading-relaxed mb-3">
        {smell.description}
      </p>

      {/* Affected Files List */}
      <div className="mb-3">
        <span className="text-[11px] font-medium text-zinc-500 mb-1.5 block">
          Affected Files:
        </span>
        <div className="flex flex-wrap gap-1.5">
          {smell.affected_files.map((file) => (
            <button
              key={file}
              onClick={() => {
                onSelectFile?.(file);
                onCloseModal?.();
              }}
              className="px-2 py-0.5 rounded-md bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-[11px] font-mono text-zinc-300 hover:text-sky-400 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <FileCode className="w-3 h-3 text-zinc-500" />
              <span>{file}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Actionable Refactoring Tip */}
      <div className="p-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800/80 flex items-start gap-2">
        <HelpCircle className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-zinc-300 leading-normal">
          <strong className="text-sky-400 font-medium">Fix Tip: </strong>
          {smell.refactoring_tip}
        </p>
      </div>
    </div>
  );
}
