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

export interface SuspiciousSnippet {
  file_path: string;
  start_line: number;
  end_line: number;
  symbol_name?: string | null;
  reason: string;
  code_snippet: string;
}

export interface DebugResponse {
  repo_id: string;
  error_type: string;
  root_cause_analysis: string;
  execution_path_explanation: string;
  suspicious_locations: SuspiciousSnippet[];
  suggested_fix: string;
  confidence_score: number;
}

export type ImpactRiskLevel = "low" | "moderate" | "high" | "critical";

export interface DependentModule {
  file_path: string;
  depth: number;
  is_direct: boolean;
  import_symbol?: string | null;
}

export interface ImpactAnalysisResponse {
  repo_id: string;
  target_file: string;
  risk_level: ImpactRiskLevel;
  blast_radius_score: number;
  direct_dependents: DependentModule[];
  indirect_dependents: DependentModule[];
  all_affected_file_paths: string[];
  summary: string;
  affected_subsystems: string[];
  recommendations: string[];
}

export type ArchitectureSmellType =
  | "circular_dependency"
  | "god_file"
  | "oversized_module"
  | "dead_module"
  | "tight_coupling";

export interface ArchitectureSmell {
  smell_type: ArchitectureSmellType;
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  affected_files: string[];
  refactoring_tip: string;
}

export interface LanguageMetric {
  language: string;
  file_count: number;
  percentage: number;
}

export interface ModuleMetric {
  file_path: string;
  metric_label: string;
  value: number;
  details?: string | null;
}

export interface CodebaseHealthResponse {
  repo_id: string;
  health_score: number;
  health_rating: string;
  total_files: number;
  total_lines: number;
  graph_density: number;
  languages: LanguageMetric[];
  largest_modules: ModuleMetric[];
  most_connected_files: ModuleMetric[];
  circular_dependencies: string[][];
  dead_files: string[];
  smells: ArchitectureSmell[];
  summary: string;
}




