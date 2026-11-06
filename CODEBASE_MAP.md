# 🗺️ CodeAtlas Codebase Map & Architectural Index

> **Notice to AI Agents & Developers:**  
> **DO NOT scan or read the entire repository file-by-file.**  
> Consult this map first. Identify the target subsystem and read **only** the specific files listed below.

---

## 🎯 Fast Task Router (Where to Look)

| If you want to... | Inspect / Modify these files | Key symbols & functions |
| :--- | :--- | :--- |
| **Add or modify a REST / SSE API route** | [`backend/app/main.py`](file:///c:/Users/arpan/codeAtlas/backend/app/main.py)<br>[`backend/app/models/schemas.py`](file:///c:/Users/arpan/codeAtlas/backend/app/models/schemas.py) | `app`, route handlers (`/api/...`), Pydantic models |
| **Change Git cloning or file filtering rules** | [`backend/app/services/git_service.py`](file:///c:/Users/arpan/codeAtlas/backend/app/services/git_service.py) | `GitService.clone_repository`, `filter_and_index_files` |
| **Modify AST code chunking / symbol extraction** | [`backend/app/services/ast_service.py`](file:///c:/Users/arpan/codeAtlas/backend/app/services/ast_service.py) | `ASTService.chunk_repository`, Tree-sitter parsers, sliding-window fallback |
| **Change static import resolution / dependency graph** | [`backend/app/services/graph_service.py`](file:///c:/Users/arpan/codeAtlas/backend/app/services/graph_service.py) | `GraphService.build_dependency_graph`, import regex/AST walkers |
| **Update Gemini embeddings or vector search** | [`backend/app/services/embedding_service.py`](file:///c:/Users/arpan/codeAtlas/backend/app/services/embedding_service.py)<br>[`backend/app/db/supabase.py`](file:///c:/Users/arpan/codeAtlas/backend/app/db/supabase.py) | `EmbeddingService.process_and_index_chunks`, `search_similar_chunks`, RRF |
| **Tune RAG chat prompt, citations, or SSE stream** | [`backend/app/services/chat_service.py`](file:///c:/Users/arpan/codeAtlas/backend/app/services/chat_service.py) | `ChatService.stream_chat_response`, `expand_graph_context` |
| **Update Onboarding markdown synthesis or Mermaid** | [`backend/app/services/onboarding_service.py`](file:///c:/Users/arpan/codeAtlas/backend/app/services/onboarding_service.py)<br>[`frontend/src/components/OnboardingView.tsx`](file:///c:/Users/arpan/codeAtlas/frontend/src/components/OnboardingView.tsx) | `generate_onboarding_documentation`, `MermaidRenderer` |
| **Modify React Flow canvas, node physics, or layout** | [`frontend/src/components/ArchitectureMap.tsx`](file:///c:/Users/arpan/codeAtlas/frontend/src/components/ArchitectureMap.tsx)<br>[`frontend/src/components/CustomNode.tsx`](file:///c:/Users/arpan/codeAtlas/frontend/src/components/CustomNode.tsx) | `ArchitectureMap`, Dagre layout engine, custom node styling |
| **Change Monaco editor code viewer / line highlight** | [`frontend/src/components/CodeDrawer.tsx`](file:///c:/Users/arpan/codeAtlas/frontend/src/components/CodeDrawer.tsx) | `CodeDrawer`, Monaco `deltaDecorations`, `revealLineInCenter` |
| **Update Chat drawer UI or citation button handling** | [`frontend/src/components/ChatPanel.tsx`](file:///c:/Users/arpan/codeAtlas/frontend/src/components/ChatPanel.tsx) | `ChatPanel`, SSE reader, citation regex parser |
| **Add / edit Frontend API client methods** | [`frontend/src/lib/api.ts`](file:///c:/Users/arpan/codeAtlas/frontend/src/lib/api.ts) | `apiClient` (`ingestRepo`, `getGraph`, `streamChat`, etc.) |
| **Add / edit shared TypeScript types** | [`frontend/src/types/index.ts`](file:///c:/Users/arpan/codeAtlas/frontend/src/types/index.ts) | `RepoIngestResponse`, `GraphNode`, `GraphEdge`, `CodeChunk` |
| **Change Workspace layout or cross-component sync** | [`frontend/src/app/repo/[id]/page.tsx`](file:///c:/Users/arpan/codeAtlas/frontend/src/app/repo/[id]/page.tsx) | `WorkspacePage`, shared state: `selectedNodeId`, `activeCitation` |

---

## 🏛️ System Architecture & Subsystems

```
codeAtlas/
├── backend/                  # FastAPI 0.115+, Python 3.11+, Uvicorn
│   ├── app/
│   │   ├── config.py         # Settings & environment variables (BaseSettings)
│   │   ├── main.py           # FastAPI entrypoint, CORS, route registry
│   │   ├── db/
│   │   │   └── supabase.py   # PostgreSQL/pgvector client + offline fallback DB
│   │   ├── models/
│   │   │   └── schemas.py    # Pydantic v2 validation models & URL normalizer
│   │   └── services/
│   │       ├── ast_service.py        # Tree-sitter & Python AST chunker
│   │       ├── chat_service.py       # SSE streaming RAG Q&A engine
│   │       ├── embedding_service.py  # Gemini text-embedding-004 embedder
│   │       ├── git_service.py        # Shallow clone, filter, tree generator
│   │       ├── graph_service.py      # Import resolver & React Flow graph builder
│   │       └── onboarding_service.py # ONBOARDING.md doc generator
│   ├── tests/                # Pytest unit & integration test suite
│   ├── requirements.txt      # Backend Python dependencies
│   └── schema.sql            # PostgreSQL + pgvector schema & RRF RPC
│
├── frontend/                 # Next.js 15 (App Router), React 19, Tailwind CSS
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx              # Landing page (URL input, sample repos)
│   │   │   ├── repo/[id]/page.tsx    # Main interactive workspace
│   │   │   ├── layout.tsx            # Root layout with Inter font
│   │   │   └── globals.css           # Tailwind base styles
│   │   ├── components/
│   │   │   ├── ArchitectureMap.tsx   # React Flow canvas + Dagre auto-layout
│   │   │   ├── CustomNode.tsx        # Styled node with category badges & degree count
│   │   │   ├── ChatPanel.tsx         # SSE streaming chat with citation pills
│   │   │   ├── CodeDrawer.tsx        # Monaco editor slide-over with line highlights
│   │   │   ├── OnboardingView.tsx    # Onboarding documentation renderer & export
│   │   │   ├── MermaidRenderer.tsx   # Live Mermaid SVG renderer
│   │   │   └── GeminiKeyModal.tsx    # API key setup modal
│   │   ├── lib/
│   │   │   ├── api.ts                # Strongly-typed fetch API client
│   │   │   └── utils.ts              # Tailwind clsx + twMerge utility
│   │   └── types/
│   │       └── index.ts              # TypeScript interface definitions
│   ├── package.json          # Frontend dependencies
│   └── tsconfig.json         # TypeScript compiler configuration
```

---

## 🔄 Cross-Component Synchronization (Critical Flow)

Understanding this prevents having to inspect multiple frontend files:

1. **User asks question in `ChatPanel`**:
   - `ChatPanel` calls `POST /api/repos/{id}/chat` via SSE (`apiClient.streamChat`).
   - Server streams markdown tokens + citations `[path/to/file.ext:start_line-end_line]`.
2. **User clicks a citation pill in `ChatPanel`**:
   - `ChatPanel` triggers `onCitationClick({ filePath, startLine, endLine })`.
   - `WorkspacePage` (`repo/[id]/page.tsx`) receives the event and updates:
     - `selectedNodeId = filePath` -> passes to `ArchitectureMap`.
     - `activeCitation = { filePath, startLine, endLine }` -> passes to `CodeDrawer`.
3. **Canvas pans & Drawer opens**:
   - `ArchitectureMap` centers and highlights the corresponding node.
   - `CodeDrawer` slides open, fetches `/api/repos/{id}/file?path=...`, renders Monaco, highlights lines `startLine..endLine`, and scrolls to center.

---

## 🔌 API Endpoints Summary

| Method | Path | Summary | Schema Request / Response |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Health & API readiness | `-` / `HealthResponse` |
| `GET` | `/api/settings/gemini` | Gemini key status & model info | `-` / `GeminiSettingsResponse` |
| `POST` | `/api/repos/ingest` | Clones, parses, chunks, and indexes repo | `RepoIngestRequest` / `RepoIngestResponse` |
| `GET` | `/api/repos/{repo_id}` | Repo metadata & ASCII directory tree | `-` / `Dict[str, Any]` |
| `GET` | `/api/repos/{repo_id}/graph` | React Flow nodes & edges | `-` / `RepoGraphResponse` |
| `GET` | `/api/repos/{repo_id}/chunks` | Retrieved AST code chunks | `limit, offset` / `RepoChunksResponse` |
| `GET` | `/api/repos/{repo_id}/file` | Raw file text for Monaco viewer | `path` / `FileContentResponse` |
| `POST` | `/api/repos/{repo_id}/chat` | SSE streaming RAG Q&A | `ChatRequest` / `text/event-stream` |
| `GET/POST`| `/api/repos/{repo_id}/onboarding` | Synthesizes/retrieves `ONBOARDING.md` | `-` / `OnboardingDocResponse` |

---

## ⚡ Agent Grep & Navigation Recipes

When looking for a specific symbol or bug, use these fast, low-token commands:

### Find function/class definition across backend
```pwsh
git grep -n "def function_name" backend/app/
git grep -n "class ClassName" backend/app/
```

### Find symbol or component across frontend
```pwsh
git grep -n "export const ComponentName" frontend/src/
git grep -n "export function functionName" frontend/src/
git grep -n "interface InterfaceName" frontend/src/types/
```

### Run specific test without entire suite
```pwsh
backend\.venv\Scripts\pytest backend/tests/test_ast_service.py -v
```

### Verify frontend type-checking
```pwsh
npm --prefix frontend run build
```
