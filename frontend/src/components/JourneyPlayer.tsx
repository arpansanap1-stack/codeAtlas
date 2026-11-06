"use client";

import React, { useEffect, useState } from "react";
import {
  Milestone,
  ArrowRight,
  ArrowLeft,
  X,
  Play,
  Loader2,
  FileCode,
  Sparkles,
  Route,
  CheckCircle2,
  ChevronRight,
  ListRestart,
} from "lucide-react";
import { generateJourney, getSuggestedJourneys } from "@/lib/api";
import { JourneyResponse, SuggestedJourneyItem } from "@/types";

interface JourneyPlayerProps {
  repoId: string;
  repoName: string;
  isOpen: boolean;
  onClose: () => void;
  activeJourney: JourneyResponse | null;
  setActiveJourney: (journey: JourneyResponse | null) => void;
  currentStepIndex: number;
  setCurrentStepIndex: (index: number) => void;
  onSelectStepCitation: (filePath: string, startLine: number, endLine: number) => void;
}

export function JourneyPlayer({
  repoId,
  repoName,
  isOpen,
  onClose,
  activeJourney,
  setActiveJourney,
  currentStepIndex,
  setCurrentStepIndex,
  onSelectStepCitation,
}: JourneyPlayerProps) {
  const [topicInput, setTopicInput] = useState("");
  const [suggestedJourneys, setSuggestedJourneys] = useState<SuggestedJourneyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load suggestions once
  useEffect(() => {
    if (!repoId) return;
    getSuggestedJourneys(repoId)
      .then((res) => {
        setSuggestedJourneys(res.journeys);
      })
      .catch((err) => {
        console.error("Failed to load suggested journeys:", err);
      });
  }, [repoId]);

  // Handle starting a journey
  const handleStartJourney = async (topic: string) => {
    const cleanTopic = topic.trim();
    if (!cleanTopic) return;

    try {
      setLoading(true);
      setError(null);
      const res = await generateJourney(repoId, cleanTopic);
      setActiveJourney(res);
      setCurrentStepIndex(0);

      // Immediately focus step 1
      if (res.steps.length > 0) {
        const step1 = res.steps[0];
        onSelectStepCitation(step1.file_path, step1.start_line, step1.end_line);
      }
    } catch (err: any) {
      setError(err.message || "Failed to generate codebase journey");
    } finally {
      setLoading(false);
    }
  };

  const handleNextStep = () => {
    if (!activeJourney || currentStepIndex >= activeJourney.steps.length - 1) return;
    const nextIdx = currentStepIndex + 1;
    setCurrentStepIndex(nextIdx);
    const step = activeJourney.steps[nextIdx];
    onSelectStepCitation(step.file_path, step.start_line, step.end_line);
  };

  const handlePrevStep = () => {
    if (!activeJourney || currentStepIndex <= 0) return;
    const prevIdx = currentStepIndex - 1;
    setCurrentStepIndex(prevIdx);
    const step = activeJourney.steps[prevIdx];
    onSelectStepCitation(step.file_path, step.start_line, step.end_line);
  };

  const handleJumpToStep = (idx: number) => {
    if (!activeJourney || idx < 0 || idx >= activeJourney.steps.length) return;
    setCurrentStepIndex(idx);
    const step = activeJourney.steps[idx];
    onSelectStepCitation(step.file_path, step.start_line, step.end_line);
  };

  if (!isOpen) return null;

  // Active Journey Controller View
  if (activeJourney && activeJourney.steps.length > 0) {
    const currentStep = activeJourney.steps[currentStepIndex];
    const totalSteps = activeJourney.steps.length;
    const isFirst = currentStepIndex === 0;
    const isLast = currentStepIndex === totalSteps - 1;

    return (
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 w-[94%] max-w-2xl bg-panel/98 border border-borderDefault rounded-2xl shadow-elevated backdrop-blur-xl p-4 animate-slide-up">
        {/* Top bar: Topic & Progress */}
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-borderSubtle">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-accent-indigo/15 border border-accent-indigo/30 flex items-center justify-center text-accent-indigoLight shrink-0">
              <Route className="w-4 h-4" />
            </div>
            <div className="truncate">
              <span className="text-xs font-semibold text-zinc-100 truncate block">
                {activeJourney.topic}
              </span>
              <span className="text-[11px] text-zinc-400 truncate block">
                Step {currentStepIndex + 1} of {totalSteps}: {currentStep.title}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setActiveJourney(null);
                setCurrentStepIndex(0);
              }}
              className="px-2.5 py-1 rounded-lg bg-surface hover:bg-surfaceHover border border-borderSubtle text-[11px] text-zinc-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Pick a different flow"
            >
              <ListRestart className="w-3 h-3 text-accent-indigoLight" />
              <span>Change Flow</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-surfaceHover transition-colors cursor-pointer"
              title="Close Journey Player"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Step Breadcrumbs Track */}
        <div className="py-2.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {activeJourney.steps.map((step, idx) => {
            const isCurrent = idx === currentStepIndex;
            const isPast = idx < currentStepIndex;

            return (
              <button
                key={step.step_number}
                onClick={() => handleJumpToStep(idx)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono shrink-0 transition-all cursor-pointer ${
                  isCurrent
                    ? "bg-accent-indigo text-white font-semibold shadow-glowIndigo"
                    : isPast
                    ? "bg-surface text-zinc-300 border border-borderSubtle hover:border-borderDefault"
                    : "bg-workspace text-zinc-500 border border-borderSubtle/60 hover:text-zinc-300"
                }`}
              >
                <span>{step.step_number}</span>
                <span className="truncate max-w-[100px]">{step.file_path.split("/").pop()}</span>
              </button>
            );
          })}
        </div>

        {/* Step Explanation Card */}
        <div className="mt-1 p-3.5 rounded-xl bg-surface/80 border border-borderSubtle space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-accent-indigoLight flex items-center gap-1.5">
              <span>{currentStep.title}</span>
              {currentStep.symbol_name && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-surfaceElevated text-zinc-300 font-mono border border-borderSubtle">
                  {currentStep.symbol_name}
                </span>
              )}
            </span>

            {/* Clickable Citation Pill */}
            <button
              onClick={() =>
                onSelectStepCitation(
                  currentStep.file_path,
                  currentStep.start_line,
                  currentStep.end_line
                )
              }
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-accent-indigo/10 hover:bg-accent-indigo/25 text-accent-indigoLight border border-accent-indigo/30 text-[11px] font-mono transition-colors cursor-pointer"
              title="Click to view code in Monaco Editor"
            >
              <FileCode className="w-3 h-3" />
              <span>
                {currentStep.file_path.split("/").pop()}:{currentStep.start_line}-
                {currentStep.end_line}
              </span>
            </button>
          </div>

          <p className="text-xs text-zinc-300 leading-relaxed font-sans">
            {currentStep.explanation}
          </p>

          {currentStep.outgoing_target && (
            <div className="text-[11px] font-mono text-zinc-400 flex items-center gap-1.5 pt-1.5 border-t border-borderSubtle">
              <span className="text-accent-indigoLight font-semibold">Next Flow:</span>
              <span>Dispatches to `{currentStep.outgoing_target}`</span>
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between gap-3 mt-3 pt-2">
          <button
            onClick={handlePrevStep}
            disabled={isFirst}
            className="px-3.5 py-1.5 rounded-xl bg-surface hover:bg-surfaceHover border border-borderSubtle text-xs text-zinc-300 hover:text-white flex items-center gap-1.5 transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Previous Step</span>
          </button>

          <span className="text-[11px] text-zinc-500 font-mono">
            Step {currentStepIndex + 1} of {totalSteps}
          </span>

          <button
            onClick={handleNextStep}
            disabled={isLast}
            className="px-4 py-1.5 rounded-xl bg-accent-indigo hover:bg-accent-indigoLight text-xs font-semibold text-white flex items-center gap-1.5 shadow-glowIndigo transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
          >
            <span>Next Step</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // Journey Selection Modal / Drawer View
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-xl bg-panel border border-borderDefault rounded-2xl shadow-elevated overflow-hidden p-6 space-y-5 animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-borderSubtle">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-accent-indigo/15 border border-accent-indigo/30 flex items-center justify-center text-accent-indigoLight">
              <Route className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <span>Journey Through the Codebase</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-surface text-zinc-400 border border-borderSubtle font-mono">
                  Interactive Tours
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Trace real execution paths step-by-step: UI → Route → Service → DB
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-surfaceHover transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Custom Flow Search Input */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-zinc-300">
            What execution flow would you like to trace?
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && topicInput.trim()) {
                  handleStartJourney(topicInput);
                }
              }}
              placeholder="e.g. How does authentication work? or Data Ingestion Flow"
              className="flex-1 bg-surface border border-borderSubtle rounded-xl px-3.5 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-borderFocus font-mono transition-colors"
            />
            <button
              onClick={() => handleStartJourney(topicInput)}
              disabled={loading || !topicInput.trim()}
              className="px-4 py-2 rounded-xl bg-accent-indigo hover:bg-accent-indigoLight text-xs font-semibold text-white flex items-center gap-1.5 shadow-glowIndigo transition-all disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" />
              )}
              <span>Start</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-mono">
            {error}
          </div>
        )}

        {/* Suggested Journeys for this Repo */}
        <div className="space-y-2.5 pt-2">
          <span className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-accent-indigoLight" />
            <span>Recommended Journeys for {repoName}:</span>
          </span>

          <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-1">
            {suggestedJourneys.map((item, idx) => (
              <button
                key={idx}
                disabled={loading}
                onClick={() => handleStartJourney(item.topic)}
                className="text-left p-3.5 rounded-xl bg-surface hover:bg-surfaceHover border border-borderSubtle hover:border-accent-indigo/40 transition-all group flex items-start justify-between gap-3 cursor-pointer shadow-card"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-zinc-200 group-hover:text-accent-indigoLight transition-colors">
                      {item.topic}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-surfaceElevated text-zinc-400 border border-borderSubtle font-mono">
                      {item.category}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 line-clamp-2">
                    {item.description}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-accent-indigoLight group-hover:translate-x-0.5 transition-all shrink-0 mt-0.5" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

