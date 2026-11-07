"use client";

import React from "react";
import { GraphData, RepoIngestResponse } from "@/types";
import { ArchitectureExplanationModal } from "@/components/ArchitectureExplanationModal";
import { DebugModal } from "@/components/DebugModal";
import { ImpactModal } from "@/components/ImpactModal";
import { HealthDashboardModal } from "@/components/HealthDashboardModal";
import { GitHistoryModal } from "@/components/GitHistoryModal";
import { ExportSnapshotModal } from "@/components/ExportSnapshotModal";
import { CommandPalette } from "@/components/CommandPalette";

interface WorkspaceModalsProps {
  repoId: string;
  repo: RepoIngestResponse;
  graphData: GraphData;
  selectedFile: string | null;
  onSelectFile: (file: string | null) => void;
  onSelectCitation: (file: string, start: number, end: number) => void;
  // Modal visibility states
  isExplainModalOpen: boolean;
  setIsExplainModalOpen: (open: boolean) => void;
  isDebugModalOpen: boolean;
  setIsDebugModalOpen: (open: boolean) => void;
  isImpactModalOpen: boolean;
  setIsImpactModalOpen: (open: boolean) => void;
  impactTargetFile: string;
  setImpactTargetFile: (file: string) => void;
  onHighlightImpactOnMap: (affected: string[], target: string) => void;
  isHealthModalOpen: boolean;
  setIsHealthModalOpen: (open: boolean) => void;
  isGitHistoryModalOpen: boolean;
  setIsGitHistoryModalOpen: (open: boolean) => void;
  gitHistoryTargetFile: string;
  setGitHistoryTargetFile: (file: string) => void;
  onAddToChatContext: (file: string) => void;
  isSnapshotModalOpen: boolean;
  setIsSnapshotModalOpen: (open: boolean) => void;
  isCommandPaletteOpen: boolean;
  setIsCommandPaletteOpen: (open: boolean) => void;
  onNavigateTab: (tab: "overview" | "map" | "docs" | "chat") => void;
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

export function WorkspaceModals({
  repoId,
  repo,
  graphData,
  selectedFile,
  onSelectFile,
  onSelectCitation,
  isExplainModalOpen,
  setIsExplainModalOpen,
  isDebugModalOpen,
  setIsDebugModalOpen,
  isImpactModalOpen,
  setIsImpactModalOpen,
  impactTargetFile,
  setImpactTargetFile,
  onHighlightImpactOnMap,
  isHealthModalOpen,
  setIsHealthModalOpen,
  isGitHistoryModalOpen,
  setIsGitHistoryModalOpen,
  gitHistoryTargetFile,
  setGitHistoryTargetFile,
  onAddToChatContext,
  isSnapshotModalOpen,
  setIsSnapshotModalOpen,
  isCommandPaletteOpen,
  setIsCommandPaletteOpen,
  onNavigateTab,
  onOpenModal,
}: WorkspaceModalsProps) {
  return (
    <>
      {/* Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigateTab={(tab: string) => onNavigateTab(tab as any)}
        nodes={graphData.nodes}
        onSelectFile={(f) => onSelectFile(f)}
        onOpenModal={onOpenModal}
      />

      {/* Architecture Explanation */}
      <ArchitectureExplanationModal
        isOpen={isExplainModalOpen}
        onClose={() => setIsExplainModalOpen(false)}
        repoId={repoId}
        repoName={repo.repo_name}
        onSelectCitation={onSelectCitation}
      />

      {/* AI Debugger */}
      <DebugModal
        isOpen={isDebugModalOpen}
        onClose={() => setIsDebugModalOpen(false)}
        repoId={repoId}
        repoName={repo.repo_name}
        onSelectCitation={onSelectCitation}
      />

      {/* Impact Analysis */}
      <ImpactModal
        isOpen={isImpactModalOpen}
        onClose={() => setIsImpactModalOpen(false)}
        repoId={repoId}
        repoName={repo.repo_name}
        targetFile={impactTargetFile || selectedFile || (graphData.nodes[0]?.id ?? "")}
        availableFiles={graphData.nodes.map((n) => n.id)}
        onChangeTargetFile={setImpactTargetFile}
        onHighlightOnMap={onHighlightImpactOnMap}
        onSelectCitation={onSelectCitation}
      />

      {/* Codebase Health & Smell Detection */}
      <HealthDashboardModal
        isOpen={isHealthModalOpen}
        onClose={() => setIsHealthModalOpen(false)}
        repoId={repoId}
        repoName={repo.repo_name}
        onHighlightOnMap={onHighlightImpactOnMap}
        onSelectFile={onSelectFile}
      />

      {/* Git History Intelligence */}
      <GitHistoryModal
        isOpen={isGitHistoryModalOpen}
        onClose={() => setIsGitHistoryModalOpen(false)}
        repoId={repoId}
        repoName={repo.repo_name}
        targetFile={gitHistoryTargetFile || selectedFile || (graphData.nodes[0]?.id ?? "")}
        availableFiles={graphData.nodes.map((n) => n.id)}
        onChangeTargetFile={setGitHistoryTargetFile}
        onSelectFile={onSelectFile}
        onAddToChatContext={onAddToChatContext}
      />

      {/* Architecture Snapshots */}
      <ExportSnapshotModal
        isOpen={isSnapshotModalOpen}
        onClose={() => setIsSnapshotModalOpen(false)}
        repoName={repo.repo_name}
        repoId={repoId}
        graphData={graphData}
        selectedFile={selectedFile}
      />
    </>
  );
}
