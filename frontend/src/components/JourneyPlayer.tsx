"use client";

import React, { useEffect, useState } from "react";
import {
  X,
  Play,
  Loader2,
  Sparkles,
  Route,
  ChevronRight,
} from "lucide-react";
import { generateJourney, getSuggestedJourneys } from "@/lib/api";
import { JourneyResponse, SuggestedJourneyItem } from "@/types";
import { JourneyStepHud } from "@/components/journey/JourneyStepHud";

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
    return (
      <JourneyStepHud
        activeJourney={activeJourney}
        currentStepIndex={currentStepIndex}
        onClose={onClose}
        onResetJourney={() => {
          setActiveJourney(null);
          setCurrentStepIndex(0);
        }}
        onJumpToStep={handleJumpToStep}
        onPrevStep={handlePrevStep}
        onNextStep={handleNextStep}
        onSelectStepCitation={onSelectStepCitation}
      />
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

