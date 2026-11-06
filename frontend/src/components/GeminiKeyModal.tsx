"use client";

import React, { useEffect, useState } from "react";
import { getGeminiSettings } from "@/lib/api";
import { GeminiSettingsResponse } from "@/types";

export default function GeminiStatusBadge() {
  const [settings, setSettings] = useState<GeminiSettingsResponse | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const data = await getGeminiSettings();
        setSettings(data);
      } catch (err) {
        // Backend offline or starting
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const isConfigured = settings?.configured ?? false;

  return (
    <div
      className={`inline-flex items-center gap-2 px-2.5 py-1 text-xs font-medium rounded-full border transition-all select-none ${
        isConfigured
          ? "bg-emerald-950/40 border-emerald-700/60 text-emerald-300 shadow-sm shadow-emerald-950"
          : "bg-zinc-900 border-zinc-800 text-zinc-400 shadow-sm"
      }`}
      title={
        isConfigured
          ? `Gemini AI Connected (${settings?.chat_model || "gemini-flash-lite-latest"})`
          : "Gemini API key not configured in backend/.env"
      }
    >
      <span
        className={`h-2 w-2 rounded-full ${
          isConfigured ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"
        }`}
      />
      <span className="font-mono text-[11px]">
        {isConfigured ? "Gemini AI Active" : "Offline Mode"}
      </span>
      {isConfigured && (
        <span className="text-[10px] text-emerald-500/80 font-mono hidden sm:inline">
          ({settings?.chat_model || "flash-lite"})
        </span>
      )}
    </div>
  );
}
