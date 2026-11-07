import {
  ArchitectureExplanationResponse,
  ArchitectureLevel,
  CodebaseHealthReportResponse,
  CodebaseHealthResponse,
  DebugResponse,
  FileContentResponse,
  FileGitIntelligenceResponse,
  GeminiKeyResponse,
  GeminiSettingsResponse,
  GraphData,
  HealthResponse,
  ImpactAnalysisResponse,
  JourneyResponse,
  OnboardingDocResponse,
  RepoIngestResponse,
  SuggestedJourneysResponse,
} from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export function normalizeGitHubUrl(url: string): string {
  let clean = url.trim();
  if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
    clean = "https://" + clean;
  }
  clean = clean.split("?")[0].split("#")[0];

  const match = clean.match(
    /https?:\/\/(?:www\.)?github\.com\/([a-zA-Z0-9_\-\.]+)\/([a-zA-Z0-9_\-\.]+)/i
  );
  if (match) {
    const owner = match[1];
    let repo = match[2];
    if (repo.endsWith(".git")) repo = repo.slice(0, -4);
    repo = repo.replace(/\/+$/, "");
    return `https://github.com/${owner}/${repo}`;
  }
  return clean;
}

export async function ingestRepository(repoUrl: string): Promise<RepoIngestResponse> {
  const normalized = normalizeGitHubUrl(repoUrl);
  const res = await fetch(`${API_BASE}/api/repos/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repo_url: normalized }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: "Ingestion failed" }));
    let errorMsg = "Failed to ingest repository";
    if (typeof errorData.detail === "string") {
      errorMsg = errorData.detail;
    } else if (Array.isArray(errorData.detail) && errorData.detail.length > 0) {
      errorMsg = errorData.detail.map((d: any) => d.msg || JSON.stringify(d)).join("; ");
    }
    throw new Error(errorMsg);
  }

  return res.json();
}

export async function getRepository(repoId: string) {
  const res = await fetch(`${API_BASE}/api/repos/${repoId}`);
  if (!res.ok) throw new Error("Failed to fetch repository metadata");
  return res.json();
}

export async function getRepositoryGraph(repoId: string): Promise<GraphData> {
  const res = await fetch(`${API_BASE}/api/repos/${repoId}/graph`);
  if (!res.ok) throw new Error("Failed to fetch dependency graph");
  const data = await res.json();
  return data.graph_data;
}

export async function getFileContent(
  repoId: string,
  filePath: string
): Promise<FileContentResponse> {
  const params = new URLSearchParams({ path: filePath });
  const res = await fetch(`${API_BASE}/api/repos/${repoId}/file?${params}`);
  if (!res.ok) throw new Error(`Failed to load file: ${filePath}`);
  return res.json();
}

export async function getOnboardingDocs(repoId: string): Promise<OnboardingDocResponse> {
  const res = await fetch(`${API_BASE}/api/repos/${repoId}/onboarding`);
  if (!res.ok) throw new Error("Failed to fetch onboarding documentation");
  return res.json();
}

export async function getHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) throw new Error("Backend health check failed");
  return res.json();
}

export async function getGeminiSettings(): Promise<GeminiSettingsResponse> {
  const res = await fetch(`${API_BASE}/api/settings/gemini`);
  if (!res.ok) throw new Error("Failed to fetch Gemini settings");
  return res.json();
}

export async function getArchitectureExplanation(
  repoId: string,
  level: ArchitectureLevel = "intermediate"
): Promise<ArchitectureExplanationResponse> {
  const params = new URLSearchParams({ level });
  const res = await fetch(`${API_BASE}/api/repos/${repoId}/explanation?${params}`);
  if (!res.ok) throw new Error("Failed to generate architecture explanation");
  return res.json();
}

export async function getSuggestedJourneys(
  repoId: string
): Promise<SuggestedJourneysResponse> {
  const res = await fetch(`${API_BASE}/api/repos/${repoId}/journeys`);
  if (!res.ok) throw new Error("Failed to fetch suggested journeys");
  return res.json();
}

export async function generateJourney(
  repoId: string,
  topic: string
): Promise<JourneyResponse> {
  const res = await fetch(`${API_BASE}/api/repos/${repoId}/journey`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: "Failed to generate journey" }));
    throw new Error(errorData.detail || "Failed to generate code journey");
  }
  return res.json();
}

export async function debugError(
  repoId: string,
  errorMessage: string,
  contextHint?: string
): Promise<DebugResponse> {
  const res = await fetch(`${API_BASE}/api/repos/${repoId}/debug`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      error_message: errorMessage,
      context_hint: contextHint || null,
    }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: "Failed to diagnose error" }));
    throw new Error(errorData.detail || "Failed to analyze error");
  }
  return res.json();
}

export async function getImpactAnalysis(
  repoId: string,
  filePath: string
): Promise<ImpactAnalysisResponse> {
  const params = new URLSearchParams({ file_path: filePath });
  const res = await fetch(`${API_BASE}/api/repos/${repoId}/impact?${params}`);

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: "Failed to analyze impact" }));
    throw new Error(errorData.detail || "Failed to calculate impact analysis");
  }
  return res.json();
}

export async function getCodebaseHealth(
  repoId: string
): Promise<CodebaseHealthResponse> {
  const res = await fetch(`${API_BASE}/api/repos/${repoId}/health-metrics`);

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: "Failed to evaluate codebase health" }));
    throw new Error(errorData.detail || "Failed to evaluate codebase health metrics");
  }
  return res.json();
}

export async function getCodebaseHealthReport(
  repoId: string
): Promise<CodebaseHealthReportResponse> {
  const res = await fetch(`${API_BASE}/api/repos/${repoId}/health-report`);

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: "Failed to generate health report" }));
    throw new Error(errorData.detail || "Failed to generate codebase health report");
  }
  return res.json();
}

export async function getFileGitHistory(
  repoId: string,
  filePath: string
): Promise<FileGitIntelligenceResponse> {
  const params = new URLSearchParams({ file_path: filePath });
  const res = await fetch(`${API_BASE}/api/repos/${repoId}/git-history?${params}`);

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: "Failed to load git history" }));
    throw new Error(errorData.detail || "Failed to evaluate git history intelligence");
  }
  return res.json();
}





