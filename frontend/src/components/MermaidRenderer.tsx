"use client";

import React, { useEffect, useId, useState } from "react";
import mermaid from "mermaid";
import { AlertCircle } from "lucide-react";

interface MermaidRendererProps {
  code: string;
}

export function MermaidRenderer({ code }: MermaidRendererProps) {
  const uniqueId = useId().replace(/:/g, "mm_");
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    try {
      mermaid.initialize({
        startOnLoad: false,
        theme: "dark",
        securityLevel: "loose",
        fontFamily: "var(--font-mono), monospace",
        themeVariables: {
          darkMode: true,
          background: "#09090b",
          primaryColor: "#18181b",
          primaryBorderColor: "#38bdf8",
          primaryTextColor: "#f4f4f5",
          lineColor: "#52525b",
          secondaryColor: "#27272a",
          tertiaryColor: "#18181b",
        },
      });

      const cleanCode = code.trim();
      mermaid
        .render(`mermaid-${uniqueId}`, cleanCode)
        .then(({ svg }) => {
          if (isMounted) {
            setSvg(svg);
            setError(null);
          }
        })
        .catch((err) => {
          if (isMounted) {
            console.warn("Mermaid render warning:", err);
            setError(err?.message || "Invalid Mermaid syntax");
          }
        });
    } catch (e: any) {
      if (isMounted) {
        setError(e?.message || "Failed to initialize Mermaid");
      }
    }

    return () => {
      isMounted = false;
    };
  }, [code, uniqueId]);

  if (error) {
    return (
      <div className="my-4 p-4 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-mono">
        <div className="flex items-center gap-2 text-amber-400 mb-2">
          <AlertCircle className="w-4 h-4" />
          <span>Diagram Render Fallback</span>
        </div>
        <pre className="text-zinc-400 overflow-x-auto p-2 bg-zinc-950 rounded">
          {code}
        </pre>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="my-4 h-32 flex items-center justify-center rounded-lg bg-zinc-900/60 border border-zinc-800 text-xs font-mono text-zinc-500">
        Rendering architectural diagram...
      </div>
    );
  }

  return (
    <div
      className="my-6 p-4 rounded-xl bg-zinc-900/80 border border-zinc-800/80 overflow-x-auto flex justify-center shadow-md"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

