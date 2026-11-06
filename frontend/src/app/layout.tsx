import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CodeAtlas — AI Codebase Explainer",
  description:
    "Explore, analyze, and understand complex codebases through AST dependency graphs, Hybrid RAG, and AI onboarding docs.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-workspace text-zinc-100 antialiased font-sans selection:bg-indigo-500/30 selection:text-white">
        {children}
      </body>
    </html>
  );
}
