# 📋 CodeAtlas Feature Tracker & Implementation Ledger

This document tracks all completed, in-progress, and planned features for **CodeAtlas**.
Every new feature implemented in this codebase must be logged here following the **Incremental Execution Protocol**.

---

## 🚦 Status Legend
- `[COMPLETED]` — Implementation finished, tests passing, code committed to Git.
- `[VERIFIED]` — Tested and confirmed by the user.
- `[IN_PROGRESS]` — Currently being designed, written, or debugged.
- `[PLANNED]` — Scoped for future implementation.

---

## 🌟 Baseline Features (v1.0.0-baseline)

| Phase / ID | Feature Name | Description | Key Modules | Status |
| :--- | :--- | :--- | :--- | :--- |
| **PHASE-01** | Git Ingestion & File Filtering | Shallow Git clone, URL normalizer, noise/binary filter (<500KB), ASCII tree generation, full-text caching. | `backend/app/services/git_service.py`<br>`backend/app/models/schemas.py` | `[COMPLETED]` |
| **PHASE-02** | Syntax-Aware AST Chunking | Tree-sitter & Python AST chunking (functions, classes, interfaces) with `# File: ... \| Symbol: ... \| Lines: ...` headers and line-accurate fallback chunker. | `backend/app/services/ast_service.py` | `[COMPLETED]` |
| **PHASE-03** | Dependency Graph Engine | Static AST import resolver (Python & JS/TS), React Flow graph generator, node categorization, and degree centrality metrics. | `backend/app/services/graph_service.py` | `[COMPLETED]` |
| **PHASE-04** | Hybrid Search & Vector Indexing | Supabase `pgvector` + PostgreSQL Full-Text Search with Reciprocal Rank Fusion (RRF) & Gemini batch embeddings with offline mock fallback. | `backend/app/services/embedding_service.py`<br>`backend/app/db/supabase.py` | `[COMPLETED]` |
| **PHASE-05** | Streaming RAG Chat & Citations | Server-Sent Events (SSE) streaming chat with graph context expansion and strict `[file_path:start_line-end_line]` citations. | `backend/app/services/chat_service.py`<br>`frontend/src/components/ChatPanel.tsx` | `[COMPLETED]` |
| **PHASE-06** | Interactive Architecture UI & Onboarding | React Flow canvas with Dagre layout, custom nodes, Monaco Editor slide-over drawer with line highlighting, and live Mermaid SVG onboarding guide. | `frontend/src/components/ArchitectureMap.tsx`<br>`frontend/src/components/CodeDrawer.tsx`<br>`frontend/src/components/OnboardingView.tsx` | `[COMPLETED]` |

---

## 🚀 Incremental Features (v1.1+)

### [FEAT-001] AI Architecture Explanation Mode (Beginner / Intermediate / Expert)
- **Status:** [COMPLETED]
- **Created Date:** 2026-11-06
- **Target Modules:**
  - `backend/app/models/schemas.py`
  - `backend/app/services/explanation_service.py`
  - `backend/app/main.py`
  - `backend/tests/test_explanation_service.py`
  - `frontend/src/types/index.ts`
  - `frontend/src/lib/api.ts`
  - `frontend/src/components/ArchitectureExplanationModal.tsx`
  - `frontend/src/app/repo/[id]/page.tsx`
- **Description & User Value:**
  Enables users to click "Explain this architecture to me" with one-click toggles between Beginner, Intermediate, and Expert levels. Generates project overview, entry points, data flow, key modules, component communication, and first-step advice with clickable code citations.
- **Verification Commands:**
  - Backend: `backend\.venv\Scripts\pytest backend/tests/test_explanation_service.py -v` (PASSED)
  - Frontend: `frontend\node_modules\.bin\tsc.cmd -p frontend\tsconfig.json --noEmit` (0 errors)
- **Git Commit:** `c28a53b`
- **Notes / Breaking Changes:**
  Adds GET `/api/repos/{repo_id}/explanation?level={beginner|intermediate|expert}`.

### [FEAT-002] "Journey Through the Codebase" Interactive Guided Tours
- **Status:** [COMPLETED]
- **Created Date:** 2026-11-06
- **Target Modules:**
  - `backend/app/models/schemas.py`
  - `backend/app/services/journey_service.py`
  - `backend/app/main.py`
  - `backend/tests/test_journey_service.py`
  - `frontend/src/types/index.ts`
  - `frontend/src/lib/api.ts`
  - `frontend/src/components/JourneyPlayer.tsx`
  - `frontend/src/components/ArchitectureMap.tsx`
  - `frontend/src/components/CustomNode.tsx`
  - `frontend/src/app/repo/[id]/page.tsx`
- **Description & User Value:**
  Allows users to query any workflow (e.g. "How does authentication work?", "Ingestion Pipeline") or pick preset journeys. Generates an interactive step-by-step path (UI → Route → Service → Database). Users can navigate Next → Next → Prev, which automatically pans the architecture canvas, highlights path nodes & animated edges, and slides open the Monaco drawer with the exact code lines highlighted.
- **Verification Commands:**
  - Backend: `backend\.venv\Scripts\pytest backend/tests/test_journey_service.py -v` (PASSED)
  - Frontend: `frontend\node_modules\.bin\tsc.cmd -p frontend\tsconfig.json --noEmit` (0 errors)
- **Git Commit:** `c28a53b`
- **Notes / Breaking Changes:**
  Adds GET `/api/repos/{repo_id}/journeys` and POST `/api/repos/{repo_id}/journey`.

<!-- Add new feature blocks below following this exact template -->

### 📝 Feature Template (Copy & Paste for New Features)
```markdown
### [FEAT-XXX] Feature Title
- **Status:** [PLANNED | IN_PROGRESS | COMPLETED | VERIFIED]
- **Created Date:** YYYY-MM-DD
- **Target Modules:**
  - `path/to/file.py`
  - `path/to/component.tsx`
- **Description & User Value:**
  Brief explanation of the feature and what capability it adds.
- **Verification Commands:**
  - Backend: `pytest backend/tests/test_feature.py`
  - Frontend: `npm --prefix frontend run build`
- **Git Commit:** `<commit_hash>`
- **Notes / Breaking Changes:**
  None / List of dependencies added or schema migrations needed.
```

---

## 📌 Implementation Queue

### Upcoming Candidate Features (Backlog)
- [ ] **[FEAT-001] Export Architecture Map as SVG/PNG**: One-click high-resolution visual export of the React Flow canvas.
- [ ] **[FEAT-002] Multi-Branch & Tag Selector**: Ingest specific branches (`develop`, `staging`) or release tags instead of only the default branch.
- [ ] **[FEAT-003] Language Filter on Architecture Canvas**: Filter nodes by language (e.g. show only Python files, or only TypeScript/TSX).
- [ ] **[FEAT-004] Enhanced Call Graph Resolution**: Deepen AST analysis to detect function-to-function invocation edges across files.
- [ ] **[FEAT-005] Chat History Persistence**: Store multi-turn chat sessions in PostgreSQL/LocalStorage for persistent repo exploration.

---

## 📈 Changelog & Commit History

| Commit | Date | Tag | Summary |
| :--- | :--- | :--- | :--- |
| `HEAD` | 2026-11-06 | - | feat: implement AI architecture explanation mode & interactive codebase journeys |
| `5c7e3a7` | 2026-11-06 | - | chore: add *.tsbuildinfo to .gitignore |
| `26d1e57` | 2026-11-06 | - | chore: specify fast local tsc command for frontend verification |
| `8c14b8d` | 2026-11-06 | - | docs: establish feature tracker, codebase index map, and incremental workflow |
| `6ffa099` | 2026-11-06 | `v1.0.0-baseline` | Initial baseline for CodeAtlas v1.0 (Full stack, AST parsing, Hybrid RAG, React Flow map, Monaco drawer, Onboarding synthesizer). |

