import {
  FileContentResponse,
  GeminiKeyResponse,
  GeminiSettingsResponse,
  GraphData,
  HealthResponse,
  OnboardingDocResponse,
  RepoIngestResponse,
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

