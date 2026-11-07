import React from "react";
import { FileCode } from "lucide-react";

const CITATION_REGEX = /\[([a-zA-Z0-9_\-\.\/]+):(\d+)-(\d+)\]/g;

export function renderWithCitations(
  text: string,
  onSelect: (filePath: string, start: number, end: number) => void
): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = CITATION_REGEX.exec(text)) !== null) {
    const [fullMatch, filePath, startStr, endStr] = match;
    const matchIndex = match.index;

    if (matchIndex > lastIndex) {
      parts.push(text.slice(lastIndex, matchIndex));
    }

    const startLine = parseInt(startStr, 10);
    const endLine = parseInt(endStr, 10);
    const fileName = filePath.split("/").pop() || filePath;

    parts.push(
      <button
        key={`${filePath}-${startLine}-${matchIndex}`}
        onClick={() => onSelect(filePath, startLine, endLine)}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-1 rounded-md bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 text-[11px] font-mono transition-colors group align-baseline cursor-pointer"
        title={`Inspect ${filePath} (Lines ${startLine}-${endLine})`}
      >
        <FileCode className="w-3 h-3 group-hover:scale-110 transition-transform" />
        <span>
          {fileName}:{startLine}-{endLine}
        </span>
      </button>
    );

    lastIndex = matchIndex + fullMatch.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}
