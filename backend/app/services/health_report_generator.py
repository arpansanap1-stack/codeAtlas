from datetime import datetime, timezone
from typing import List
from app.models.schemas import (
    ArchitectureSmell,
    ArchitectureSmellType,
    CodebaseHealthReportResponse,
    CodebaseHealthResponse,
)


def explain_smell_problem(smell: ArchitectureSmell) -> str:
    stype = smell.smell_type
    if stype == ArchitectureSmellType.CIRCULAR_DEPENDENCY:
        return (
            "**Why This Is a Critical Problem:**\n"
            "- **Initialization Failures & Deadlocks**: When modules depend on each other cyclically, runtimes (Python, Node.js, etc.) cannot determine a deterministic evaluation order. This frequently leads to runtime crashes such as `ImportError: cannot import name ... from partially initialized module` or `undefined` imports at load time.\n"
            "- **Testing & Mocking Bottlenecks**: Circular dependencies cannot be tested in isolation. Mocking one file inevitably requires instantiating the entire cycle, causing fragile and tightly entangled unit tests.\n"
            "- **Cognitive Overhead**: Developers cannot reason about either module independently, as a change to one triggers cascading behavioral side-effects back onto itself."
        )
    elif stype == ArchitectureSmellType.GOD_FILE:
        return (
            "**Why This Is a High-Risk Problem:**\n"
            "- **Massive Blast Radius**: A 'God File' accumulates excessive incoming callers (high fan-in) and outgoing dependencies (high fan-out). Changing a single function signature or internal logic can break dozens of distant parts of the system.\n"
            "- **Frequent Merge Conflicts**: Because many features and developers touch this central hub simultaneously, it becomes a frequent source of painful Git merge conflicts.\n"
            "- **SRP Violation**: Violates the Single Responsibility Principle by combining orchestrations, utilities, state, and domain operations into a single unmanageable monolith."
        )
    elif stype == ArchitectureSmellType.OVERSIZED_MODULE:
        return (
            "**Why This Is a Code Quality Problem:**\n"
            "- **Increased Defect Density**: Software engineering research consistently shows that defect density increases non-linearly with file size (>350-500 LOC). Large files hide edge cases and make thorough code reviews difficult.\n"
            "- **Poor Cohesion**: Monstrous files usually bundle multiple loosely related capabilities that should belong to dedicated submodules or subcomponents.\n"
            "- **Developer Fatigue & Navigation Latency**: Scrolling through thousands of lines impedes developer velocity and degrades IDE static analysis responsiveness."
        )
    elif stype == ArchitectureSmellType.TIGHT_COUPLING:
        return (
            "**Why This Is a Dangerous Architecture Flaw:**\n"
            "- **Inseparable 2-Node Cluster**: Bidirectional imports mean that Module A cannot exist without Module B, and Module B cannot exist without Module A. They are functionally a single split file masquerading as two separate modules.\n"
            "- **Refactoring Lock-In**: Extracting or replacing either module requires simultaneous refactoring of both, preventing incremental migration or isolated upgrades."
        )
    elif stype == ArchitectureSmellType.DEAD_MODULE:
        return (
            "**Why This Is an Architectural Liability:**\n"
            "- **Code Bloat & Bundle Waste**: Orphaned modules that are never imported increase total bundle size (in client apps) and increase deployment artifact footprints.\n"
            "- **Cognitive Distraction & Bit-Rot**: When new developers explore the repository, unreferenced dead code creates false assumptions about active system workflows and accumulates bit-rot without automated test coverage."
        )
    return (
        "**Why This Is an Architecture Problem:**\n"
        f"- {smell.description}\n"
        "- Reduces architectural modularity, hampers long-term maintainability, and increases the difficulty of onboarding new developers."
    )


def generate_health_markdown_report_content(
    health: CodebaseHealthResponse, repo_name: str, repo_id: str
) -> CodebaseHealthReportResponse:
    now = datetime.now(timezone.utc)
    date_str = now.strftime("%Y-%m-%d %H:%M UTC")

    critical_count = sum(1 for s in health.smells if s.severity == "critical")
    warning_count = sum(1 for s in health.smells if s.severity == "warning")
    info_count = sum(1 for s in health.smells if s.severity == "info")

    lines: List[str] = [
        f"# 🏥 Architecture Health & Codebase Quality Audit Report: {repo_name}",
        "",
        f"> **Repository Name:** `{repo_name}` (`{repo_id}`)  ",
        f"> **Health Score:** **{health.health_score} / 100** — `{health.health_rating}`  ",
        f"> **Audit Generated:** `{date_str}` via **CodeAtlas Architectural Diagnostics Engine**  ",
        "",
        "---",
        "",
        "## 📋 1. Executive Summary",
        "",
        health.summary,
        "",
    ]

    if health.health_score >= 85:
        lines.extend([
            "### Architectural Verdict: 🟢 Excellent Modularity",
            "The repository exhibits clean separation of concerns, high modular cohesion, and minimal structural anti-patterns. Dependency graphs are largely acyclic and component fan-out is well-contained.",
            "",
        ])
    elif health.health_score >= 70:
        lines.extend([
            "### Architectural Verdict: 🔵 Healthy with Minor Improvement Areas",
            "The codebase is in good structural health overall. However, a small number of architectural hotspots or oversized files have been detected. Proactive refactoring now will prevent technical debt from compounding.",
            "",
        ])
    elif health.health_score >= 50:
        lines.extend([
            "### Architectural Verdict: 🟡 Needs Attention — Moderate Architecture Debt",
            "Several architectural warning signs were discovered, including high coupling, oversized modules, or circular dependencies. These anti-patterns elevate regression risks and increase cognitive onboarding load.",
            "",
        ])
    else:
        lines.extend([
            "### Architectural Verdict: 🔴 Degraded — Critical Architecture Debt",
            "The codebase contains multiple critical architectural anti-patterns, such as circular dependency loops and over-coupled God modules. These issues threaten runtime stability, prevent isolated testing, and require structural refactoring.",
            "",
        ])

    lines.extend([
        "---",
        "",
        "## 📊 2. Scorecard & Vital Structural Metrics",
        "",
        "| Metric | Value | Architectural Interpretation |",
        "| :--- | :--- | :--- |",
        f"| **Overall Health Score** | **{health.health_score}/100** ({health.health_rating}) | Weighted health index based on coupling, cycles, and modularity |",
        f"| **Total Modules Analyzed** | **{health.total_files} files** | Total distinct source code files indexed in dependency graph |",
        f"| **Total Lines of Code** | **{health.total_lines:,} LOC** | Aggregate volume of codebase lines |",
        f"| **Graph Coupling Density** | **{(health.graph_density * 100):.2f}%** | Ratio of actual import edges to total theoretically possible edges |",
        f"| **Total Architecture Smells** | **{len(health.smells)} issues** | Detected anti-patterns across all severity tiers |",
        f"| ↳ Critical Smells | `{critical_count}` | Urgent issues (cycles, tight coupling) risking runtime crashes |",
        f"| ↳ Warning Smells | `{warning_count}` | Moderately severe issues (God files, oversized modules) |",
        f"| ↳ Informational / Dead Code | `{info_count}` | Minor hygiene issues (orphaned/unreferenced files) |",
        f"| **Circular Dependency Loops** | **{len(health.circular_dependencies)} cycles** | Mutually recursive import cycles detected in static topology |",
        "",
        "---",
        "",
        "## ⚠️ 3. In-Depth Problem Explanations & Diagnostic Breakdown",
        "",
        "This section details each architectural problem identified in the repository, explaining the precise technical risks it poses and providing actionable refactoring strategies.",
        "",
    ])

    if not health.smells:
        lines.extend([
            "> 🛡️ **Zero Architectural Smells Detected!**",
            "> The codebase maintains clean architectural boundaries with no circular imports, no monolithic God files, and well-proportioned module sizes.",
            "",
        ])
    else:
        for idx, smell in enumerate(health.smells, 1):
            sev_emoji = "🔴" if smell.severity == "critical" else ("🟡" if smell.severity == "warning" else "🔵")
            lines.extend([
                f"### Problem #{idx}: {sev_emoji} [{smell.severity.upper()}] {smell.title}",
                "",
                f"- **Smell Category:** `{smell.smell_type.value}`",
                f"- **Severity Level:** **{smell.severity.upper()}**",
                f"- **Observable Symptom:** {smell.description}",
                "",
                explain_smell_problem(smell),
                "",
                "**Affected Modules & File Paths:**",
            ])
            for fpath in smell.affected_files:
                lines.append(f"- `[{fpath}]`")
            lines.extend([
                "",
                "**Recommended Remediation / Fix Strategy:**",
                f"> 💡 **Actionable Tip:** {smell.refactoring_tip}",
                "",
                "---",
                "",
            ])

    lines.extend([
        "## 🔄 4. Circular Dependency Loops Deep-Dive",
        "",
    ])
    if not health.circular_dependencies:
        lines.extend([
            "✅ **No circular dependency cycles found.** The import graph forms a clean Directed Acyclic Graph (DAG).",
            "",
        ])
    else:
        lines.extend([
            f"Detected **{len(health.circular_dependencies)} circular loop(s)** in the codebase import graph. Circular cycles undermine module independence and frequently cause runtime import deadlocks.",
            "",
        ])
        for c_idx, cycle in enumerate(health.circular_dependencies, 1):
            path_display = " ➔ ".join(f"`{f}`" for f in cycle)
            lines.extend([
                f"#### Cycle #{c_idx} ({len(cycle)-1} hops):",
                f"> {path_display}",
                "",
                "**How to break this cycle:**",
                f"1. Identify the shared data structures or functions shared between `{cycle[0]}` and `{cycle[-2] if len(cycle) > 2 else cycle[1]}`.",
                "2. Extract those shared entities into a separate, lower-level interface or types module (e.g. `types.ts` or `schemas.py`).",
                "3. Update both modules to import from the new extracted module rather than importing each other directly.",
                "",
            ])

    lines.extend([
        "---",
        "",
        "## 🔥 5. Hotspots & Architectural Blast Radius",
        "",
        "### Top Most Connected Hub Files (Highest Blast Radius)",
        "Files with high degree centrality (fan-in + fan-out) represent core architectural junctions. Any bug or interface change in these modules radiates across dependent systems.",
        "",
        "| Module Path | Degree Centrality | Details |",
        "| :--- | :--- | :--- |",
    ])
    for hub in health.most_connected_files:
        lines.append(f"| `{hub.file_path}` | **{hub.value} edges** | {hub.details or 'Connected hub'} |")

    lines.extend([
        "",
        "### Largest Modules by Lines of Code",
        "Modules with excessive length are prime candidates for SRP decomposition.",
        "",
        "| Module Path | Lines of Code | Complexity Chunks |",
        "| :--- | :--- | :--- |",
    ])
    for mod in health.largest_modules:
        lines.append(f"| `{mod.file_path}` | **{mod.value} lines** | {mod.details or '-'} |")

    if health.dead_files:
        lines.extend([
            "",
            "### Potential Orphaned / Dead Modules",
            "These modules have 0 incoming imports and do not match standard entrypoint patterns (such as `main.py`, `index.ts`, `page.tsx`). Audit them to confirm if they are dynamically invoked, test files, or dead code.",
            "",
        ])
        for df in health.dead_files:
            lines.append(f"- `[{df}]`")

    lines.extend([
        "",
        "---",
        "",
        "## 💻 6. Language & Technology Stack Composition",
        "",
        "| Language | Files Count | Percentage Share |",
        "| :--- | :--- | :--- |",
    ])
    for lang in health.languages:
        lines.append(f"| **{lang.language}** | {lang.file_count} files | {lang.percentage}% |")

    lines.extend([
        "",
        "---",
        "",
        "## 🎯 7. Prioritized Engineering Remediation Roadmap",
        "",
        "To systematically elevate this codebase's health score and eliminate structural risks, follow this 3-phase remediation plan:",
        "",
        "### 🔴 Phase 1: High-Priority Safety Interventions (P0 — Days 1–3)",
        "- **Break Circular Imports**: Eliminate all detected circular cycles by extracting shared interfaces or applying the Dependency Inversion Principle.",
        "- **Decouple Mutual Pairs**: Invert dependencies on tightly coupled 2-node file pairs to enable isolated testing.",
        "",
        "### 🟡 Phase 2: Hub & Blast Radius Reduction (P1 — Week 1)",
        "- **Refactor God Modules**: Introduce domain facades or divide multi-responsibility files into cohesive sub-services.",
        "- **Protect Hub Callers**: Ensure unit tests thoroughly mock high fan-in dependencies to prevent upstream regression cascades.",
        "",
        "### 🔵 Phase 3: Maintainability & Code Hygiene (P2 — Ongoing)",
        "- **Split Oversized Files**: Break files exceeding 350 LOC into modular presentation/logic subcomponents.",
        "- **Clean Dead Code**: Verify and prune unused modules to reduce bundle weight and cognitive debt.",
        "",
        "---",
        "",
        "> *Report compiled automatically by **CodeAtlas**. For interactive visualization, visual cycle exploration, and Monaco line-by-line inspection, launch the CodeAtlas Web Workspace.*",
    ])

    report_markdown = "\n".join(lines)
    return CodebaseHealthReportResponse(
        repo_id=repo_id,
        repo_name=repo_name,
        health_score=health.health_score,
        health_rating=health.health_rating,
        markdown_report=report_markdown,
        generated_at=now,
    )
