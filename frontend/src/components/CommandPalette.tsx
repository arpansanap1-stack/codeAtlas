"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Search, X, ArrowRight } from "lucide-react";
import { GraphNode } from "@/types";
import {
  CommandItem,
  ModalType,
  buildCommandList,
} from "@/components/command/defaultCommands";

export type { CommandItem };

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: string) => void;
  nodes?: GraphNode[];
  onSelectFile?: (filePath: string) => void;
  onOpenModal: (modal: ModalType) => void;
}

export function CommandPalette({
  isOpen,
  onClose,
  onNavigateTab,
  nodes = [],
  onSelectFile,
  onOpenModal,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const commands = useMemo<CommandItem[]>(
    () =>
      buildCommandList({
        nodes,
        onNavigateTab,
        onOpenModal,
        onSelectFile,
      }),
    [nodes, onNavigateTab, onOpenModal, onSelectFile]
  );

  // Filter commands
  const filteredCommands = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (cmd) =>
        cmd.title.toLowerCase().includes(q) ||
        (cmd.subtitle && cmd.subtitle.toLowerCase().includes(q)) ||
        cmd.category.toLowerCase().includes(q)
    );
  }, [commands, query]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredCommands.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredCommands.length - 1
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].onSelect();
          onClose();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, onClose]);

  // Auto-scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.querySelector(
        `[data-index="${selectedIndex}"]`
      );
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 bg-black/60 backdrop-blur-md animate-fade-in">
      <div
        className="w-full max-w-xl bg-panel border border-borderDefault rounded-xl shadow-elevated overflow-hidden animate-scale-in flex flex-col max-h-[520px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="relative flex items-center px-4 py-3.5 border-b border-borderSubtle bg-surface">
          <Search className="w-4 h-4 text-zinc-400 mr-3 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command or search files... (e.g., 'journeys', 'health', '.py')"
            className="w-full bg-transparent text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none font-sans"
          />
          {query ? (
            <button
              onClick={() => setQuery("")}
              className="text-zinc-500 hover:text-zinc-300 p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-zinc-400 bg-surfaceElevated border border-borderSubtle rounded">
              ESC
            </kbd>
          )}
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto p-2 space-y-1 divide-y divide-borderSubtle/40"
        >
          {filteredCommands.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 text-xs font-mono">
              No commands or files matching "{query}"
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const Icon = cmd.icon;
              const isSelected = idx === selectedIndex;

              return (
                <button
                  key={cmd.id}
                  data-index={idx}
                  onClick={() => {
                    cmd.onSelect();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors duration-100 group ${
                    isSelected
                      ? "bg-accent-indigo/15 text-white"
                      : "text-zinc-300 hover:bg-surfaceHover/60"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? "bg-accent-indigo text-white shadow-glowIndigo"
                          : "bg-surface border border-borderSubtle text-zinc-400 group-hover:text-zinc-200"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-medium truncate flex items-center gap-2">
                        <span>{cmd.title}</span>
                        {cmd.badge && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-surfaceElevated text-zinc-400 border border-borderSubtle">
                            {cmd.badge}
                          </span>
                        )}
                      </div>
                      {cmd.subtitle && (
                        <div className="text-[11px] text-zinc-500 truncate mt-0.5">
                          {cmd.subtitle}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 px-1.5 py-0.5 rounded bg-surface/80 border border-borderSubtle">
                      {cmd.category}
                    </span>
                    {isSelected && (
                      <ArrowRight className="w-3.5 h-3.5 text-accent-indigoLight animate-pulse" />
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Command Palette Footer */}
        <div className="px-4 py-2 border-t border-borderSubtle bg-panel flex items-center justify-between text-[11px] font-mono text-zinc-500">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1 py-0.5 bg-surface border border-borderSubtle rounded text-zinc-400">
                ↑
              </kbd>{" "}
              <kbd className="px-1 py-0.5 bg-surface border border-borderSubtle rounded text-zinc-400">
                ↓
              </kbd>{" "}
              Navigate
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-surface border border-borderSubtle rounded text-zinc-400">
                ↵
              </kbd>{" "}
              Select
            </span>
          </div>
          <span className="text-zinc-500">CodeAtlas Intelligence</span>
        </div>
      </div>
    </div>
  );
}
