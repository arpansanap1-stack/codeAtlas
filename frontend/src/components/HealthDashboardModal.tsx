"use client";

import React, { useEffect, useState, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import {
  Activity,
  X,
  AlertTriangle,
  RotateCcw,
  Layers,
  FileCode,
  CheckCircle2,
  AlertOctagon,
  TrendingUp,
  Eye,
  RefreshCw,
  Code2,
  Filter,
  Flame,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  HelpCircle,
  Download,
  Copy,
  Check,
  FileText,
} from "lucide-react";
import { getCodebaseHealth, getCodebaseHealthReport } from "@/lib/api";
import {
  ArchitectureSmell,
  ArchitectureSmellType,
  CodebaseHealthResponse,
} from "@/types";

function buildClientMarkdownReport(
  health: CodebaseHealthResponse,
  repoName: string,
  repoId: string
): string {
  const dateStr = new Date().toISOString().replace("T", " ").substring(0, 16) + " UTC";
  const criticalCount = health.smells.filter((s) => s.severity === "critical").length;
  const warningCount = health.smells.filter((s) => s.severity === "warning").length;
  const infoCount = health.smells.filter((s) => s.severity === "info").length;

  const explainSmell = (smell: ArchitectureSmell) => {
    switch (smell.smell_type) {
      case "circular_dependency":
        return `**Why This Is a Critical Problem:**
- **Initialization Failures & Deadlocks**: When modules depend on each other cyclically, runtimes cannot determine a deterministic evaluation order. This frequently leads to runtime crashes such as \`ImportError: cannot import name ... from partially initialized module\` or undefined imports at load time.
- **Testing & Mocking Bottlenecks**: Circular dependencies cannot be tested in isolation. Mocking one file inevitably requires instantiating the entire cycle, causing fragile and tightly entangled unit tests.
- **Cognitive Overhead**: Developers cannot reason about either module independently, as a change to one triggers cascading behavioral side-effects back onto itself.`;
      case "god_file":
        return `**Why This Is a High-Risk Problem:**
- **Massive Blast Radius**: A 'God File' accumulates excessive incoming callers (high fan-in) and outgoing dependencies (high fan-out). Changing a single function signature or internal logic can break dozens of distant parts of the system.
- **Frequent Merge Conflicts**: Because many features and developers touch this central hub simultaneously, it becomes a frequent source of painful Git merge conflicts.
- **SRP Violation**: Violates the Single Responsibility Principle by combining orchestrations, utilities, state, and domain operations into a single unmanageable monolith.`;
      case "oversized_module":
        return `**Why This Is a Code Quality Problem:**
- **Increased Defect Density**: Software engineering research consistently shows that defect density increases non-linearly with file size (>350-500 LOC). Large files hide edge cases and make thorough code reviews difficult.
- **Poor Cohesion**: Monstrous files usually bundle multiple loosely related capabilities that should belong to dedicated submodules or subcomponents.
- **Developer Fatigue & Navigation Latency**: Scrolling through thousands of lines impedes developer velocity and degrades IDE static analysis responsiveness.`;
      case "tight_coupling":
        return `**Why This Is a Dangerous Architecture Flaw:**
- **Inseparable 2-Node Cluster**: Bidirectional imports mean that Module A cannot exist without Module B, and Module B cannot exist without Module A. They are functionally a single split file masquerading as two separate modules.
- **Refactoring Lock-In**: Extracting or replacing either module requires simultaneous refactoring of both, preventing incremental migration or isolated upgrades.`;
      case "dead_module":
        return `**Why This Is an Architectural Liability:**
- **Code Bloat & Bundle Waste**: Orphaned modules that are never imported increase total bundle size (in client apps) and increase deployment artifact footprints.
- **Cognitive Distraction & Bit-Rot**: When new developers explore the repository, unreferenced dead code creates false assumptions about active system workflows and accumulates bit-rot without automated test coverage.`;
      default:
        return `**Why This Is an Architecture Problem:**
- ${smell.description}
- Reduces architectural modularity, hampers long-term maintainability, and increases the difficulty of onboarding new developers.`;
    }
  };

  const lines: string[] = [
    `# 🏥 Architecture Health & Codebase Quality Audit Report: ${repoName}`,
    ``,
    `> **Repository Name:** \`${repoName}\` (\`${repoId}\`)  `,
    `> **Health Score:** **${health.health_score} / 100** — \`${health.health_rating}\`  `,
    `> **Audit Generated:** \`${dateStr}\` via **CodeAtlas Architectural Diagnostics Engine**  `,
    ``,
    `---`,
    ``,
    `## 📋 1. Executive Summary`,
    ``,
    health.summary,
    ``,
  ];

  if (health.health_score >= 85) {
    lines.push(
      `### Architectural Verdict: 🟢 Excellent Modularity`,
      `The repository exhibits clean separation of concerns, high modular cohesion, and minimal structural anti-patterns. Dependency graphs are largely acyclic and component fan-out is well-contained.`,
      ``
    );
  } else if (health.health_score >= 70) {
    lines.push(
      `### Architectural Verdict: 🔵 Healthy with Minor Improvement Areas`,
      `The codebase is in good structural health overall. However, a small number of architectural hotspots or oversized files have been detected. Proactive refactoring now will prevent technical debt from compounding.`,
      ``
    );
  } else if (health.health_score >= 50) {
    lines.push(
      `### Architectural Verdict: 🟡 Needs Attention — Moderate Architecture Debt`,
      `Several architectural warning signs were discovered, including high coupling, oversized modules, or circular dependencies. These anti-patterns elevate regression risks and increase cognitive onboarding load.`,
      ``
    );
  } else {
    lines.push(
      `### Architectural Verdict: 🔴 Degraded — Critical Architecture Debt`,
      `The codebase contains multiple critical architectural anti-patterns, such as circular dependency loops and over-coupled God modules. These issues threaten runtime stability, prevent isolated testing, and require structural refactoring.`,
      ``
    );
  }

  lines.push(
    `---`,
    ``,
    `## 📊 2. Scorecard & Vital Structural Metrics`,
    ``,
    `| Metric | Value | Architectural Interpretation |`,
    `| :--- | :--- | :--- |`,
    `| **Overall Health Score** | **${health.health_score}/100** (${health.health_rating}) | Weighted health index based on coupling, cycles, and modularity |`,
    `| **Total Modules Analyzed** | **${health.total_files} files** | Total distinct source code files indexed in dependency graph |`,
    `| **Total Lines of Code** | **${health.total_lines.toLocaleString()} LOC** | Aggregate volume of codebase lines |`,
    `| **Graph Coupling Density** | **${(health.graph_density * 100).toFixed(2)}%** | Ratio of actual import edges to total theoretically possible edges |`,
    `| **Total Architecture Smells** | **${health.smells.length} issues** | Detected anti-patterns across all severity tiers |`,
    `| ↳ Critical Smells | \`${criticalCount}\` | Urgent issues (cycles, tight coupling) risking runtime crashes |`,
    `| ↳ Warning Smells | \`${warningCount}\` | Moderately severe issues (God files, oversized modules) |`,
    `| ↳ Informational / Dead Code | \`${infoCount}\` | Minor hygiene issues (orphaned/unreferenced files) |`,
    `| **Circular Dependency Loops** | **${health.circular_dependencies.length} cycles** | Mutually recursive import cycles detected in static topology |`,
    ``,
    `---`,
    ``,
    `## ⚠️ 3. In-Depth Problem Explanations & Diagnostic Breakdown`,
    ``,
    `This section details each architectural problem identified in the repository, explaining the precise technical risks it poses and providing actionable refactoring strategies.`,
    ``
  );

  if (health.smells.length === 0) {
    lines.push(
      `> 🛡️ **Zero Architectural Smells Detected!**`,
      `> The codebase maintains clean architectural boundaries with no circular imports, no monolithic God files, and well-proportioned module sizes.`,
      ``
    );
  } else {
    health.smells.forEach((smell, idx) => {
      const sevEmoji = smell.severity === "critical" ? "🔴" : smell.severity === "warning" ? "🟡" : "🔵";
      lines.push(
        `### Problem #${idx + 1}: ${sevEmoji} [${smell.severity.toUpperCase()}] ${smell.title}`,
        ``,
        `- **Smell Category:** \`${smell.smell_type}\``,
        `- **Severity Level:** **${smell.severity.toUpperCase()}**`,
        `- **Observable Symptom:** ${smell.description}`,
        ``,
        explainSmell(smell),
        ``,
        `**Affected Modules & File Paths:**`
      );
      smell.affected_files.forEach((fpath) => {
        lines.push(`- \`[${fpath}]\``);
      });
      lines.push(
        ``,
        `**Recommended Remediation / Fix Strategy:**`,
        `> 💡 **Actionable Tip:** ${smell.refactoring_tip}`,
        ``,
        `---`,
        ``
      );
    });
  }

  lines.push(
    `## 🔄 4. Circular Dependency Loops Deep-Dive`,
    ``
  );

  if (health.circular_dependencies.length === 0) {
    lines.push(
      `✅ **No circular dependency cycles found.** The import graph forms a clean Directed Acyclic Graph (DAG).`,
      ``
    );
  } else {
    lines.push(
      `Detected **${health.circular_dependencies.length} circular loop(s)** in the codebase import graph. Circular cycles undermine module independence and frequently cause runtime import deadlocks.`,
      ``
    );
    health.circular_dependencies.forEach((cycle, cIdx) => {
      const pathDisplay = cycle.map((f) => `\`${f}\``).join(" ➔ ");
      lines.push(
        `#### Cycle #${cIdx + 1} (${cycle.length - 1} hops):`,
        `> ${pathDisplay}`,
        ``,
        `**How to break this cycle:**`,
        `1. Identify the shared data structures or functions shared between \`${cycle[0]}\` and \`${cycle.length > 2 ? cycle[cycle.length - 2] : cycle[1]}\`.`,
        `2. Extract those shared entities into a separate, lower-level interface or types module (e.g. \`types.ts\` or \`schemas.py\`).`,
        `3. Update both modules to import from the new extracted module rather than importing each other directly.`,
        ``
      );
    });
  }

  lines.push(
    `---`,
    ``,
    `## 🔥 5. Hotspots & Architectural Blast Radius`,
    ``,
    `### Top Most Connected Hub Files (Highest Blast Radius)`,
    `Files with high degree centrality (fan-in + fan-out) represent core architectural junctions. Any bug or interface change in these modules radiates across dependent systems.`,
    ``,
    `| Module Path | Degree Centrality | Details |`,
    `| :--- | :--- | :--- |`
  );
  health.most_connected_files.forEach((hub) => {
    lines.push(`| \`${hub.file_path}\` | **${hub.value} edges** | ${hub.details || "Connected hub"} |`);
  });

  lines.push(
    ``,
    `### Largest Modules by Lines of Code`,
    `Modules with excessive length are prime candidates for SRP decomposition.`,
    ``,
    `| Module Path | Lines of Code | Complexity Chunks |`,
    `| :--- | :--- | :--- |`
  );
  health.largest_modules.forEach((mod) => {
    lines.push(`| \`${mod.file_path}\` | **${mod.value} lines** | ${mod.details || "-"} |`);
  });

  if (health.dead_files.length > 0) {
    lines.push(
      ``,
      `### Potential Orphaned / Dead Modules`,
      `These modules have 0 incoming imports and do not match standard entrypoint patterns (such as \`main.py\`, \`index.ts\`, \`page.tsx\`). Audit them to confirm if they are dynamically invoked, test files, or dead code.`,
      ``
    );
    health.dead_files.forEach((df) => {
      lines.push(`- \`[${df}]\``);
    });
  }

  lines.push(
    ``,
    `---`,
    ``,
    `## 💻 6. Language & Technology Stack Composition`,
    ``,
    `| Language | Files Count | Percentage Share |`,
    `| :--- | :--- | :--- |`
  );
  health.languages.forEach((lang) => {
    lines.push(`| **${lang.language}** | ${lang.file_count} files | ${lang.percentage}% |`);
  });

  lines.push(
    ``,
    `---`,
    ``,
    `## 🎯 7. Prioritized Engineering Remediation Roadmap`,
    ``,
    `To systematically elevate this codebase's health score and eliminate structural risks, follow this 3-phase remediation plan:`,
    ``,
    `### 🔴 Phase 1: High-Priority Safety Interventions (P0 — Days 1–3)`,
    `- **Break Circular Imports**: Eliminate all detected circular cycles by extracting shared interfaces or applying the Dependency Inversion Principle.`,
    `- **Decouple Mutual Pairs**: Invert dependencies on tightly coupled 2-node file pairs to enable isolated testing.`,
    ``,
    `### 🟡 Phase 2: Hub & Blast Radius Reduction (P1 — Week 1)`,
    `- **Refactor God Modules**: Introduce domain facades or divide multi-responsibility files into cohesive sub-services.`,
    `- **Protect Hub Callers**: Ensure unit tests thoroughly mock high fan-in dependencies to prevent upstream regression cascades.`,
    ``,
    `### 🔵 Phase 3: Maintainability & Code Hygiene (P2 — Ongoing)`,
    `- **Split Oversized Files**: Break files exceeding 350 LOC into modular presentation/logic subcomponents.`,
    `- **Clean Dead Code**: Verify and prune unused modules to reduce bundle weight and cognitive debt.`,
    ``,
    `---`,
    ``,
    `> *Report compiled automatically by **CodeAtlas**. For interactive visualization, visual cycle exploration, and Monaco line-by-line inspection, launch the CodeAtlas Web Workspace.*`
  );

  return lines.join("\n");
}

interface HealthDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  repoId: string;
  repoName: string;
  onHighlightOnMap: (filePaths: string[], targetFile: string) => void;
  onSelectFile: (filePath: string) => void;
}

export function HealthDashboardModal({
  isOpen,
  onClose,
  repoId,
  repoName,
  onHighlightOnMap,
  onSelectFile,
}: HealthDashboardModalProps) {
  const [data, setData] = useState<CodebaseHealthResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSmellFilter, setSelectedSmellFilter] = useState<
    "all" | ArchitectureSmellType
  >("all");
  const [activeTab, setActiveTab] = useState<"smells" | "metrics" | "cycles" | "report">("smells");
  const [searchFilter, setSearchFilter] = useState("");
  const [reportMarkdown, setReportMarkdown] = useState<string | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const fetchReport = async (): Promise<string> => {
    if (reportMarkdown) return reportMarkdown;
    try {
      setLoadingReport(true);
      const res = await getCodebaseHealthReport(repoId);
      if (res && res.markdown_report) {
        setReportMarkdown(res.markdown_report);
        return res.markdown_report;
      }
    } catch (e) {
      console.warn("API health report fetch failed, using client-side fallback:", e);
    } finally {
      setLoadingReport(false);
    }
    if (data) {
      const generated = buildClientMarkdownReport(data, repoName, repoId);
      setReportMarkdown(generated);
      return generated;
    }
    return "";
  };

  const handleDownloadReport = async () => {
    if (!data) return;
    try {
      setIsDownloading(true);
      const markdown = await fetchReport();
      if (!markdown) return;
      const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${repoName}-health-and-smell-report.md`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to download health report", err);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCopyReport = async () => {
    if (!data) return;
    try {
      const markdown = await fetchReport();
      if (!markdown) return;
      await navigator.clipboard.writeText(markdown);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    } catch (err) {
      console.error("Failed to copy report", err);
    }
  };

  const loadHealthData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getCodebaseHealth(repoId);
      setData(res);
    } catch (err: any) {
      setError(err.message || "Failed to analyze codebase health");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadHealthData();
    }
  }, [isOpen, repoId]);

  const filteredSmells = useMemo(() => {
    if (!data) return [];
    return data.smells.filter((smell) => {
      const matchesType =
        selectedSmellFilter === "all" || smell.smell_type === selectedSmellFilter;
      const matchesSearch =
        !searchFilter.trim() ||
        smell.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
        smell.description.toLowerCase().includes(searchFilter.toLowerCase()) ||
        smell.affected_files.some((f) =>
          f.toLowerCase().includes(searchFilter.toLowerCase())
        );
      return matchesType && matchesSearch;
    });
  }, [data, selectedSmellFilter, searchFilter]);

  if (!isOpen) return null;

  // Score color helper
  const getScoreColor = (score: number) => {
    if (score >= 85) return { text: "text-emerald-400", ring: "stroke-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/30" };
    if (score >= 70) return { text: "text-sky-400", ring: "stroke-sky-500", bg: "bg-sky-500/10 border-sky-500/30" };
    if (score >= 50) return { text: "text-amber-400", ring: "stroke-amber-500", bg: "bg-amber-500/10 border-amber-500/30" };
    return { text: "text-rose-400", ring: "stroke-rose-500", bg: "bg-rose-500/10 border-rose-500/30" };
  };

  const scoreTheme = data ? getScoreColor(data.health_score) : getScoreColor(100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        className="w-full max-w-5xl h-[88vh] bg-panel border border-borderDefault rounded-2xl shadow-elevated flex flex-col overflow-hidden text-zinc-100 animate-scale-in"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-borderSubtle bg-surface/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-accent-indigo/15 border border-accent-indigo/30 text-accent-indigoLight">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-tight text-white flex items-center gap-2">
                <span>Codebase Health & Architecture Smell Detection</span>
                {data && (
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full border font-mono font-medium ${scoreTheme.bg} ${scoreTheme.text}`}
                  >
                    Score: {data.health_score}/100 • {data.health_rating}
                  </span>
                )}
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5 font-mono">
                {repoName} • Graph metrics, structural smells, and refactoring insights
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {data && (
              <>
                <button
                  onClick={handleCopyReport}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-borderSubtle bg-surface hover:bg-surfaceHover text-xs font-mono text-zinc-300 hover:text-white transition-colors cursor-pointer"
                  title="Copy full diagnostic Markdown health report to clipboard"
                >
                  {isCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Copy Report</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleDownloadReport}
                  disabled={isDownloading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-accent-indigo/40 bg-accent-indigo/15 hover:bg-accent-indigo/25 text-xs font-mono text-accent-indigoLight hover:text-white transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
                  title="Download comprehensive architecture health & smell report (.md)"
                >
                  {isDownloading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Exporting...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Report (.md)</span>
                    </>
                  )}
                </button>
              </>
            )}

            <button
              onClick={loadHealthData}
              disabled={loading}
              className="p-1.5 rounded-lg border border-borderSubtle hover:bg-surfaceHover text-zinc-400 hover:text-white transition-colors cursor-pointer"
              title="Refresh Health Analysis"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg border border-borderSubtle hover:bg-surfaceHover text-zinc-400 hover:text-white transition-colors cursor-pointer"
              title="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        {loading && !data ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-zinc-400 font-mono text-xs">
            <Loader2 className="w-7 h-7 animate-spin text-sky-400" />
            <span>Analyzing graph topology, cycles, and architecture smells...</span>
          </div>
        ) : error && !data ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <AlertTriangle className="w-8 h-8 text-rose-400" />
            <div className="text-sm font-medium text-rose-300">{error}</div>
            <button
              onClick={loadHealthData}
              className="px-4 py-2 rounded-lg bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 text-xs font-mono text-zinc-200 mt-2"
            >
              Try Again
            </button>
          </div>
        ) : data ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Top Stat Cards & Health Gauge */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-6 border-b border-zinc-800/80 bg-zinc-900/30 shrink-0">
              {/* Health Score Gauge */}
              <div className="col-span-2 sm:col-span-1 flex items-center gap-3 p-3 rounded-lg bg-zinc-900/80 border border-zinc-800">
                <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
                  <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-zinc-800"
                      strokeWidth="3.5"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className={`${scoreTheme.ring} transition-all duration-1000`}
                      strokeDasharray={`${data.health_score}, 100`}
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <span className={`absolute text-xs font-bold font-mono ${scoreTheme.text}`}>
                    {data.health_score}
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-wider font-mono text-zinc-400">
                    Health Score
                  </div>
                  <div className="text-xs font-semibold text-zinc-200 truncate">
                    {data.health_rating}
                  </div>
                </div>
              </div>

              {/* Total Files */}
              <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800">
                <div className="flex items-center justify-between text-zinc-400 text-[10px] font-mono uppercase">
                  <span>Files</span>
                  <FileCode className="w-3.5 h-3.5 text-sky-400" />
                </div>
                <div className="text-lg font-bold font-mono text-zinc-100 mt-1">
                  {data.total_files}
                </div>
                <div className="text-[10px] text-zinc-400 font-mono truncate">
                  {data.total_lines.toLocaleString()} lines total
                </div>
              </div>

              {/* Graph Density */}
              <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800">
                <div className="flex items-center justify-between text-zinc-400 text-[10px] font-mono uppercase">
                  <span>Graph Density</span>
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div className="text-lg font-bold font-mono text-zinc-100 mt-1">
                  {(data.graph_density * 100).toFixed(1)}%
                </div>
                <div className="text-[10px] text-zinc-400 font-mono truncate">
                  Coupling intensity
                </div>
              </div>

              {/* Circular Dependencies */}
              <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800">
                <div className="flex items-center justify-between text-zinc-400 text-[10px] font-mono uppercase">
                  <span>Cycles</span>
                  <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                </div>
                <div
                  className={`text-lg font-bold font-mono mt-1 ${
                    data.circular_dependencies.length > 0 ? "text-rose-400" : "text-emerald-400"
                  }`}
                >
                  {data.circular_dependencies.length}
                </div>
                <div className="text-[10px] text-zinc-400 font-mono truncate">
                  {data.circular_dependencies.length > 0 ? "Circular loops" : "Clean DAG"}
                </div>
              </div>

              {/* Architecture Smells */}
              <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800">
                <div className="flex items-center justify-between text-zinc-400 text-[10px] font-mono uppercase">
                  <span>Smells</span>
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <div
                  className={`text-lg font-bold font-mono mt-1 ${
                    data.smells.length > 0 ? "text-amber-400" : "text-emerald-400"
                  }`}
                >
                  {data.smells.length}
                </div>
                <div className="text-[10px] text-zinc-400 font-mono truncate">
                  Architecture issues
                </div>
              </div>
            </div>

            {/* Navigation Tabs & Search */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-2.5 border-b border-zinc-800/80 bg-zinc-950">
              <div className="flex items-center gap-1 font-mono text-xs">
                <button
                  onClick={() => setActiveTab("smells")}
                  className={`px-3 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
                    activeTab === "smells"
                      ? "bg-zinc-800 text-sky-400 font-medium"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Architecture Smells ({data.smells.length})</span>
                </button>
                <button
                  onClick={() => setActiveTab("metrics")}
                  className={`px-3 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
                    activeTab === "metrics"
                      ? "bg-zinc-800 text-sky-400 font-medium"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Hotspots & Metrics</span>
                </button>
                <button
                  onClick={() => setActiveTab("cycles")}
                  className={`px-3 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
                    activeTab === "cycles"
                      ? "bg-zinc-800 text-rose-400 font-medium"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Circular Cycles ({data.circular_dependencies.length})</span>
                </button>
                <button
                  onClick={() => {
                    setActiveTab("report");
                    if (!reportMarkdown) {
                      fetchReport();
                    }
                  }}
                  className={`px-3 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
                    activeTab === "report"
                      ? "bg-zinc-800 text-emerald-400 font-medium"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Diagnostic Report (.md)</span>
                </button>
              </div>

              {activeTab === "smells" && (
                <div className="flex items-center gap-2">
                  {/* Smell Type Filter */}
                  <div className="flex items-center gap-1 text-[11px] font-mono">
                    <span className="text-zinc-500">Type:</span>
                    <select
                      value={selectedSmellFilter}
                      onChange={(e) => setSelectedSmellFilter(e.target.value as any)}
                      aria-label="Filter by smell type"
                      className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-zinc-300 focus:outline-none focus:border-zinc-700"
                    >
                      <option value="all">All Smells</option>
                      <option value="circular_dependency">Circular Dependencies</option>
                      <option value="god_file">God Files (Over-coupled)</option>
                      <option value="oversized_module">Oversized Modules</option>
                      <option value="dead_module">Dead Modules</option>
                      <option value="tight_coupling">Tightly Coupled Pairs</option>
                    </select>
                  </div>

                  {/* Search Input */}
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Filter by file or keyword..."
                    aria-label="Filter smells by file or keyword"
                    className="bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1 text-xs font-mono text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-700 w-44"
                  />
                </div>
              )}
            </div>

            {/* Tab 1: Architecture Smells */}
            {activeTab === "smells" && (
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {filteredSmells.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-zinc-800 rounded-xl bg-zinc-900/20">
                    <ShieldCheck className="w-10 h-10 text-emerald-400 mb-2" />
                    <div className="text-sm font-semibold text-zinc-200">
                      No matching architecture smells found
                    </div>
                    <p className="text-xs text-zinc-400 mt-1 max-w-md font-mono">
                      {data.smells.length === 0
                        ? "Congratulations! Your codebase exhibits clean separation of concerns, no circular imports, and balanced module boundaries."
                        : "Try adjusting your smell type filter or search keyword."}
                    </p>
                  </div>
                ) : (
                  filteredSmells.map((smell, idx) => {
                    const isCritical = smell.severity === "critical";
                    const isWarning = smell.severity === "warning";

                    return (
                      <div
                        key={idx}
                        className={`p-4 rounded-xl border transition-all ${
                          isCritical
                            ? "bg-rose-950/20 border-rose-900/40 hover:border-rose-700/60"
                            : isWarning
                            ? "bg-amber-950/20 border-amber-900/40 hover:border-amber-700/60"
                            : "bg-sky-950/20 border-sky-900/40 hover:border-sky-700/60"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[10px] font-mono px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold border ${
                                  isCritical
                                    ? "bg-rose-500/20 text-rose-400 border-rose-500/40"
                                    : isWarning
                                    ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                                    : "bg-sky-500/20 text-sky-400 border-sky-500/40"
                                }`}
                              >
                                {smell.severity}
                              </span>
                              <h3 className="text-sm font-semibold text-zinc-100 font-mono">
                                {smell.title}
                              </h3>
                            </div>
                            <p className="text-xs text-zinc-300 leading-relaxed font-sans">
                              {smell.description}
                            </p>
                          </div>

                          {/* Quick Map Action */}
                          {smell.affected_files.length > 0 && (
                            <button
                              onClick={() => {
                                onHighlightOnMap(smell.affected_files, smell.affected_files[0]);
                                onClose();
                              }}
                              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-mono text-zinc-200 transition-colors"
                              title="Dim other files and focus these nodes on the Architecture Map"
                            >
                              <Eye className="w-3.5 h-3.5 text-sky-400" />
                              <span>Focus on Map</span>
                            </button>
                          )}
                        </div>

                        {/* Affected Files List */}
                        <div className="mt-3 pt-3 border-t border-zinc-800/80">
                          <div className="text-[11px] font-mono text-zinc-400 mb-1.5 flex items-center gap-1">
                            <FileCode className="w-3 h-3 text-zinc-500" />
                            <span>Affected Modules ({smell.affected_files.length}):</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {smell.affected_files.map((file, fIdx) => (
                              <button
                                key={fIdx}
                                onClick={() => {
                                  onSelectFile(file);
                                  onClose();
                                }}
                                className="px-2 py-0.5 rounded bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 text-[11px] font-mono text-sky-300 hover:text-sky-200 transition-colors flex items-center gap-1"
                                title="Click to view file code"
                              >
                                <span>{file}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Refactoring Advice */}
                        <div className="mt-3 p-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800/80 text-xs font-mono text-zinc-300 flex items-start gap-2">
                          <span className="text-emerald-400 font-semibold shrink-0">💡 Fix Tip:</span>
                          <span className="text-zinc-300 font-sans leading-relaxed">
                            {smell.refactoring_tip}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Tab 2: Hotspots & Metrics */}
            {activeTab === "metrics" && (
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Languages Breakdown */}
                <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 font-mono mb-3 flex items-center gap-1.5">
                    <Code2 className="w-4 h-4 text-sky-400" />
                    <span>Language Distribution</span>
                  </h3>

                  {/* Multi-segment Progress Bar */}
                  <div className="h-2.5 w-full bg-zinc-800 rounded-full overflow-hidden flex mb-3">
                    {data.languages.map((lang, lIdx) => {
                      const colors = [
                        "bg-sky-500",
                        "bg-emerald-500",
                        "bg-amber-500",
                        "bg-indigo-500",
                        "bg-rose-500",
                        "bg-purple-500",
                        "bg-teal-500",
                      ];
                      const color = colors[lIdx % colors.length];
                      return (
                        <div
                          key={lIdx}
                          style={{ width: `${lang.percentage}%` }}
                          className={`${color} h-full transition-all`}
                          title={`${lang.language}: ${lang.percentage}% (${lang.file_count} files)`}
                        />
                      );
                    })}
                  </div>

                  {/* Language Pills */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {data.languages.map((lang, lIdx) => (
                      <div
                        key={lIdx}
                        className="p-2 rounded-lg bg-zinc-900/90 border border-zinc-800 flex items-center justify-between text-xs font-mono"
                      >
                        <span className="text-zinc-200 font-medium">{lang.language}</span>
                        <span className="text-zinc-400">
                          {lang.file_count} ({lang.percentage}%)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Two Column Grid: Most Connected Files & Largest Files */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Most Connected (Centrality Hotspots) */}
                  <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 flex flex-col">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 font-mono mb-2 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Flame className="w-4 h-4 text-rose-400" />
                        <span>Most Connected Modules (Hotspots)</span>
                      </span>
                      <span className="text-[10px] text-zinc-500 lowercase">by total degree</span>
                    </h3>
                    <p className="text-[11px] text-zinc-400 mb-3">
                      Modules with highest inward and outward dependency coupling. Changes here pose highest regression risk.
                    </p>

                    <div className="space-y-2 flex-1">
                      {data.most_connected_files.length === 0 ? (
                        <div className="text-xs font-mono text-zinc-500">No hotspot connections recorded.</div>
                      ) : (
                        data.most_connected_files.map((mod, mIdx) => (
                          <div
                            key={mIdx}
                            className="p-2.5 rounded-lg bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 flex items-center justify-between gap-3 text-xs font-mono group"
                          >
                            <button
                              onClick={() => {
                                onSelectFile(mod.file_path);
                                onClose();
                              }}
                              className="text-sky-300 hover:text-sky-200 truncate text-left font-medium"
                              title={mod.file_path}
                            >
                              {mod.file_path}
                            </button>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[10px]">
                                {mod.metric_label}
                              </span>
                              <button
                                onClick={() => {
                                  onHighlightOnMap([mod.file_path], mod.file_path);
                                  onClose();
                                }}
                                className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white"
                                title="Inspect on Map"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Largest Modules */}
                  <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 flex flex-col">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 font-mono mb-2 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <FileCode className="w-4 h-4 text-amber-400" />
                        <span>Largest Modules (LOC)</span>
                      </span>
                      <span className="text-[10px] text-zinc-500 lowercase">by line count</span>
                    </h3>
                    <p className="text-[11px] text-zinc-400 mb-3">
                      Files with the highest line count. Consider splitting these into cohesive submodules.
                    </p>

                    <div className="space-y-2 flex-1">
                      {data.largest_modules.length === 0 ? (
                        <div className="text-xs font-mono text-zinc-500">No module sizing recorded.</div>
                      ) : (
                        data.largest_modules.map((mod, mIdx) => (
                          <div
                            key={mIdx}
                            className="p-2.5 rounded-lg bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 flex items-center justify-between gap-3 text-xs font-mono group"
                          >
                            <button
                              onClick={() => {
                                onSelectFile(mod.file_path);
                                onClose();
                              }}
                              className="text-amber-300 hover:text-amber-200 truncate text-left font-medium"
                              title={mod.file_path}
                            >
                              {mod.file_path}
                            </button>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[10px]">
                                {mod.metric_label}
                              </span>
                              <button
                                onClick={() => {
                                  onSelectFile(mod.file_path);
                                  onClose();
                                }}
                                className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white"
                                title="View Code"
                              >
                                <FileCode className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Dead Files / Unconnected Modules */}
                {data.dead_files.length > 0 && (
                  <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 font-mono mb-2 flex items-center gap-1.5">
                      <HelpCircle className="w-4 h-4 text-zinc-400" />
                      <span>Potential Dead Modules ({data.dead_files.length})</span>
                    </h3>
                    <p className="text-[11px] text-zinc-400 mb-3">
                      These files are never imported by any other module in this repository and do not match standard entrypoints (main, index, app, config). Check if they are obsolete.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {data.dead_files.map((file, dIdx) => (
                        <button
                          key={dIdx}
                          onClick={() => {
                            onSelectFile(file);
                            onClose();
                          }}
                          className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs font-mono text-zinc-300 hover:text-white transition-colors"
                          title="Inspect file"
                        >
                          🍂 {file}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Circular Cycles */}
            {activeTab === "cycles" && (
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {data.circular_dependencies.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-zinc-800 rounded-xl bg-zinc-900/20">
                    <CheckCircle2 className="w-10 h-10 text-emerald-400 mb-2" />
                    <div className="text-sm font-semibold text-zinc-200">
                      No Circular Dependencies Detected
                    </div>
                    <p className="text-xs text-zinc-400 mt-1 max-w-md font-mono">
                      The dependency graph is a strict Directed Acyclic Graph (DAG). There are no circular import loops causing runtime import errors or memory retain cycles.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-center gap-2">
                      <AlertOctagon className="w-4 h-4 shrink-0 text-rose-400" />
                      <span>
                        Found {data.circular_dependencies.length} circular dependency cycle(s). Circular imports can trigger runtime <code>ImportError</code> / <code>NameError</code> on startup or tight coupling.
                      </span>
                    </div>

                    <div className="space-y-3">
                      {data.circular_dependencies.map((cycle, cIdx) => (
                        <div
                          key={cIdx}
                          className="p-4 rounded-xl border border-rose-900/40 bg-zinc-900/80 hover:border-rose-700/60 transition-all space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-mono font-semibold text-rose-400 flex items-center gap-1.5">
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Cycle #{cIdx + 1} ({cycle.length} steps)</span>
                            </span>
                            <button
                              onClick={() => {
                                onHighlightOnMap(cycle, cycle[0]);
                                onClose();
                              }}
                              className="px-3 py-1 rounded-md bg-rose-500/15 border border-rose-500/30 hover:bg-rose-500/25 text-rose-300 text-xs font-mono transition-colors flex items-center gap-1"
                              title="Highlight this circular loop on the Architecture Map"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Highlight Cycle on Map</span>
                            </button>
                          </div>

                          {/* Interactive cycle chain */}
                          <div className="flex flex-wrap items-center gap-1.5 p-3 rounded-lg bg-zinc-950 border border-zinc-800">
                            {cycle.map((file, fIdx) => (
                              <React.Fragment key={fIdx}>
                                <button
                                  onClick={() => {
                                    onSelectFile(file);
                                    onClose();
                                  }}
                                  className="px-2 py-1 rounded bg-zinc-900 border border-zinc-700 text-xs font-mono text-sky-300 hover:text-sky-200 hover:border-sky-500 transition-colors"
                                  title="View file"
                                >
                                  {file}
                                </button>
                                <ArrowRight className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                              </React.Fragment>
                            ))}
                            <button
                              onClick={() => {
                                onSelectFile(cycle[0]);
                                onClose();
                              }}
                              className="px-2 py-1 rounded bg-rose-950/60 border border-rose-700 text-xs font-mono text-rose-300 hover:text-white"
                              title="Loop closes back to initial module"
                            >
                              {cycle[0]} (closes loop)
                            </button>
                          </div>

                          <div className="text-[11px] font-mono text-zinc-400">
                            💡 <span className="text-zinc-300">Suggested resolution:</span> Extract shared interfaces, types, or utility functions into a separate leaf module that neither file depends on cyclically.
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Tab 4: Comprehensive Audit Report Preview */}
            {activeTab === "report" && (
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {/* Report Action Banner */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-zinc-800 bg-zinc-900/60 sticky top-0 backdrop-blur-md z-10">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold font-mono text-zinc-100 flex items-center gap-2">
                        <span>{repoName}-health-and-smell-report.md</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-mono">
                          Ready to Export
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-400 font-mono mt-0.5">
                        Full diagnostic report with problem explanations, cycle analysis & remediation plan
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopyReport}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-xs font-mono text-zinc-200 hover:text-white transition-colors cursor-pointer"
                      title="Copy Markdown to clipboard"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-zinc-400" />
                          <span>Copy MD</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={handleDownloadReport}
                      disabled={isDownloading}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/20 hover:bg-emerald-500/30 text-xs font-mono text-emerald-300 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                      title="Download report as .md"
                    >
                      {isDownloading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Downloading...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-3.5 h-3.5" />
                          <span>Download (.md)</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Report Body */}
                {loadingReport && !reportMarkdown ? (
                  <div className="flex flex-col items-center justify-center p-12 gap-3 text-zinc-400 font-mono text-xs">
                    <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
                    <span>Compiling architectural diagnostics and problem explanations...</span>
                  </div>
                ) : (
                  <div className="p-6 rounded-xl border border-zinc-800/80 bg-zinc-950/70 font-sans text-xs text-zinc-300 leading-relaxed max-w-none">
                    <ReactMarkdown
                      components={{
                        h1: ({ children }) => (
                          <h1 className="text-lg font-bold text-white mb-3 pb-2 border-b border-zinc-800 flex items-center gap-2">
                            {children}
                          </h1>
                        ),
                        h2: ({ children }) => (
                          <h2 className="text-sm font-bold text-sky-400 mt-6 mb-2 pb-1 border-b border-zinc-800/60 font-mono">
                            {children}
                          </h2>
                        ),
                        h3: ({ children }) => (
                          <h3 className="text-xs font-semibold text-zinc-100 mt-4 mb-2 font-mono">
                            {children}
                          </h3>
                        ),
                        h4: ({ children }) => (
                          <h4 className="text-xs font-semibold text-zinc-300 mt-3 mb-1 font-mono">
                            {children}
                          </h4>
                        ),
                        p: ({ children }) => <p className="text-xs text-zinc-300 leading-relaxed mb-3">{children}</p>,
                        ul: ({ children }) => (
                          <ul className="list-disc list-inside text-xs text-zinc-300 space-y-1 mb-3 pl-2">
                            {children}
                          </ul>
                        ),
                        ol: ({ children }) => (
                          <ol className="list-decimal list-inside text-xs text-zinc-300 space-y-1 mb-3 pl-2">
                            {children}
                          </ol>
                        ),
                        li: ({ children }) => <li className="text-xs text-zinc-300 leading-relaxed">{children}</li>,
                        blockquote: ({ children }) => (
                          <blockquote className="border-l-2 border-accent-indigo/60 pl-3 py-1.5 my-2.5 text-xs italic text-zinc-300 bg-zinc-900/60 rounded-r-lg">
                            {children}
                          </blockquote>
                        ),
                        table: ({ children }) => (
                          <div className="overflow-x-auto my-3">
                            <table className="w-full text-left text-xs border border-zinc-800 rounded-lg">
                              {children}
                            </table>
                          </div>
                        ),
                        thead: ({ children }) => (
                          <thead className="bg-zinc-900 text-zinc-300 font-mono text-[11px] border-b border-zinc-800">
                            {children}
                          </thead>
                        ),
                        th: ({ children }) => (
                          <th className="p-2 border-r border-zinc-800 font-medium last:border-r-0">
                            {children}
                          </th>
                        ),
                        td: ({ children }) => (
                          <td className="p-2 border-t border-r border-zinc-800 font-mono text-zinc-300 last:border-r-0">
                            {children}
                          </td>
                        ),
                        code: ({ children }) => (
                          <code className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-sky-300 font-mono text-[11px]">
                            {children}
                          </code>
                        ),
                        hr: () => <hr className="my-5 border-zinc-800" />,
                      }}
                    >
                      {reportMarkdown || (data ? buildClientMarkdownReport(data, repoName, repoId) : "")}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
