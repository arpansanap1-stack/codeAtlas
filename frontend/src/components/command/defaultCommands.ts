import React from "react";
import {
  Compass,
  Network,
  BookOpen,
  MessageSquare,
  Route,
  Bug,
  AlertOctagon,
  Activity,
  History,
  Camera,
  FileCode,
  Key,
  Sparkles,
} from "lucide-react";
import { GraphNode } from "@/types";

export interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  category: "Navigation" | "Intelligence" | "Files" | "Actions";
  icon: React.ComponentType<{ className?: string }>;
  onSelect: () => void;
  badge?: string;
}

export type ModalType =
  | "explain"
  | "journey"
  | "debug"
  | "impact"
  | "health"
  | "history"
  | "snapshot"
  | "gemini";

interface BuildCommandsOptions {
  nodes?: GraphNode[];
  onNavigateTab: (tab: string) => void;
  onOpenModal: (modal: ModalType) => void;
  onSelectFile?: (filePath: string) => void;
}

export function buildCommandList({
  nodes = [],
  onNavigateTab,
  onOpenModal,
  onSelectFile,
}: BuildCommandsOptions): CommandItem[] {
  const list: CommandItem[] = [
    // Navigation
    {
      id: "nav-overview",
      title: "Repository Overview",
      subtitle: "Architecture complexity, language breakdown, and statistics",
      category: "Navigation",
      icon: Compass,
      onSelect: () => onNavigateTab("overview"),
    },
    {
      id: "nav-map",
      title: "Architecture Explorer",
      subtitle: "Interactive AST dependency graph canvas",
      category: "Navigation",
      icon: Network,
      onSelect: () => onNavigateTab("map"),
    },
    {
      id: "nav-docs",
      title: "Onboarding Documentation",
      subtitle: "Synthesized architecture guide with live Mermaid diagrams",
      category: "Navigation",
      icon: BookOpen,
      onSelect: () => onNavigateTab("docs"),
    },
    // Intelligence Features
    {
      id: "intel-chat",
      title: "AI Chat Assistant",
      subtitle: "Ask questions with streaming RAG and line citations",
      category: "Intelligence",
      icon: MessageSquare,
      onSelect: () => onNavigateTab("chat"),
    },
    {
      id: "intel-journey",
      title: "Code Journeys",
      subtitle: "Trace step-by-step execution flows through the codebase",
      category: "Intelligence",
      icon: Route,
      onSelect: () => onOpenModal("journey"),
    },
    {
      id: "intel-debug",
      title: "AI Debugger / Error Explorer",
      subtitle: "Diagnose stack traces and runtime errors with fix diffs",
      category: "Intelligence",
      icon: Bug,
      onSelect: () => onOpenModal("debug"),
    },
    {
      id: "intel-impact",
      title: "Impact Analysis",
      subtitle: "Blast radius analysis for file and dependency changes",
      category: "Intelligence",
      icon: AlertOctagon,
      onSelect: () => onOpenModal("impact"),
    },
    {
      id: "intel-health",
      title: "Codebase Health & Smells",
      subtitle: "Circular dependencies, god files, and architecture smells",
      category: "Intelligence",
      icon: Activity,
      onSelect: () => onOpenModal("health"),
    },
    {
      id: "intel-history",
      title: "Git History Intelligence",
      subtitle: "Commit churn, top authors, and temporal co-change",
      category: "Intelligence",
      icon: History,
      onSelect: () => onOpenModal("history"),
    },
    {
      id: "intel-explain",
      title: "Explain Architecture",
      subtitle: "Beginner, intermediate, and expert architectural explanation",
      category: "Intelligence",
      icon: Sparkles,
      onSelect: () => onOpenModal("explain"),
    },
    // Actions
    {
      id: "act-snapshot",
      title: "Export Architecture Snapshot",
      subtitle: "Save SVG/PNG diagram or download Mermaid markdown",
      category: "Actions",
      icon: Camera,
      onSelect: () => onOpenModal("snapshot"),
    },
    {
      id: "act-gemini",
      title: "Gemini API Settings",
      subtitle: "Configure API key, model selections, and status",
      category: "Actions",
      icon: Key,
      onSelect: () => onOpenModal("gemini"),
    },
  ];

  // Add searchable files if present
  if (nodes && nodes.length > 0) {
    nodes.slice(0, 80).forEach((node) => {
      list.push({
        id: `file-${node.id}`,
        title: node.label,
        subtitle: node.id,
        category: "Files",
        icon: FileCode,
        badge: `${node.in_degree + node.out_degree} deps`,
        onSelect: () => {
          if (onSelectFile) onSelectFile(node.id);
        },
      });
    });
  }

  return list;
}
