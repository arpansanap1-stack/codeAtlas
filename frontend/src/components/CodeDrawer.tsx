"use client";

import React, { useEffect, useRef, useState } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import { X, ExternalLink, ArrowDownRight, ArrowUpRight, Copy, Check, Loader2 } from "lucide-react";
import { getFileContent } from "@/lib/api";
import { GraphData } from "@/types";

interface CodeDrawerProps {
  repoId: string;
  filePath: string | null;
  graphData: GraphData;
  onClose: () => void;
  onNavigateFile: (path: string) => void;
  targetLineRange?: [number, number] | null;
}

function getLanguageFromPath(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "ts":
    case "tsx":
      return "typescript";
    case "js":
    case "jsx":
      return "javascript";
    case "py":
      return "python";
    case "json":
      return "json";
    case "html":
      return "html";
    case "css":
      return "css";
    case "md":
      return "markdown";
    case "sql":
      return "sql";
    case "yaml":
    case "yml":
      return "yaml";
    default:
      return "plaintext";
  }
}

export function CodeDrawer({
  repoId,
  filePath,
  graphData,
  onClose,
  onNavigateFile,
  targetLineRange,
}: CodeDrawerProps) {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const decorationsRef = useRef<any>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Fetch file content when filePath changes
  useEffect(() => {
    if (!filePath || !repoId) return;

    let isCancelled = false;
    setLoading(true);
    setError(null);

    getFileContent(repoId, filePath)
      .then((res) => {
        if (!isCancelled) {
          setContent(res.content);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          setError(err.message || "Failed to load file content");
          setLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [repoId, filePath]);

  // Apply line highlight and scroll to range
  const applyHighlights = (start?: number, end?: number) => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;

    if (start && end) {
      if (decorationsRef.current) {
        decorationsRef.current.clear();
      }

      decorationsRef.current = editor.createDecorationsCollection([
        {
          range: new monaco.Range(start, 1, end, 1),
          options: {
            isWholeLine: true,
            className: "bg-sky-500/20 border-l-2 border-sky-400",
            marginClassName: "bg-sky-500/30",
          },
        },
      ]);

      editor.revealLineInCenter(start);
    } else if (decorationsRef.current) {
      decorationsRef.current.clear();
    }
  };

  useEffect(() => {
    if (targetLineRange && targetLineRange[0] && targetLineRange[1]) {
      applyHighlights(targetLineRange[0], targetLineRange[1]);
    }
  }, [targetLineRange, content]);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    if (targetLineRange && targetLineRange[0] && targetLineRange[1]) {
      applyHighlights(targetLineRange[0], targetLineRange[1]);
    }
  };

  // Find incoming and outgoing edges for the current file
  const incomingFiles = graphData.edges
    .filter((e) => e.target === filePath)
    .map((e) => e.source);

  const outgoingFiles = graphData.edges
    .filter((e) => e.source === filePath)
    .map((e) => e.target);

  const handleCopy = () => {
    if (!content) return;
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!filePath) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full sm:w-[620px] md:w-[700px] lg:w-[800px] bg-zinc-950/95 backdrop-blur-xl border-l border-zinc-800 shadow-2xl flex flex-col transition-all duration-300">
      {/* Drawer Header */}
      <div className="p-4 border-b border-zinc-800/80 flex items-center justify-between gap-3 bg-zinc-900/60">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700/60">
            {getLanguageFromPath(filePath).toUpperCase()}
          </span>
          <h2
            className="text-xs font-mono font-medium text-zinc-100 truncate"
            title={filePath}
          >
            {filePath}
          </h2>
          {targetLineRange && (
            <span className="text-xs font-mono text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/20 shrink-0">
              Lines {targetLineRange[0]}-{targetLineRange[1]}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            title="Copy file contents"
          >
            {copied ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            title="Close drawer (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Dependency Links Bar */}
      {(incomingFiles.length > 0 || outgoingFiles.length > 0) && (
        <div className="px-4 py-2 bg-zinc-900/40 border-b border-zinc-800/60 flex flex-wrap gap-3 text-[11px] font-mono">
          {incomingFiles.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-zinc-500 flex items-center">
                <ArrowDownRight className="w-3 h-3 text-emerald-400 mr-1" />
                Imported by:
              </span>
              {incomingFiles.map((src) => (
                <button
                  key={src}
                  onClick={() => onNavigateFile(src)}
                  className="px-1.5 py-0.5 rounded bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors truncate max-w-[180px]"
                  title={src}
                >
                  {src.split("/").pop()}
                </button>
              ))}
            </div>
          )}

          {outgoingFiles.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-zinc-500 flex items-center">
                <ArrowUpRight className="w-3 h-3 text-sky-400 mr-1" />
                Imports:
              </span>
              {outgoingFiles.map((tgt) => (
                <button
                  key={tgt}
                  onClick={() => onNavigateFile(tgt)}
                  className="px-1.5 py-0.5 rounded bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors truncate max-w-[180px]"
                  title={tgt}
                >
                  {tgt.split("/").pop()}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Monaco Code Viewer */}
      <div className="relative flex-1 bg-[#1e1e1e] overflow-hidden">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-zinc-400 text-xs font-mono bg-zinc-950/80 backdrop-blur-sm z-10">
            <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
            <span>Loading file content...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-xs font-mono text-rose-400">
            {error}
          </div>
        ) : (
          <Editor
            height="100%"
            language={getLanguageFromPath(filePath)}
            theme="vs-dark"
            value={content}
            options={{
              readOnly: true,
              domReadOnly: true,
              minimap: { enabled: true },
              fontSize: 12.5,
              fontFamily: "var(--font-mono), monospace",
              lineNumbers: "on",
              renderLineHighlight: "all",
              scrollBeyondLastLine: false,
              automaticLayout: true,
              wordWrap: "on",
              padding: { top: 12 },
            }}
            onMount={handleEditorDidMount}
          />
        )}
      </div>
    </div>
  );
}

