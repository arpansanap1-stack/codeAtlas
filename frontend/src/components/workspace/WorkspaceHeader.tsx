"use client";

import React from "react";
import Link from "next/link";
import {
  Compass,
  ArrowLeft,
  Search,
  Camera,
  GitBranch,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import GeminiKeyModal from "@/components/GeminiKeyModal";

interface WorkspaceHeaderProps {
  repoName: string;
  showRightPanel: boolean;
  onToggleRightPanel: () => void;
  onOpenCommandPalette: () => void;
  onOpenSnapshot: () => void;
}

export function WorkspaceHeader({
  repoName,
  showRightPanel,
  onToggleRightPanel,
  onOpenCommandPalette,
  onOpenSnapshot,
}: WorkspaceHeaderProps) {
  return (
    <header className="h-13 border-b border-zinc-800 bg-zinc-900/90 backdrop-blur-xl px-4 flex items-center justify-between gap-4 z-20 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <Link
          href="/"
          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          title="Return to Home"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>

        <div className="flex items-center gap-2 truncate">
          <div className="w-6 h-6 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-sky-400 shrink-0">
            <Compass className="w-3.5 h-3.5" />
          </div>

          <div className="flex items-center gap-1.5 text-xs font-mono min-w-0">
            <span className="font-semibold text-zinc-100 truncate">
              {repoName}
            </span>
            <span className="text-zinc-600">/</span>
            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400">
              <GitBranch className="w-2.5 h-2.5 text-emerald-400" />
              <span>main</span>
            </span>
          </div>
        </div>
      </div>

      {/* Center: Command Palette Trigger */}
      <div className="flex-1 max-w-md hidden md:flex items-center justify-center">
        <button
          onClick={onOpenCommandPalette}
          className="w-full h-8 px-3 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-400 hover:text-zinc-200 flex items-center justify-between gap-2 transition-all cursor-pointer group"
        >
          <div className="flex items-center gap-2 text-zinc-400 group-hover:text-zinc-200">
            <Search className="w-3.5 h-3.5" />
            <span className="font-sans text-[11px]">Search commands, features, files...</span>
          </div>
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-zinc-500 bg-zinc-900 border border-zinc-800 rounded">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right: Actions & Chat Drawer Toggle */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onOpenSnapshot}
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-mono text-zinc-300 hover:text-white transition-colors cursor-pointer"
          title="Export architecture snapshot diagram or markdown report"
        >
          <Camera className="w-3.5 h-3.5 text-purple-400" />
          <span className="hidden lg:inline text-[11px]">Snapshot</span>
        </button>

        <GeminiKeyModal />

        <button
          onClick={onToggleRightPanel}
          className={`p-1.5 rounded-lg border text-xs transition-colors flex items-center gap-1.5 cursor-pointer ${
            showRightPanel
              ? "bg-sky-500/15 border-sky-500/35 text-sky-400 shadow-sm"
              : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-700"
          }`}
          title={showRightPanel ? "Collapse AI Chat Assistant" : "Expand AI Chat Assistant"}
        >
          {showRightPanel ? (
            <PanelRightClose className="w-4 h-4" />
          ) : (
            <PanelRightOpen className="w-4 h-4" />
          )}
        </button>
      </div>
    </header>
  );
}
