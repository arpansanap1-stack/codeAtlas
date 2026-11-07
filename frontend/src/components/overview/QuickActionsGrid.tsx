import React from "react";
import {
  Sparkles,
  Route,
  Bug,
  AlertOctagon,
  Activity,
  History,
  Camera,
  ArrowRight,
} from "lucide-react";

interface QuickActionsGridProps {
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

export function QuickActionsGrid({ onOpenModal }: QuickActionsGridProps) {
  const actions = [
    {
      id: "explain" as const,
      title: "Architecture Explanation",
      desc: "Beginner, intermediate, or expert architectural breakdowns with code citations.",
      icon: <Sparkles className="w-5 h-5 text-indigo-400" />,
      badge: "Beginner · Expert",
    },
    {
      id: "journey" as const,
      title: "Interactive Journeys",
      desc: "Trace end-to-end execution paths through routes, services, and state.",
      icon: <Route className="w-5 h-5 text-emerald-400" />,
      badge: "Step-by-Step",
    },
    {
      id: "debug" as const,
      title: "AI Debugger & Error Explorer",
      desc: "Paste stack traces or runtime exceptions for root cause analysis & code diffs.",
      icon: <Bug className="w-5 h-5 text-rose-400" />,
      badge: "Root Cause",
    },
    {
      id: "impact" as const,
      title: "Impact Analysis (Blast Radius)",
      desc: "Discover what breaks downstream if you modify or refactor any module.",
      icon: <AlertOctagon className="w-5 h-5 text-amber-400" />,
      badge: "Transitive Graph",
    },
    {
      id: "health" as const,
      title: "Codebase Health & Smells",
      desc: "Algorithmic 0-100 health score, circular loops, god files, and diagnostic audit report.",
      icon: <Activity className="w-5 h-5 text-sky-400" />,
      badge: "Audit Report",
    },
    {
      id: "history" as const,
      title: "Git History & Evolution",
      desc: "Commit churn rates, top contributors, co-changed files, and evolution timeline.",
      icon: <History className="w-5 h-5 text-purple-400" />,
      badge: "Churn & Authors",
    },
    {
      id: "snapshot" as const,
      title: "Architecture Snapshots & Export",
      desc: "Export high-resolution SVG, PNG vector graphs, and Markdown architecture specs.",
      icon: <Camera className="w-5 h-5 text-sky-400" />,
      badge: "SVG · PNG · Markdown",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {actions.map((act) => (
        <div
          key={act.id}
          onClick={() => onOpenModal(act.id)}
          className="p-4 rounded-xl bg-zinc-900 hover:bg-zinc-800/80 border border-zinc-800 hover:border-zinc-700 transition-all cursor-pointer group flex flex-col justify-between shadow-sm"
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-lg bg-zinc-950 border border-zinc-800/80 group-hover:scale-105 transition-transform">
                {act.icon}
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-950 border border-zinc-800 text-zinc-400">
                {act.badge}
              </span>
            </div>
            <h4 className="text-xs font-semibold text-zinc-200 group-hover:text-white transition-colors">
              {act.title}
            </h4>
            <p className="text-[11px] text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
              {act.desc}
            </p>
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 pt-3 mt-3 border-t border-zinc-800/60">
            <span>Launch workspace</span>
            <ArrowRight className="w-3 h-3 text-sky-400 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      ))}
    </div>
  );
}
