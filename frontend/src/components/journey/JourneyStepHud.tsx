"use client";

import React from "react";
import {
  Route,
  ListRestart,
  X,
  FileCode,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { JourneyResponse } from "@/types";

interface JourneyStepHudProps {
  activeJourney: JourneyResponse;
  currentStepIndex: number;
  onClose: () => void;
  onResetJourney: () => void;
  onJumpToStep: (idx: number) => void;
  onPrevStep: () => void;
  onNextStep: () => void;
  onSelectStepCitation: (
    filePath: string,
    startLine: number,
    endLine: number
  ) => void;
}

export function JourneyStepHud({
  activeJourney,
  currentStepIndex,
  onClose,
  onResetJourney,
  onJumpToStep,
  onPrevStep,
  onNextStep,
  onSelectStepCitation,
}: JourneyStepHudProps) {
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
            onClick={onResetJourney}
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
              onClick={() => onJumpToStep(idx)}
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
          onClick={onPrevStep}
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
          onClick={onNextStep}
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
