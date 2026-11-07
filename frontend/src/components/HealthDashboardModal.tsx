"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  Activity,
  X,
  AlertTriangle,
  RotateCcw,
  FileCode,
  TrendingUp,
  RefreshCw,
  Flame,
  ShieldCheck,
  Loader2,
  Download,
  Copy,
  Check,
  FileText,
} from "lucide-react";
import { getCodebaseHealth, getCodebaseHealthReport } from "@/lib/api";
import {
  ArchitectureSmellType,
  CodebaseHealthResponse,
} from "@/types";
import { SmellCard } from "@/components/health/SmellCard";
import { DiagnosticReportTab } from "@/components/health/DiagnosticReportTab";
import { HealthScoreCards } from "@/components/health/HealthScoreCards";
import { HealthTabsBar } from "@/components/health/HealthTabsBar";
import { HealthMetricsTab } from "@/components/health/HealthMetricsTab";
import { HealthCyclesTab } from "@/components/health/HealthCyclesTab";
import { buildClientMarkdownReport } from "@/lib/healthReportUtils";

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
  const [selectedSmellFilter, setSelectedSmellFilter] = useState<"all" | ArchitectureSmellType>("all");
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
      console.warn("API health report fetch failed, using client fallback:", e);
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
      const matchesType = selectedSmellFilter === "all" || smell.smell_type === selectedSmellFilter;
      const matchesSearch =
        !searchFilter.trim() ||
        smell.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
        smell.description.toLowerCase().includes(searchFilter.toLowerCase()) ||
        smell.affected_files.some((f) => f.toLowerCase().includes(searchFilter.toLowerCase()));
      return matchesType && matchesSearch;
    });
  }, [data, selectedSmellFilter, searchFilter]);

  if (!isOpen) return null;

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
        className="w-full max-w-5xl h-[88vh] bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-zinc-100 animate-scale-in"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-tight text-white flex items-center gap-2">
                <span>Codebase Health & Architecture Smells</span>
                {data && (
                  <span className={`text-xs px-2.5 py-0.5 rounded-full border font-mono font-medium ${scoreTheme.bg} ${scoreTheme.text}`}>
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
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-xs font-mono text-zinc-300 hover:text-white transition-colors cursor-pointer"
                  title="Copy full diagnostic Markdown health report"
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
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sky-500/40 bg-sky-500/15 hover:bg-sky-500/25 text-xs font-mono text-sky-300 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                  title="Download health report (.md)"
                >
                  {isDownloading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Exporting...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      <span>Download .md</span>
                    </>
                  )}
                </button>
              </>
            )}

            <button
              onClick={loadHealthData}
              disabled={loading}
              className="p-1.5 rounded-lg border border-zinc-700 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              title="Refresh Health Analysis"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg border border-zinc-700 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
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
            {/* Top Stat Cards */}
            <HealthScoreCards data={data} scoreTheme={scoreTheme} />

            {/* Navigation Tabs */}
            <HealthTabsBar
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              data={data}
              reportMarkdown={reportMarkdown}
              onFetchReport={fetchReport}
              selectedSmellFilter={selectedSmellFilter}
              setSelectedSmellFilter={setSelectedSmellFilter}
              searchFilter={searchFilter}
              setSearchFilter={setSearchFilter}
            />

            {/* Tab 1: Architecture Smells */}
            {activeTab === "smells" && (
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {filteredSmells.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-zinc-800 rounded-xl bg-zinc-900/20">
                    <ShieldCheck className="w-10 h-10 text-emerald-400 mb-2" />
                    <div className="text-sm font-semibold text-zinc-200">No matching architecture smells found</div>
                    <p className="text-xs text-zinc-400 mt-1 max-w-md font-mono">
                      {data.smells.length === 0
                        ? "Congratulations! Your codebase exhibits clean modularity with no circular imports or monolithic bloat."
                        : "Try adjusting your filter or search keyword."}
                    </p>
                  </div>
                ) : (
                  filteredSmells.map((smell, idx) => (
                    <SmellCard
                      key={idx}
                      smell={smell}
                      onHighlightOnMap={onHighlightOnMap}
                      onSelectFile={onSelectFile}
                      onCloseModal={onClose}
                    />
                  ))
                )}
              </div>
            )}

            {/* Tab 2: Hotspots & Metrics */}
            {activeTab === "metrics" && (
              <HealthMetricsTab
                data={data}
                onSelectFile={onSelectFile}
                onClose={onClose}
              />
            )}

            {/* Tab 3: Circular Cycles */}
            {activeTab === "cycles" && (
              <HealthCyclesTab
                cycles={data.circular_dependencies}
                onHighlightOnMap={onHighlightOnMap}
                onClose={onClose}
              />
            )}

            {/* Tab 4: Diagnostic Markdown Report */}
            {activeTab === "report" && (
              <div className="flex-1 overflow-y-auto p-6">
                <DiagnosticReportTab
                  reportMarkdown={reportMarkdown || ""}
                  repoName={repoName}
                  loading={loadingReport}
                />
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
