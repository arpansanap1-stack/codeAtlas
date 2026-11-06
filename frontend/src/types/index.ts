export type RepoStatus =
  | "pending"
  | "cloning"
  | "parsing"
  | "indexing"
  | "completed"
  | "failed";

export interface RepoIngestResponse {
  repo_id: string;
  repo_url: string;
  repo_name: string;
  status: RepoStatus;
  file_count: number;
  total_size_bytes: number;
  chunk_count: number;
  graph_nodes_count: number;
  graph_edges_count: number;
  directory_tree: string;
  message: string;
}

export interface GraphNode {
  id: string; // file_path
  label: string; // filename
  folder: string; // parent directory
  in_degree: number;
  out_degree: number;
  summary: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface FileContentResponse {
  repo_id: string;
  file_path: string;
  content: string;
}

export interface CodeChunk {
  file_path: string;
  symbol_name: string;
  chunk_type: string;
  start_line: number;
  end_line: number;
  content: string;
}

export interface OnboardingDocResponse {
  repo_id: string;
  markdown_content: string;
  updated_at: string;
}

export interface HealthResponse {
  status: string;
  project: string;
  version: string;
  gemini_configured: boolean;
  supabase_configured: boolean;
  timestamp: string;
}

export interface GeminiSettingsResponse {
  configured: boolean;
  chat_model: string;
  embedding_model: string;
  masked_key: string | null;
}

export interface GeminiKeyResponse {
  status: string;
  message: string;
  configured: boolean;
  chat_model: string;
  embedding_model: string;
}

export type ArchitectureLevel = "beginner" | "intermediate" | "expert";

export interface ArchitectureExplanationResponse {
  repo_id: string;
  level: ArchitectureLevel;
  title: string;
  markdown_content: string;
  updated_at: string;
}

export interface JourneyStep {
  step_number: number;
  title: string;
  file_path: string;
  symbol_name?: string | null;
  start_line: number;
  end_line: number;
  explanation: string;
  outgoing_target?: string | null;
}

export interface JourneyResponse {
  repo_id: string;
  topic: string;
  summary: string;
  steps: JourneyStep[];
}

export interface SuggestedJourneyItem {
  topic: string;
  description: string;
  category: string;
}

export interface SuggestedJourneysResponse {
  repo_id: string;
  journeys: SuggestedJourneyItem[];
}


