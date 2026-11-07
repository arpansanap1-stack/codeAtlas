"use client";

import React, { useState } from "react";
import { Layers, FileCode, X, Plus } from "lucide-react";

interface PinnedContextBarProps {
  selectedFiles: string[];
  onRemoveSelectedFile?: (filePath: string) => void;
  onClearSelectedFiles?: () => void;
  availableFiles?: string[];
  onAddSelectedFile?: (filePath: string) => void;
}

export function PinnedContextBar({
  selectedFiles,
  onRemoveSelectedFile,
  onClearSelectedFiles,
  availableFiles = [],
  onAddSelectedFile,
}: PinnedContextBarProps) {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = availableFiles
    .filter((f) => !selectedFiles.includes(f))
    .filter((f) => f.toLowerCase().includes(search.toLowerCase()))
    .slice(0, 8);

  if (selectedFiles.length === 0 && !showAddMenu) {
    return (
      <div className="px-4 py-2 bg-zinc-900/40 border-b border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
        <div className="flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5" />
          <span>Full codebase RAG search active</span>
        </div>
        {onAddSelectedFile && availableFiles.length > 0 && (
          <button
            onClick={() => setShowAddMenu(true)}
            className="flex items-center gap-1 text-sky-400 hover:text-sky-300 transition-colors cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>Pin code</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="px-4 py-2.5 bg-zinc-900/60 border-b border-zinc-800 text-xs">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-zinc-300 font-medium">
          <Layers className="w-3.5 h-3.5 text-sky-400" />
          <span>Pinned Code Context ({selectedFiles.length})</span>
        </div>
        <div className="flex items-center gap-2">
          {onAddSelectedFile && (
            <button
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="text-[11px] font-mono text-sky-400 hover:text-sky-300 flex items-center gap-0.5 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Add</span>
            </button>
          )}
          {onClearSelectedFiles && selectedFiles.length > 0 && (
            <button
              onClick={onClearSelectedFiles}
              className="text-[11px] font-mono text-zinc-500 hover:text-zinc-300 cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Selected file pills */}
      <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
        {selectedFiles.map((file) => (
          <span
            key={file}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[11px] font-mono text-zinc-300"
          >
            <FileCode className="w-3 h-3 text-sky-400" />
            <span className="truncate max-w-[140px]">{file.split("/").pop()}</span>
            {onRemoveSelectedFile && (
              <button
                onClick={() => onRemoveSelectedFile(file)}
                className="hover:text-rose-400 text-zinc-500 ml-0.5 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </span>
        ))}
      </div>

      {/* Add file popover */}
      {showAddMenu && (
        <div className="mt-2 p-2 rounded-lg bg-zinc-950 border border-zinc-800 shadow-xl space-y-1.5">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search file to pin..."
            className="w-full px-2 py-1 bg-zinc-900 border border-zinc-800 rounded text-[11px] font-mono text-zinc-200 placeholder-zinc-500 focus:outline-none"
            autoFocus
          />
          <div className="max-h-28 overflow-y-auto space-y-0.5">
            {filtered.map((f) => (
              <button
                key={f}
                onClick={() => {
                  onAddSelectedFile?.(f);
                  setShowAddMenu(false);
                  setSearch("");
                }}
                className="w-full text-left px-2 py-1 rounded hover:bg-zinc-800 text-[11px] font-mono text-zinc-300 truncate block cursor-pointer"
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
