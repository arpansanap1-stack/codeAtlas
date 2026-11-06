# Agent Operating Instructions for CodeAtlas

**CRITICAL GUIDELINES FOR AI AGENTS (Antigravity / Gemini / Claude / GPT):**

1. **DO NOT READ THE ENTIRE CODEBASE:**
   - Reading files one by one exhausts context and slows execution.
   - Always open and consult [`CODEBASE_MAP.md`](file:///c:/Users/arpan/codeAtlas/CODEBASE_MAP.md) FIRST to locate the exact file responsible for the requested feature or fix.
   - Open ONLY the files required for the specific task.

2. **FEATURE TRACKING MANDATE:**
   - Every new feature must be logged in [`FEATURE_TRACKER.md`](file:///c:/Users/arpan/codeAtlas/FEATURE_TRACKER.md) following [`DEVELOPMENT_WORKFLOW.md`](file:///c:/Users/arpan/codeAtlas/DEVELOPMENT_WORKFLOW.md).
   - Never implement a feature without updating the tracker and making an atomic Git commit.

3. **VERIFICATION COMMANDS:**
   - Run backend tests: `backend\.venv\Scripts\pytest backend/tests/<test_file>.py`
   - Test frontend build: `npm --prefix frontend run build`

4. **CODING QUALITY:**
   - No TODOs, no dummy placeholders.
   - Strongly typed Python (Pydantic v2) and TypeScript (React 19, Next.js 15).
   - Strict citation syntax: `[file_path:start_line-end_line]`.
