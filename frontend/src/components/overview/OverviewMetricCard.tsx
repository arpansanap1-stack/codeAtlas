import React from "react";

interface OverviewMetricCardProps {
  label: string;
  icon: React.ReactNode;
  value: string | number;
  subtext: string;
  badge?: {
    text: string;
    color: string;
  };
}

export function OverviewMetricCard({
  label,
  icon,
  value,
  subtext,
  badge,
}: OverviewMetricCardProps) {
  return (
    <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-1 hover:border-zinc-700 transition-colors shadow-sm">
      <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 flex items-center justify-between">
        <span>{label}</span>
        {icon}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-2xl font-bold font-mono text-zinc-100">{value}</span>
        {badge && (
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${badge.color}`}>
            {badge.text}
          </span>
        )}
      </div>
      <div className="text-[11px] font-mono text-zinc-500">{subtext}</div>
    </div>
  );
}
