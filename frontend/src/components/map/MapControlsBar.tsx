"use client";

import React from "react";
import { Search, ArrowRight, ArrowDown } from "lucide-react";

interface MapControlsBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  direction: "LR" | "TB";
  onToggleDirection: () => void;
}

export function MapControlsBar({
  searchQuery,
  onSearchChange,
  direction,
  onToggleDirection,
}: MapControlsBarProps) {
  return (
    <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-2 bg-zinc-900/95 backdrop-blur-md p-1.5 rounded-xl border border-zinc-800 shadow-xl">
      {/* Search Input */}
      <div className="relative flex items-center">
        <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 pointer-events-none" />
        <input
          type="text"
          placeholder="Search modules..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-44 md:w-52 bg-zinc-950 border border-zinc-800 rounded-lg pl-8 pr-3 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-700 font-sans transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-2 text-zinc-500 hover:text-zinc-300 text-xs cursor-pointer"
          >
            ×
          </button>
        )}
      </div>

      <div className="h-4 w-[1px] bg-zinc-800" />

      {/* Direction Toggle */}
      <button
        onClick={onToggleDirection}
        className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono text-zinc-300 hover:text-white bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors cursor-pointer"
        title={`Switch to ${direction === "LR" ? "Top-to-Bottom" : "Left-to-Right"} Layout`}
      >
        {direction === "LR" ? (
          <>
            <ArrowRight className="w-3 h-3 text-sky-400" />
            <span>Left → Right</span>
          </>
        ) : (
          <>
            <ArrowDown className="w-3 h-3 text-emerald-400" />
            <span>Top → Down</span>
          </>
        )}
      </button>

      {/* Category Badges */}
      <div className="hidden lg:flex items-center gap-1.5 pl-1 text-[10px] font-mono text-zinc-400">
        <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
          UI
        </span>
        <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
          Services
        </span>
        <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20">
          Models
        </span>
        <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-300 border border-purple-500/20">
          Utils
        </span>
      </div>
    </div>
  );
}
