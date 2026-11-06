import React, { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { FileCode, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CustomNodeData extends Record<string, unknown> {
  id: string;
  label: string;
  folder: string;
  in_degree: number;
  out_degree: number;
  summary?: string;
  isDimmed?: boolean;
}

function getNodeCategoryStyle(filePath: string, folder: string) {
  const path = `${folder}/${filePath}`.toLowerCase();
  const ext = filePath.split(".").pop()?.toLowerCase();

  // 1. UI Components / Frontend (Muted Sky)
  if (
    ext === "tsx" ||
    ext === "jsx" ||
    path.includes("components") ||
    path.includes("ui") ||
    path.includes("views") ||
    path.includes("pages")
  ) {
    return {
      border: "border-sky-500/40 hover:border-sky-400",
      badge: "bg-sky-500/10 text-sky-400 border-sky-500/20",
      accent: "text-sky-400",
    };
  }

  // 2. Services / API / Backend Routes (Muted Emerald)
  if (
    path.includes("service") ||
    path.includes("api") ||
    path.includes("router") ||
    path.includes("controller") ||
    path.includes("endpoints")
  ) {
    return {
      border: "border-emerald-500/40 hover:border-emerald-400",
      badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      accent: "text-emerald-400",
    };
  }

  // 3. Models / Schemas / Configs (Muted Amber)
  if (
    path.includes("model") ||
    path.includes("schema") ||
    path.includes("config") ||
    ext === "json" ||
    ext === "yaml" ||
    ext === "yml" ||
    ext === "env" ||
    ext === "toml"
  ) {
    return {
      border: "border-amber-500/40 hover:border-amber-400",
      badge: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      accent: "text-amber-400",
    };
  }

  // 4. Database / Utils / Libs (Muted Violet)
  if (
    path.includes("db") ||
    path.includes("database") ||
    path.includes("util") ||
    path.includes("lib") ||
    path.includes("helper")
  ) {
    return {
      border: "border-purple-500/40 hover:border-purple-400",
      badge: "bg-purple-500/10 text-purple-400 border-purple-500/20",
      accent: "text-purple-400",
    };
  }

  // Default: Dark Zinc
  return {
    border: "border-zinc-800 hover:border-zinc-700",
    badge: "bg-zinc-800 text-zinc-400 border-zinc-700/50",
    accent: "text-zinc-400",
  };
}

export const CustomNode = memo(function CustomNode({
  data,
  selected,
}: {
  data: CustomNodeData;
  selected?: boolean;
}) {
  const style = getNodeCategoryStyle(data.label, data.folder);

  return (
    <div
      className={cn(
        "relative group min-w-[210px] max-w-[280px] rounded-lg bg-zinc-900/90 backdrop-blur-sm p-3 border transition-all duration-200 shadow-md",
        style.border,
        selected && "ring-2 ring-sky-400/80 border-sky-400 shadow-lg shadow-sky-500/10",
        data.isDimmed && "opacity-25 grayscale"
      )}
    >
      {/* Input Handle (Left or Top) */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2 !h-2 !bg-zinc-500 !border-zinc-900 group-hover:!bg-sky-400 transition-colors"
      />

      {/* Header: Folder badge */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span
          className={cn(
            "text-[10px] font-mono tracking-tight px-1.5 py-0.5 rounded border max-w-[150px] truncate",
            style.badge
          )}
          title={data.folder || "root"}
        >
          {data.folder ? `${data.folder}/` : "./"}
        </span>

        {/* Dependency Count Badges */}
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-400">
          {data.in_degree > 0 && (
            <span
              className="flex items-center text-zinc-400"
              title={`Imported by ${data.in_degree} files`}
            >
              <ArrowDownRight className="w-2.5 h-2.5 text-emerald-400 mr-0.5" />
              {data.in_degree}
            </span>
          )}
          {data.out_degree > 0 && (
            <span
              className="flex items-center text-zinc-400"
              title={`Imports ${data.out_degree} files`}
            >
              <ArrowUpRight className="w-2.5 h-2.5 text-sky-400 mr-0.5" />
              {data.out_degree}
            </span>
          )}
        </div>
      </div>

      {/* Main Filename */}
      <div className="flex items-center gap-2">
        <FileCode className={cn("w-4 h-4 shrink-0", style.accent)} />
        <span
          className="text-xs font-mono font-medium text-zinc-200 truncate group-hover:text-white"
          title={data.label}
        >
          {data.label}
        </span>
      </div>

      {/* Output Handle (Right or Bottom) */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2 !h-2 !bg-zinc-500 !border-zinc-900 group-hover:!bg-sky-400 transition-colors"
      />
    </div>
  );
});

