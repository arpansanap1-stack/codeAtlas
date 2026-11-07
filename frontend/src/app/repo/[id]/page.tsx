"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { ArchitectureMap } from "@/components/ArchitectureMap";
import { OnboardingView } from "@/components/OnboardingView";
import { ChatPanel } from "@/components/ChatPanel";
import { CodeDrawer } from "@/components/CodeDrawer";
import { JourneyPlayer } from "@/components/JourneyPlayer";
import { RepoOverviewView } from "@/components/RepoOverviewView";
import { WorkspaceHeader } from "@/components/workspace/WorkspaceHeader";
import { WorkspaceSidebar } from "@/components/workspace/WorkspaceSidebar";
import { WorkspaceModals } from "@/components/workspace/WorkspaceModals";
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
        if (!isMounted) return;
        setRepo(repoRes as RepoIngestResponse);
        setGraphData(graphRes);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message || "Failed to load repository workspace");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [repoId]);

  const handleSelectCitation = (filePath: string, startLine: number, endLine: number) => {
    setSelectedFile(filePath);
    setTargetLineRange([startLine, endLine]);
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
        setIsJourneyPlayerOpen(true);
        break;
      case "debug":
        setIsDebugModalOpen(true);
        break;
      case "impact":
        setIsImpactModalOpen(true);
        break;
      case "health":
        setIsHealthModalOpen(true);
        break;
      case "history":
        setIsGitHistoryModalOpen(true);
        break;
      case "snapshot":
        setIsSnapshotModalOpen(true);
        break;
      case "gemini":
        break;
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-screen bg-zinc-950 flex flex-col items-center justify-center gap-4 text-xs font-mono">
        <div className="w-10 h-10 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-sky-400">
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
      <div className="h-screen w-screen bg-zinc-950 flex flex-col items-center justify-center gap-4 text-center px-4">
        <div className="text-rose-400 font-mono text-xs">{error || "Repository not found"}</div>
        <Link
          href="/"
          className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-300 hover:text-white transition-colors"
        >
          ← Return to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-zinc-950 text-zinc-100 font-sans">
      {/* Top Header Navigation */}
      <WorkspaceHeader
        repoName={repo.repo_name}
        showRightPanel={showRightPanel}
        onToggleRightPanel={() => setShowRightPanel((prev) => !prev)}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenSnapshot={() => setIsSnapshotModalOpen(true)}
      />

      {/* Main Workspace Stage */}
      <div className="relative flex-1 flex w-full h-full overflow-hidden">
        {/* Left Collapsible Sidebar */}
        <WorkspaceSidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isSidebarCollapsed={isSidebarCollapsed}
          setIsSidebarCollapsed={setIsSidebarCollapsed}
          onOpenModal={handleOpenModal}
        />

        {/* Center Main Stage */}
        <div className="relative flex-1 h-full w-full overflow-hidden bg-zinc-950 flex flex-col">
          {activeTab === "overview" && (
            <RepoOverviewView
              repo={repo}
              graphData={graphData}
              onNavigateTab={(tab) => {
                if (tab === "chat") {
                  setShowRightPanel(true);
                } else if (tab === "map" || tab === "docs") {
                  setActiveTab(tab as WorkspaceTab);
                }
              }}
              onOpenModal={handleOpenModal}
              onSelectFile={(filePath) => {
                setSelectedFile(filePath);
                setTargetLineRange(null);
              }}
            />
          )}

          {activeTab === "map" && (
            <ArchitectureMap
              graphData={graphData}
              onSelectFile={(filePath) => {
                setSelectedFile(filePath);
                setTargetLineRange(null);
              }}
              selectedFile={selectedFile}
              activeJourneySteps={activeJourney?.steps}
              currentJourneyStepIndex={currentJourneyStepIndex}
              impactAffectedNodeIds={impactAffectedNodes}
              impactTargetFile={impactTargetFile}
            />
          )}

          {activeTab === "docs" && (
            <OnboardingView
              repoId={repoId}
              repoName={repo.repo_name}
              onSelectCitation={handleSelectCitation}
            />
          )}

          {/* Floating Journey Tour Controller */}
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

        {/* Right Persistent Panel (AI Chat) */}
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

        {/* Monaco Editor Slide-Over Drawer */}
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

      {/* Feature Modals & Command Palette */}
      <WorkspaceModals
        repoId={repoId}
        repo={repo}
        graphData={graphData}
        selectedFile={selectedFile}
        onSelectFile={(f) => {
          setSelectedFile(f);
          setTargetLineRange(null);
        }}
        onSelectCitation={handleSelectCitation}
        isExplainModalOpen={isExplainModalOpen}
        setIsExplainModalOpen={setIsExplainModalOpen}
        isDebugModalOpen={isDebugModalOpen}
        setIsDebugModalOpen={setIsDebugModalOpen}
        isImpactModalOpen={isImpactModalOpen}
        setIsImpactModalOpen={setIsImpactModalOpen}
        impactTargetFile={impactTargetFile}
        setImpactTargetFile={setImpactTargetFile}
        onHighlightImpactOnMap={(affected, target) => {
          setActiveTab("map");
          setImpactTargetFile(target);
          setImpactAffectedNodes(affected);
          setSelectedFile(target);
        }}
        isHealthModalOpen={isHealthModalOpen}
        setIsHealthModalOpen={setIsHealthModalOpen}
        isGitHistoryModalOpen={isGitHistoryModalOpen}
        setIsGitHistoryModalOpen={setIsGitHistoryModalOpen}
        gitHistoryTargetFile={gitHistoryTargetFile}
        setGitHistoryTargetFile={setGitHistoryTargetFile}
        onAddToChatContext={(file) => {
          setSelectedChatFiles((prev) =>
            prev.includes(file) ? prev : [...prev, file]
          );
        }}
        isSnapshotModalOpen={isSnapshotModalOpen}
        setIsSnapshotModalOpen={setIsSnapshotModalOpen}
        isCommandPaletteOpen={isCommandPaletteOpen}
        setIsCommandPaletteOpen={setIsCommandPaletteOpen}
        onNavigateTab={(tab) => {
          if (tab === "chat") {
            setShowRightPanel(true);
          } else if (tab === "overview" || tab === "map" || tab === "docs") {
            setActiveTab(tab as WorkspaceTab);
          }
        }}
        onOpenModal={handleOpenModal}
      />
    </div>
  );
}
