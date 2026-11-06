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
  Loader2,
  ExternalLink,
  Sparkles,
  Route,
  Bug,
  AlertOctagon,
} from "lucide-react";
import { ArchitectureMap } from "@/components/ArchitectureMap";
import { OnboardingView } from "@/components/OnboardingView";
import { ChatPanel } from "@/components/ChatPanel";
import { CodeDrawer } from "@/components/CodeDrawer";
import { ArchitectureExplanationModal } from "@/components/ArchitectureExplanationModal";
import { JourneyPlayer } from "@/components/JourneyPlayer";
import { DebugModal } from "@/components/DebugModal";
import { ImpactModal } from "@/components/ImpactModal";
import GeminiKeyModal from "@/components/GeminiKeyModal";
import { getRepository, getRepositoryGraph } from "@/lib/api";
import { GraphData, JourneyResponse, RepoIngestResponse } from "@/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function RepoWorkspace({ params }: PageProps) {
  const resolvedParams = use(params);
  const repoId = resolvedParams.id;

  const [activeTab, setActiveTab] = useState<"map" | "docs">("map");
  const [showRightPanel, setShowRightPanel] = useState(true);

  const [repo, setRepo] = useState<RepoIngestResponse | null>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Inspector & Citation state
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [targetLineRange, setTargetLineRange] = useState<[number, number] | null>(null);

  // New Features: Architecture Explanation & Codebase Journey State
  const [isExplainModalOpen, setIsExplainModalOpen] = useState(false);
  const [isJourneyPlayerOpen, setIsJourneyPlayerOpen] = useState(false);
  const [activeJourney, setActiveJourney] = useState<JourneyResponse | null>(null);
  const [currentJourneyStepIndex, setCurrentJourneyStepIndex] = useState(0);

  // New Features: AI Debugger & Impact Analysis State
  const [isDebugModalOpen, setIsDebugModalOpen] = useState(false);
  const [isImpactModalOpen, setIsImpactModalOpen] = useState(false);
  const [impactTargetFile, setImpactTargetFile] = useState<string>("");
  const [impactAffectedNodes, setImpactAffectedNodes] = useState<string[] | null>(null);

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

  if (loading) {
    return (
      <div className="h-screen w-screen bg-zinc-950 flex flex-col items-center justify-center gap-3 text-zinc-400 font-mono text-xs">
        <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
        <span>Loading repository workspace...</span>
      </div>
    );
  }

  if (error || !repo || !graphData) {
    return (
      <div className="h-screen w-screen bg-zinc-950 flex flex-col items-center justify-center gap-4 text-center px-4">
        <div className="text-rose-400 font-mono text-xs">{error || "Repository not found"}</div>
        <Link
          href="/"
          className="px-3 py-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-300 hover:text-white"
        >
          ← Return to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-zinc-950 text-zinc-100">
      {/* Workspace Header */}
      <header className="h-12 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md px-4 flex items-center justify-between gap-4 z-20 shrink-0">
        {/* Left: Back & Repo Title */}
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/"
            className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
            title="Back to Home"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div className="flex items-center gap-2 truncate">
            <div className="w-6 h-6 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center text-sky-400 shrink-0">
              <Compass className="w-3.5 h-3.5" />
            </div>
            <span className="font-semibold text-xs tracking-tight text-zinc-100 truncate">
              {repo.repo_name}
            </span>
          </div>
        </div>

        {/* Center: Stage Switcher Tabs & Feature Triggers */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-zinc-900/90 p-1 rounded-lg border border-zinc-800 text-xs font-mono">
            <button
              onClick={() => setActiveTab("map")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all ${
                activeTab === "map"
                  ? "bg-zinc-800 text-sky-400 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Network className="w-3.5 h-3.5" />
              <span>Architecture Map</span>
            </button>

            <button
              onClick={() => setActiveTab("docs")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all ${
                activeTab === "docs"
                  ? "bg-zinc-800 text-sky-400 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Onboarding Guide</span>
            </button>
          </div>

          {/* AI Architecture Explanation Button */}
          <button
            onClick={() => setIsExplainModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900/90 hover:bg-zinc-850 border border-zinc-800 text-xs font-mono text-zinc-300 hover:text-white transition-all shadow-sm group"
            title="Explain this architecture to me (Beginner / Intermediate / Expert)"
          >
            <Sparkles className="w-3.5 h-3.5 text-sky-400 group-hover:scale-110 transition-transform" />
            <span className="hidden sm:inline">Explain Architecture</span>
          </button>

          {/* Interactive Codebase Journeys Button */}
          <button
            onClick={() => {
              setActiveTab("map");
              setIsJourneyPlayerOpen(true);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all shadow-sm group ${
              activeJourney
                ? "bg-sky-500/15 border-sky-500/40 text-sky-400 font-semibold"
                : "bg-zinc-900/90 hover:bg-zinc-850 border-zinc-800 text-zinc-300 hover:text-white"
            }`}
            title="Journey through the codebase (Step-by-step interactive flows)"
          >
            <Route className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
            <span className="hidden sm:inline">
              {activeJourney ? "Active Journey" : "Code Journeys"}
            </span>
          </button>

          {/* AI Debugger Button */}
          <button
            onClick={() => setIsDebugModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900/90 hover:bg-zinc-850 border border-zinc-800 text-xs font-mono text-zinc-300 hover:text-white transition-all shadow-sm group"
            title="Paste an error or stack trace to diagnose root cause and get fixes"
          >
            <Bug className="w-3.5 h-3.5 text-rose-400 group-hover:scale-110 transition-transform" />
            <span className="hidden sm:inline">AI Debugger</span>
          </button>

          {/* Impact Analysis Button */}
          <button
            onClick={() => {
              const fileToTest = selectedFile || (graphData.nodes[0]?.id ?? "");
              setImpactTargetFile(fileToTest);
              setIsImpactModalOpen(true);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all shadow-sm group ${
              impactAffectedNodes
                ? "bg-amber-500/15 border-amber-500/40 text-amber-400 font-semibold"
                : "bg-zinc-900/90 hover:bg-zinc-850 border-zinc-800 text-zinc-300 hover:text-white"
            }`}
            title="What happens if I change this? (Blast radius & downstream callers)"
          >
            <AlertOctagon className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
            <span className="hidden sm:inline">
              {impactAffectedNodes ? `Blast Radius: ${impactAffectedNodes.length}` : "Impact Analysis"}
            </span>
          </button>

          {/* Clear Blast Radius Filter if active */}
          {impactAffectedNodes && (
            <button
              onClick={() => {
                setImpactAffectedNodes(null);
                setImpactTargetFile("");
              }}
              className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] font-mono text-zinc-300 transition-colors"
              title="Reset blast radius filter"
            >
              Clear Filter
            </button>
          )}
        </div>

        {/* Right: Toggle Chat Panel & Gemini Status */}
        <div className="flex items-center gap-2">
          <GeminiKeyModal />
          <button
            onClick={() => setShowRightPanel((prev) => !prev)}
            className={`p-1.5 rounded-md border text-xs transition-colors flex items-center gap-1.5 ${
              showRightPanel
                ? "bg-zinc-800 border-zinc-700 text-sky-400"
                : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white"
            }`}
            title={showRightPanel ? "Collapse Chat Panel" : "Expand Chat Panel"}
          >
            {showRightPanel ? (
              <PanelRightClose className="w-4 h-4" />
            ) : (
              <PanelRightOpen className="w-4 h-4" />
            )}
          </button>
        </div>
      </header>

      {/* Main Split-Pane Workspace */}
      <div className="relative flex-1 flex w-full h-full overflow-hidden">
        {/* Left / Center Main Stage */}
        <div className="flex-1 h-full relative overflow-hidden">
          {activeTab === "map" ? (
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

          {/* Interactive Code Journey Player / Dock */}
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

        {/* Right Persistent Panel (Chat) */}
        {showRightPanel && (
          <div className="w-[380px] md:w-[420px] lg:w-[460px] h-full shrink-0 z-10 transition-all duration-300">
            <ChatPanel
              repoId={repoId}
              repoName={repo.repo_name}
              onSelectCitation={handleSelectCitation}
            />
          </div>
        )}

        {/* Slide-over Code Inspector Drawer */}
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
          />
        )}
      </div>

      {/* AI Architecture Explanation Modal */}
      <ArchitectureExplanationModal
        isOpen={isExplainModalOpen}
        onClose={() => setIsExplainModalOpen(false)}
        repoId={repoId}
        repoName={repo.repo_name}
        onSelectCitation={handleSelectCitation}
      />

      {/* AI Debugger & Error Explorer Modal */}
      <DebugModal
        isOpen={isDebugModalOpen}
        onClose={() => setIsDebugModalOpen(false)}
        repoId={repoId}
        repoName={repo.repo_name}
        onSelectCitation={handleSelectCitation}
      />

      {/* "What Happens If I Change This?" Impact Analysis Modal */}
      <ImpactModal
        isOpen={isImpactModalOpen}
        onClose={() => setIsImpactModalOpen(false)}
        repoId={repoId}
        repoName={repo.repo_name}
        targetFile={impactTargetFile || selectedFile || (graphData.nodes[0]?.id ?? "")}
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
    </div>
  );
}

