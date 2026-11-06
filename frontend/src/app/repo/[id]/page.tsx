"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  Compass,
  ArrowLeft,
  Network,
  BookOpen,
  MessageSquare,
  PanelRightClose,
  PanelRightOpen,
  PanelLeftClose,
  PanelLeftOpen,
  Loader2,
  ExternalLink,
  Sparkles,
  Route,
  Bug,
  AlertOctagon,
  Activity,
  History,
  Camera,
  Search,
  FileCode,
  GitBranch,
  Layers,
  CheckCircle2,
} from "lucide-react";
import { ArchitectureMap } from "@/components/ArchitectureMap";
import { OnboardingView } from "@/components/OnboardingView";
import { ChatPanel } from "@/components/ChatPanel";
import { CodeDrawer } from "@/components/CodeDrawer";
import { ArchitectureExplanationModal } from "@/components/ArchitectureExplanationModal";
import { JourneyPlayer } from "@/components/JourneyPlayer";
import { DebugModal } from "@/components/DebugModal";
import { ImpactModal } from "@/components/ImpactModal";
import { HealthDashboardModal } from "@/components/HealthDashboardModal";
import { GitHistoryModal } from "@/components/GitHistoryModal";
import { ExportSnapshotModal } from "@/components/ExportSnapshotModal";
import { CommandPalette } from "@/components/CommandPalette";
import { RepoOverviewView } from "@/components/RepoOverviewView";
import GeminiKeyModal from "@/components/GeminiKeyModal";
import { getRepository, getRepositoryGraph } from "@/lib/api";
import { GraphData, JourneyResponse, RepoIngestResponse } from "@/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

type WorkspaceTab = "overview" | "map" | "docs";

export default function RepoWorkspace({ params }: PageProps) {
  const resolvedParams = use(params);
  const repoId = resolvedParams.id;

  const [activeTab, setActiveTab] = useState<WorkspaceTab>("overview");
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  const [repo, setRepo] = useState<RepoIngestResponse | null>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Inspector & Citation state
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [targetLineRange, setTargetLineRange] = useState<[number, number] | null>(null);

  // Architecture Explanation & Codebase Journey State
  const [isExplainModalOpen, setIsExplainModalOpen] = useState(false);
  const [isJourneyPlayerOpen, setIsJourneyPlayerOpen] = useState(false);
  const [activeJourney, setActiveJourney] = useState<JourneyResponse | null>(null);
  const [currentJourneyStepIndex, setCurrentJourneyStepIndex] = useState(0);

  // AI Debugger & Impact Analysis State
  const [isDebugModalOpen, setIsDebugModalOpen] = useState(false);
  const [isImpactModalOpen, setIsImpactModalOpen] = useState(false);
  const [impactTargetFile, setImpactTargetFile] = useState<string>("");
  const [impactAffectedNodes, setImpactAffectedNodes] = useState<string[] | null>(null);

  // Codebase Health & Smell Detection State
  const [isHealthModalOpen, setIsHealthModalOpen] = useState(false);

  // Git History Intelligence & Targeted Chat Context
  const [selectedChatFiles, setSelectedChatFiles] = useState<string[]>([]);
  const [isGitHistoryModalOpen, setIsGitHistoryModalOpen] = useState(false);
  const [gitHistoryTargetFile, setGitHistoryTargetFile] = useState<string>("");
  const [isSnapshotModalOpen, setIsSnapshotModalOpen] = useState(false);

  // Global Ctrl+K / Cmd+K Command Palette shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleToggleChatContext = (filePath: string) => {
    setSelectedChatFiles((prev) =>
      prev.includes(filePath) ? prev.filter((f) => f !== filePath) : [...prev, filePath]
    );
  };

  const handleOpenGitHistory = (filePath: string) => {
    setGitHistoryTargetFile(filePath);
    setIsGitHistoryModalOpen(true);
  };

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    Promise.all([getRepository(repoId), getRepositoryGraph(repoId)])
      .then(([repoRes, graphRes]) => {
        if (isMounted) {
          setRepo(repoRes);
          setGraphData(graphRes);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || "Failed to load repository workspace");
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [repoId]);

  // Cross-component citation handler
  const handleSelectCitation = (
    filePath: string,
    startLine: number,
    endLine: number
  ) => {
    setSelectedFile(filePath);
    setTargetLineRange([startLine, endLine]);
  };

  const handleSelectNode = (filePath: string) => {
    setSelectedFile(filePath);
    setTargetLineRange(null);
  };

  const handleOpenModal = (
    modal:
      | "explain"
      | "journey"
      | "debug"
      | "impact"
      | "health"
      | "history"
      | "snapshot"
      | "gemini"
  ) => {
    switch (modal) {
      case "explain":
        setIsExplainModalOpen(true);
        break;
      case "journey":
        setActiveTab("map");
        setIsJourneyPlayerOpen(true);
        break;
      case "debug":
        setIsDebugModalOpen(true);
        break;
      case "impact":
        const target = selectedFile || (graphData?.nodes[0]?.id ?? "");
        setImpactTargetFile(target);
        setIsImpactModalOpen(true);
        break;
      case "health":
        setIsHealthModalOpen(true);
        break;
      case "history":
        const file = selectedFile || (graphData?.nodes[0]?.id ?? "");
        handleOpenGitHistory(file);
        break;
      case "snapshot":
        setIsSnapshotModalOpen(true);
        break;
      default:
        break;
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-screen bg-workspace flex flex-col items-center justify-center gap-4 text-zinc-400 font-mono text-xs">
        <div className="w-12 h-12 rounded-2xl bg-panel border border-borderDefault flex items-center justify-center text-accent-indigoLight shadow-glowIndigo">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
        <div className="space-y-1 text-center">
          <p className="text-zinc-200 font-medium">Loading Developer Workspace...</p>
          <p className="text-zinc-500 text-[11px]">Connecting AST graph, pgvector indices, and citations</p>
        </div>
      </div>
    );
  }

  if (error || !repo || !graphData) {
    return (
      <div className="h-screen w-screen bg-workspace flex flex-col items-center justify-center gap-4 text-center px-4">
        <div className="text-rose-400 font-mono text-xs">{error || "Repository not found"}</div>
        <Link
          href="/"
          className="px-4 py-2 rounded-xl bg-panel border border-borderDefault text-xs font-mono text-zinc-300 hover:text-white transition-colors"
        >
          ← Return to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-workspace text-zinc-100 font-sans">
      {/* ========================================================================= */}
      {/* 5.A: TOP NAVIGATION (Linear / VS Code inspired) */}
      {/* ========================================================================= */}
      <header className="h-13 border-b border-borderSubtle bg-panel/90 backdrop-blur-xl px-4 flex items-center justify-between gap-4 z-20 shrink-0">
        {/* Left: Brand, Back, Repo Breadcrumb & Branch */}
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-surfaceHover transition-colors cursor-pointer"
            title="Return to Home"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div className="flex items-center gap-2 truncate">
            <div className="w-6 h-6 rounded-lg bg-surface border border-borderSubtle flex items-center justify-center text-accent-indigoLight shrink-0">
              <Compass className="w-3.5 h-3.5" />
            </div>

            <div className="flex items-center gap-1.5 text-xs font-mono min-w-0">
              <span className="font-semibold text-zinc-100 truncate">
                {repo.repo_name}
              </span>
              <span className="text-zinc-600">/</span>
              <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-surface border border-borderSubtle text-zinc-400">
                <GitBranch className="w-2.5 h-2.5 text-accent-emerald" />
                <span>main</span>
              </span>
            </div>
          </div>
        </div>

        {/* Center: Command Palette Trigger (Raycast style) */}
        <div className="flex-1 max-w-md hidden md:flex items-center justify-center">
          <button
            onClick={() => setIsCommandPaletteOpen(true)}
            className="w-full h-8 px-3 rounded-lg bg-surface hover:bg-surfaceHover border border-borderSubtle text-xs text-zinc-400 hover:text-zinc-200 flex items-center justify-between gap-2 transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-2 text-zinc-400 group-hover:text-zinc-200">
              <Search className="w-3.5 h-3.5" />
              <span className="font-sans text-[11px]">Search commands, features, files...</span>
            </div>
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-zinc-500 bg-surfaceElevated border border-borderSubtle rounded">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Right: Feature Triggers, Gemini Status & Chat Drawer Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Quick Snapshot Trigger */}
          <button
            onClick={() => setIsSnapshotModalOpen(true)}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface hover:bg-surfaceHover border border-borderSubtle text-xs font-mono text-zinc-300 hover:text-white transition-colors cursor-pointer"
            title="Export architecture snapshot diagram or markdown report"
          >
            <Camera className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden lg:inline text-[11px]">Snapshot</span>
          </button>

          {/* Gemini AI Status Badge */}
          <GeminiKeyModal />

          {/* Right Panel Toggle (Chat) */}
          <button
            onClick={() => setShowRightPanel((prev) => !prev)}
            className={`p-1.5 rounded-lg border text-xs transition-colors flex items-center gap-1.5 cursor-pointer ${
              showRightPanel
                ? "bg-accent-indigo/15 border-accent-indigo/35 text-accent-indigoLight shadow-sm"
                : "bg-surface border-borderSubtle text-zinc-400 hover:text-white hover:bg-surfaceHover"
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

      {/* ========================================================================= */}
      {/* MAIN WORKSPACE BODY: LEFT SIDEBAR + ADAPTIVE STAGE + RIGHT PANEL */}
      {/* ========================================================================= */}
      <div className="relative flex-1 flex w-full h-full overflow-hidden">
        {/* ========================================================================= */}
        {/* 5.B: COLLAPSIBLE LEFT SIDEBAR */}
        {/* ========================================================================= */}
        <aside
          className={`h-full border-r border-borderSubtle bg-panel flex flex-col justify-between transition-all duration-300 select-none shrink-0 z-10 ${
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
                    ? "bg-accent-indigo/15 text-white font-semibold"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-surfaceHover"
                }`}
                title="Repository Overview"
              >
                <Compass
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    activeTab === "overview"
                      ? "text-accent-indigoLight"
                      : "text-zinc-400 group-hover:text-zinc-200"
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

              {/* Architecture Explorer */}
              <button
                onClick={() => setActiveTab("map")}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer group ${
                  activeTab === "map"
                    ? "bg-accent-indigo/15 text-white font-semibold"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-surfaceHover"
                }`}
                title="Architecture Explorer"
              >
                <Network
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    activeTab === "map"
                      ? "text-accent-indigoLight"
                      : "text-zinc-400 group-hover:text-zinc-200"
                  }`}
                />
                {!isSidebarCollapsed && <span className="truncate">Architecture Map</span>}
              </button>

              {/* Code Explorer (Monaco) */}
              <button
                onClick={() => {
                  const target = selectedFile || (graphData.nodes[0]?.id ?? null);
                  setSelectedFile(target);
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-surfaceHover transition-colors cursor-pointer group"
                title="Inspect source code in Monaco Editor"
              >
                <FileCode className="w-4 h-4 shrink-0 text-zinc-400 group-hover:text-zinc-200" />
                {!isSidebarCollapsed && <span className="truncate">Code Inspector</span>}
              </button>

              {/* Code Journeys */}
              <button
                onClick={() => {
                  setActiveTab("map");
                  setIsJourneyPlayerOpen(true);
                }}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer group ${
                  activeJourney
                    ? "bg-emerald-500/15 text-emerald-300 font-semibold"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-surfaceHover"
                }`}
                title="Code Journeys (Execution Path Tracer)"
              >
                <Route className="w-4 h-4 shrink-0 text-emerald-400 group-hover:scale-110 transition-transform" />
                {!isSidebarCollapsed && (
                  <span className="truncate">
                    {activeJourney ? "Active Journey" : "Code Journeys"}
                  </span>
                )}
              </button>
            </div>

            {/* Group 3: INTELLIGENCE */}
            <div className="space-y-1">
              {!isSidebarCollapsed && (
                <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-semibold">
                  Intelligence
                </div>
              )}

              {/* AI Chat Drawer Trigger */}
              <button
                onClick={() => setShowRightPanel(true)}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-surfaceHover transition-colors cursor-pointer group"
                title="Open AI RAG Chat Assistant"
              >
                <MessageSquare className="w-4 h-4 shrink-0 text-accent-sky" />
                {!isSidebarCollapsed && <span className="truncate">AI Assistant</span>}
              </button>

              {/* Impact Analysis */}
              <button
                onClick={() => {
                  const fileToTest = selectedFile || (graphData.nodes[0]?.id ?? "");
                  setImpactTargetFile(fileToTest);
                  setIsImpactModalOpen(true);
                }}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer group ${
                  impactAffectedNodes
                    ? "bg-amber-500/15 text-amber-300 font-semibold"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-surfaceHover"
                }`}
                title="Impact Analysis (What Happens If I Change This?)"
              >
                <AlertOctagon className="w-4 h-4 shrink-0 text-amber-400" />
                {!isSidebarCollapsed && (
                  <span className="truncate">
                    {impactAffectedNodes
                      ? `Blast Radius: ${impactAffectedNodes.length}`
                      : "Impact Analysis"}
                  </span>
                )}
              </button>

              {/* Codebase Health & Smells */}
              <button
                onClick={() => setIsHealthModalOpen(true)}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-surfaceHover transition-colors cursor-pointer group"
                title="Codebase Health & Architecture Smells"
              >
                <Activity className="w-4 h-4 shrink-0 text-emerald-400" />
                {!isSidebarCollapsed && <span className="truncate">Health & Smells</span>}
              </button>

              {/* AI Debugger */}
              <button
                onClick={() => setIsDebugModalOpen(true)}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-surfaceHover transition-colors cursor-pointer group"
                title="AI Error Explorer & Stack Trace Diagnosis"
              >
                <Bug className="w-4 h-4 shrink-0 text-rose-400" />
                {!isSidebarCollapsed && <span className="truncate">AI Debugger</span>}
              </button>

              {/* Git History Intelligence */}
              <button
                onClick={() => {
                  const fileToInspect = selectedFile || (graphData.nodes[0]?.id ?? "");
                  handleOpenGitHistory(fileToInspect);
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-surfaceHover transition-colors cursor-pointer group"
                title="Git History Authorship & Evolution Intelligence"
              >
                <History className="w-4 h-4 shrink-0 text-accent-sky" />
                {!isSidebarCollapsed && <span className="truncate">Git Evolution</span>}
              </button>

              {/* Multi-Level Architecture Explanation */}
              <button
                onClick={() => setIsExplainModalOpen(true)}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-surfaceHover transition-colors cursor-pointer group"
                title="Explain architecture (Beginner, Intermediate, Expert)"
              >
                <Sparkles className="w-4 h-4 shrink-0 text-accent-indigoLight" />
                {!isSidebarCollapsed && <span className="truncate">Explain Architecture</span>}
              </button>
            </div>

            {/* Group 4: DOCUMENTATION */}
            <div className="space-y-1">
              {!isSidebarCollapsed && (
                <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-semibold">
                  Documentation
                </div>
              )}

              <button
                onClick={() => setActiveTab("docs")}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer group ${
                  activeTab === "docs"
                    ? "bg-accent-indigo/15 text-white font-semibold"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-surfaceHover"
                }`}
                title="Onboarding Documentation"
              >
                <BookOpen
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    activeTab === "docs"
                      ? "text-accent-indigoLight"
                      : "text-zinc-400 group-hover:text-zinc-200"
                  }`}
                />
                {!isSidebarCollapsed && <span className="truncate">Onboarding Guide</span>}
              </button>
            </div>
          </div>

          {/* Sidebar Footer: Collapse Toggle & Repo Statistics */}
          <div className="p-2 border-t border-borderSubtle bg-panel/60">
            {!isSidebarCollapsed && (
              <div className="px-2.5 py-1.5 mb-1.5 rounded-lg bg-surface/80 border border-borderSubtle text-[10px] font-mono text-zinc-400 space-y-0.5">
                <div className="flex items-center justify-between">
                  <span>Modules</span>
                  <span className="text-zinc-200 font-semibold">{repo.file_count}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Edges</span>
                  <span className="text-zinc-200 font-semibold">{graphData.edges.length}</span>
                </div>
              </div>
            )}

            <button
              onClick={() => setIsSidebarCollapsed((prev) => !prev)}
              className="w-full flex items-center justify-center p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-surfaceHover transition-colors cursor-pointer"
              title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {isSidebarCollapsed ? (
                <PanelLeftOpen className="w-4 h-4" />
              ) : (
                <div className="flex items-center gap-2 text-xs">
                  <PanelLeftClose className="w-4 h-4" />
                  <span>Collapse</span>
                </div>
              )}
            </button>
          </div>
        </aside>

        {/* ========================================================================= */}
        {/* 5.C: MAIN ADAPTIVE WORKSPACE STAGE */}
        {/* ========================================================================= */}
        <div className="flex-1 h-full relative overflow-hidden bg-workspace">
          {activeTab === "overview" ? (
            <RepoOverviewView
              repo={repo}
              graphData={graphData}
              onNavigateTab={(tab) => {
                if (tab === "chat") {
                  setShowRightPanel(true);
                } else if (tab === "map" || tab === "docs" || tab === "overview") {
                  setActiveTab(tab);
                }
              }}
              onOpenModal={handleOpenModal}
              onSelectFile={(f) => {
                setSelectedFile(f);
                setTargetLineRange(null);
              }}
            />
          ) : activeTab === "map" ? (
            <ArchitectureMap
              graphData={graphData}
              onSelectFile={handleSelectNode}
              selectedFile={selectedFile}
              activeJourneySteps={activeJourney?.steps}
              currentJourneyStepIndex={currentJourneyStepIndex}
              impactAffectedNodeIds={impactAffectedNodes}
              impactTargetFile={impactTargetFile}
            />
          ) : (
            <OnboardingView
              repoId={repoId}
              repoName={repo.repo_name}
              onSelectCitation={handleSelectCitation}
            />
          )}

          {/* Interactive Code Journey Player / Floating Dock */}
          <JourneyPlayer
            repoId={repoId}
            repoName={repo.repo_name}
            isOpen={isJourneyPlayerOpen}
            onClose={() => setIsJourneyPlayerOpen(false)}
            activeJourney={activeJourney}
            setActiveJourney={setActiveJourney}
            currentStepIndex={currentJourneyStepIndex}
            setCurrentStepIndex={setCurrentJourneyStepIndex}
            onSelectStepCitation={handleSelectCitation}
          />
        </div>

        {/* ========================================================================= */}
        {/* 5.D: RIGHT PERSISTENT PANEL (AI CHAT) */}
        {/* ========================================================================= */}
        {showRightPanel && (
          <div className="w-[380px] md:w-[420px] lg:w-[460px] h-full shrink-0 z-10 transition-all duration-300">
            <ChatPanel
              repoId={repoId}
              repoName={repo.repo_name}
              onSelectCitation={handleSelectCitation}
              selectedFiles={selectedChatFiles}
              onRemoveSelectedFile={(f) =>
                setSelectedChatFiles((prev) => prev.filter((p) => p !== f))
              }
              onClearSelectedFiles={() => setSelectedChatFiles([])}
              availableFiles={graphData.nodes.map((n) => n.id)}
              onAddSelectedFile={(f) =>
                setSelectedChatFiles((prev) =>
                  prev.includes(f) ? prev : [...prev, f]
                )
              }
            />
          </div>
        )}

        {/* ========================================================================= */}
        {/* 5.E: CONTEXTUAL INSPECTOR (MONACO EDITOR CODE DRAWER) */}
        {/* ========================================================================= */}
        {selectedFile && (
          <CodeDrawer
            repoId={repoId}
            filePath={selectedFile}
            graphData={graphData}
            onClose={() => {
              setSelectedFile(null);
              setTargetLineRange(null);
            }}
            onNavigateFile={(path) => {
              setSelectedFile(path);
              setTargetLineRange(null);
            }}
            targetLineRange={targetLineRange}
            onOpenImpactAnalysis={(file) => {
              setImpactTargetFile(file);
              setIsImpactModalOpen(true);
            }}
            onOpenGitHistory={handleOpenGitHistory}
            onToggleChatContext={handleToggleChatContext}
            isInChatContext={
              selectedFile ? selectedChatFiles.includes(selectedFile) : false
            }
          />
        )}
      </div>

      {/* ========================================================================= */}
      {/* GLOBAL COMMAND PALETTE (Ctrl+K / Cmd+K) */}
      {/* ========================================================================= */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigateTab={(tab) => {
          if (tab === "chat") {
            setShowRightPanel(true);
          } else if (tab === "overview" || tab === "map" || tab === "docs") {
            setActiveTab(tab as WorkspaceTab);
          }
        }}
        nodes={graphData.nodes}
        onSelectFile={(f) => {
          setSelectedFile(f);
          setTargetLineRange(null);
        }}
        onOpenModal={handleOpenModal}
      />

      {/* ========================================================================= */}
      {/* FEATURE MODALS & WORKBENCHES */}
      {/* ========================================================================= */}
      {/* 1. Multi-Level Architecture Explanation Modal */}
      <ArchitectureExplanationModal
        isOpen={isExplainModalOpen}
        onClose={() => setIsExplainModalOpen(false)}
        repoId={repoId}
        repoName={repo.repo_name}
        onSelectCitation={handleSelectCitation}
      />

      {/* 2. AI Debugger & Stack Trace Explorer Modal */}
      <DebugModal
        isOpen={isDebugModalOpen}
        onClose={() => setIsDebugModalOpen(false)}
        repoId={repoId}
        repoName={repo.repo_name}
        onSelectCitation={handleSelectCitation}
      />

      {/* 3. Dependency Impact Analysis Modal */}
      <ImpactModal
        isOpen={isImpactModalOpen}
        onClose={() => setIsImpactModalOpen(false)}
        repoId={repoId}
        repoName={repo.repo_name}
        targetFile={
          impactTargetFile || selectedFile || (graphData.nodes[0]?.id ?? "")
        }
        availableFiles={graphData.nodes.map((n) => n.id)}
        onChangeTargetFile={(file) => setImpactTargetFile(file)}
        onHighlightOnMap={(affected, target) => {
          setActiveTab("map");
          setImpactTargetFile(target);
          setImpactAffectedNodes(affected);
          setSelectedFile(target);
        }}
        onSelectCitation={handleSelectCitation}
      />

      {/* 4. Codebase Health & Smell Detection Modal */}
      <HealthDashboardModal
        isOpen={isHealthModalOpen}
        onClose={() => setIsHealthModalOpen(false)}
        repoId={repoId}
        repoName={repo.repo_name}
        onHighlightOnMap={(affected, target) => {
          setActiveTab("map");
          setImpactTargetFile(target);
          setImpactAffectedNodes(affected);
          setSelectedFile(target);
        }}
        onSelectFile={(filePath) => {
          setSelectedFile(filePath);
          setTargetLineRange(null);
        }}
      />

      {/* 5. Git History Intelligence Modal */}
      <GitHistoryModal
        isOpen={isGitHistoryModalOpen}
        onClose={() => setIsGitHistoryModalOpen(false)}
        repoId={repoId}
        repoName={repo.repo_name}
        targetFile={
          gitHistoryTargetFile || selectedFile || (graphData.nodes[0]?.id ?? "")
        }
        availableFiles={graphData.nodes.map((n) => n.id)}
        onChangeTargetFile={(file) => setGitHistoryTargetFile(file)}
        onSelectFile={(filePath) => {
          setSelectedFile(filePath);
          setTargetLineRange(null);
        }}
        onAddToChatContext={(file) => {
          setSelectedChatFiles((prev) =>
            prev.includes(file) ? prev : [...prev, file]
          );
        }}
      />

      {/* 6. Architecture Snapshots & Vector Export Modal */}
      <ExportSnapshotModal
        isOpen={isSnapshotModalOpen}
        onClose={() => setIsSnapshotModalOpen(false)}
        repoName={repo.repo_name}
        repoId={repoId}
        graphData={graphData}
        selectedFile={selectedFile}
      />
    </div>
  );
}
