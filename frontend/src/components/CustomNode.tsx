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
  journeyStepNumber?: number;
  isImpactTarget?: boolean;
  isImpactAffected?: boolean;
}

function getNodeCategoryStyle(filePath: string, folder: string) {
  const path = `${folder}/${filePath}`.toLowerCase();
  const ext = filePath.split(".").pop()?.toLowerCase();

  // 1. UI Components / Frontend (Indigo / Sky)
  if (
    ext === "tsx" ||
    ext === "jsx" ||
    path.includes("components") ||
    path.includes("ui") ||
    path.includes("views") ||
    path.includes("pages")
  ) {
    return {
      border: "border-indigo-500/35 hover:border-indigo-400/80",
      badge: "bg-indigo-500/10 text-indigo-300 border-indigo-500/25",
      accent: "text-indigo-400",
      glow: "hover:shadow-glowIndigo",
    };
  }

  // 2. Services / API / Backend Routes (Emerald)
  if (
    path.includes("service") ||
    path.includes("api") ||
    path.includes("router") ||
    path.includes("controller") ||
    path.includes("endpoints")
  ) {
    return {
      border: "border-emerald-500/35 hover:border-emerald-400/80",
      badge: "bg-emerald-500/10 text-emerald-300 border-emerald-500/25",
      accent: "text-emerald-400",
      glow: "hover:shadow-glowEmerald",
    };
  }

  // 3. Models / Schemas / Configs (Amber)
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
      border: "border-amber-500/35 hover:border-amber-400/80",
      badge: "bg-amber-500/10 text-amber-300 border-amber-500/25",
      accent: "text-amber-400",
      glow: "hover:shadow-amber-500/10",
    };
  }

  // 4. Database / Utils / Libs (Purple / Cyan)
  if (
    path.includes("db") ||
    path.includes("database") ||
    path.includes("util") ||
    path.includes("lib") ||
    path.includes("helper")
  ) {
    return {
      border: "border-purple-500/35 hover:border-purple-400/80",
      badge: "bg-purple-500/10 text-purple-300 border-purple-500/25",
      accent: "text-purple-400",
      glow: "hover:shadow-purple-500/10",
    };
  }

  // Default: Slate Neutral
  return {
    border: "border-borderDefault hover:border-borderFocus",
    badge: "bg-surface text-zinc-400 border-borderSubtle",
    accent: "text-zinc-400",
    glow: "",
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
        "relative group min-w-[210px] max-w-[280px] rounded-xl bg-panel/95 backdrop-blur-md p-3 border transition-all duration-200 shadow-card",
        style.border,
        style.glow,
        selected && "ring-2 ring-indigo-400 border-indigo-400 shadow-glowIndigo",
        data.isImpactTarget && "ring-2 ring-amber-400 border-amber-400 shadow-lg shadow-amber-500/20",
        data.isImpactAffected && "ring-1 ring-rose-500/80 border-rose-500/80 shadow-md shadow-rose-500/10",
        data.isDimmed && "opacity-20 grayscale scale-[0.98]"
      )}
    >
      {/* Journey Step Number Badge */}
      {typeof data.journeyStepNumber === "number" && (
        <div className="absolute -top-2.5 -right-2.5 px-2 py-0.5 rounded-full bg-accent-indigo text-white font-bold font-mono text-[10px] shadow-glowIndigo flex items-center gap-1 z-10 animate-bounce">
          <span>Step {data.journeyStepNumber}</span>
        </div>
      )}

      {/* Impact Target Badge */}
      {data.isImpactTarget && (
        <div className="absolute -top-2.5 -right-2.5 px-2 py-0.5 rounded-full bg-amber-500 text-zinc-950 font-bold font-mono text-[10px] shadow-lg shadow-amber-500/30 flex items-center gap-1 z-10">
          <span>Target</span>
        </div>
      )}

      {/* Impact Affected Badge */}
      {data.isImpactAffected && !data.isImpactTarget && (
        <div className="absolute -top-2.5 -right-2.5 px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 font-mono text-[10px] flex items-center gap-1 z-10">
          <span>Downstream</span>
        </div>
      )}

      {/* Input Handle (Left or Top) */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !bg-zinc-600 !border-panel group-hover:!bg-indigo-400 transition-colors"
      />

      {/* Header: Folder badge */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span
          className={cn(
            "text-[10px] font-mono tracking-tight px-1.5 py-0.5 rounded-md border max-w-[150px] truncate",
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
              <ArrowUpRight className="w-2.5 h-2.5 text-indigo-400 mr-0.5" />
              {data.out_degree}
            </span>
          )}
        </div>
      </div>

      {/* Main Filename */}
      <div className="flex items-center gap-2">
        <FileCode className={cn("w-4 h-4 shrink-0 transition-transform group-hover:scale-110", style.accent)} />
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
        className="!w-2.5 !h-2.5 !bg-zinc-600 !border-panel group-hover:!bg-indigo-400 transition-colors"
      />
    </div>
  );
});


