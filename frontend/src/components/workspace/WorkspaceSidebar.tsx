"use client";

import React from "react";
import {
  Compass,
  Network,
  BookOpen,
  Sparkles,
  Route,
  Bug,
  AlertOctagon,
  Activity,
  History,
  Camera,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

type WorkspaceTab = "overview" | "map" | "docs";

interface WorkspaceSidebarProps {
  activeTab: WorkspaceTab;
  setActiveTab: (tab: WorkspaceTab) => void;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void;
  onOpenModal: (
    modal:
      | "explain"
      | "journey"
      | "debug"
      | "impact"
      | "health"
      | "history"
      | "snapshot"
      | "gemini"
  ) => void;
}

export function WorkspaceSidebar({
  activeTab,
  setActiveTab,
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  onOpenModal,
}: WorkspaceSidebarProps) {
  return (
    <aside
      className={`h-full border-r border-zinc-800 bg-zinc-950 flex flex-col justify-between transition-all duration-300 select-none shrink-0 z-10 ${
        isSidebarCollapsed ? "w-14" : "w-56"
      }`}
    >
      {/* Sidebar Navigation Items */}
      <div className="p-2 space-y-4 overflow-y-auto">
        {/* Group 1: OVERVIEW */}
        <div className="space-y-1">
          {!isSidebarCollapsed && (
            <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-semibold">
              Overview
            </div>
          )}
          <button
            onClick={() => setActiveTab("overview")}
            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer group ${
              activeTab === "overview"
                ? "bg-sky-500/15 text-white font-semibold"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
            }`}
            title="Repository Overview"
          >
            <Compass
              className={`w-4 h-4 shrink-0 transition-colors ${
                activeTab === "overview" ? "text-sky-400" : "text-zinc-400 group-hover:text-zinc-200"
              }`}
            />
            {!isSidebarCollapsed && <span className="truncate">Repository Overview</span>}
          </button>
        </div>

        {/* Group 2: EXPLORE */}
        <div className="space-y-1">
          {!isSidebarCollapsed && (
            <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-semibold">
              Explore
            </div>
          )}

          {/* Architecture Map */}
          <button
            onClick={() => setActiveTab("map")}
            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer group ${
              activeTab === "map"
                ? "bg-sky-500/15 text-white font-semibold"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
            }`}
            title="Architecture Dependency Map"
          >
            <Network
              className={`w-4 h-4 shrink-0 transition-colors ${
                activeTab === "map" ? "text-sky-400" : "text-zinc-400 group-hover:text-zinc-200"
              }`}
            />
            {!isSidebarCollapsed && <span className="truncate">Architecture Map</span>}
          </button>

          {/* Onboarding Guide */}
          <button
            onClick={() => setActiveTab("docs")}
            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer group ${
              activeTab === "docs"
                ? "bg-sky-500/15 text-white font-semibold"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
            }`}
            title="Onboarding Documentation (ONBOARDING.md)"
          >
            <BookOpen
              className={`w-4 h-4 shrink-0 transition-colors ${
                activeTab === "docs" ? "text-sky-400" : "text-zinc-400 group-hover:text-zinc-200"
              }`}
            />
            {!isSidebarCollapsed && <span className="truncate">Onboarding Guide</span>}
          </button>
        </div>

        {/* Group 3: INTELLIGENCE WORKBENCHES */}
        <div className="space-y-1">
          {!isSidebarCollapsed && (
            <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-semibold">
              Intelligence
            </div>
          )}

          {/* Architecture Explanation */}
          <button
            onClick={() => onOpenModal("explain")}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors cursor-pointer group"
            title="Explain Architecture (Beginner / Intermediate / Expert)"
          >
            <Sparkles className="w-4 h-4 shrink-0 text-indigo-400 group-hover:scale-105 transition-transform" />
            {!isSidebarCollapsed && <span className="truncate">Explain Architecture</span>}
          </button>

          {/* Interactive Journeys */}
          <button
            onClick={() => onOpenModal("journey")}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors cursor-pointer group"
            title="Guided Codebase Journeys"
          >
            <Route className="w-4 h-4 shrink-0 text-emerald-400 group-hover:scale-105 transition-transform" />
            {!isSidebarCollapsed && <span className="truncate">Codebase Journeys</span>}
          </button>

          {/* AI Debugger */}
          <button
            onClick={() => onOpenModal("debug")}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors cursor-pointer group"
            title="Debug Runtime Errors & Stack Traces"
          >
            <Bug className="w-4 h-4 shrink-0 text-rose-400 group-hover:scale-105 transition-transform" />
            {!isSidebarCollapsed && <span className="truncate">AI Debugger</span>}
          </button>

          {/* Impact Analysis */}
          <button
            onClick={() => onOpenModal("impact")}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors cursor-pointer group"
            title="What happens if I change this? (Blast radius)"
          >
            <AlertOctagon className="w-4 h-4 shrink-0 text-amber-400 group-hover:scale-105 transition-transform" />
            {!isSidebarCollapsed && <span className="truncate">Impact Analysis</span>}
          </button>

          {/* Codebase Health */}
          <button
            onClick={() => onOpenModal("health")}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors cursor-pointer group"
            title="Codebase Health & Architecture Smells"
          >
            <Activity className="w-4 h-4 shrink-0 text-sky-400 group-hover:scale-105 transition-transform" />
            {!isSidebarCollapsed && <span className="truncate">Health & Smells</span>}
          </button>

          {/* Git History Intelligence */}
          <button
            onClick={() => onOpenModal("history")}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors cursor-pointer group"
            title="Git History & Evolution Intelligence"
          >
            <History className="w-4 h-4 shrink-0 text-purple-400 group-hover:scale-105 transition-transform" />
            {!isSidebarCollapsed && <span className="truncate">Git History</span>}
          </button>

          {/* Export Snapshots */}
          <button
            onClick={() => onOpenModal("snapshot")}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors cursor-pointer group"
            title="Export Architecture Snapshots"
          >
            <Camera className="w-4 h-4 shrink-0 text-sky-400 group-hover:scale-105 transition-transform" />
            {!isSidebarCollapsed && <span className="truncate">Snapshots & Export</span>}
          </button>
        </div>
      </div>

      {/* Sidebar Footer: Collapse Toggle */}
      <div className="p-2 border-t border-zinc-800">
        <button
          onClick={() => setIsSidebarCollapsed((prev) => !prev)}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-mono text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors cursor-pointer"
          title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isSidebarCollapsed ? (
            <PanelLeftOpen className="w-4 h-4" />
          ) : (
            <>
              <PanelLeftClose className="w-4 h-4" />
              <span>Collapse Sidebar</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
