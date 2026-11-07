import { ArchitectureSmell, CodebaseHealthResponse } from "@/types";

export function explainSmell(smell: ArchitectureSmell): string {
  switch (smell.smell_type) {
    case "circular_dependency":
      return `**Why This Is a Critical Problem:**
- **Initialization Failures & Deadlocks**: When modules depend on each other cyclically, runtimes cannot determine a deterministic evaluation order. This frequently leads to runtime crashes such as \`ImportError: cannot import name ... from partially initialized module\` or undefined imports at load time.
- **Testing & Mocking Bottlenecks**: Circular dependencies cannot be tested in isolation. Mocking one file inevitably requires instantiating the entire cycle, causing fragile and tightly entangled unit tests.
- **Cognitive Overhead**: Developers cannot reason about either module independently, as a change to one triggers cascading behavioral side-effects back onto itself.`;
    case "god_file":
      return `**Why This Is a High-Risk Problem:**
- **Massive Blast Radius**: A 'God File' accumulates excessive incoming callers (high fan-in) and outgoing dependencies (high fan-out). Changing a single function signature or internal logic can break dozens of distant parts of the system.
- **Frequent Merge Conflicts**: Because many features and developers touch this central hub simultaneously, it becomes a frequent source of painful Git merge conflicts.
- **SRP Violation**: Violates the Single Responsibility Principle by combining orchestrations, utilities, state, and domain operations into a single unmanageable monolith.`;
    case "oversized_module":
      return `**Why This Is a Code Quality Problem:**
- **Increased Defect Density**: Software engineering research consistently shows that defect density increases non-linearly with file size (>350-500 LOC). Large files hide edge cases and make thorough code reviews difficult.
- **Poor Cohesion**: Monstrous files usually bundle multiple loosely related capabilities that should belong to dedicated submodules or subcomponents.
- **Developer Fatigue & Navigation Latency**: Scrolling through thousands of lines impedes developer velocity and degrades IDE static analysis responsiveness.`;
    case "tight_coupling":
      return `**Why This Is a Dangerous Architecture Flaw:**
- **Inseparable 2-Node Cluster**: Bidirectional imports mean that Module A cannot exist without Module B, and Module B cannot exist without Module A. They are functionally a single split file masquerading as two separate modules.
- **Refactoring Lock-In**: Extracting or replacing either module requires simultaneous refactoring of both, preventing incremental migration or isolated upgrades.`;
    case "dead_module":
      return `**Why This Is an Architectural Liability:**
- **Code Bloat & Bundle Waste**: Orphaned modules that are never imported increase total bundle size (in client apps) and increase deployment artifact footprints.
- **Cognitive Distraction & Bit-Rot**: When new developers explore the repository, unreferenced dead code creates false assumptions about active system workflows and accumulates bit-rot without automated test coverage.`;
    default:
      return `**Why This Is an Architecture Problem:**
- ${smell.description}
- Reduces architectural modularity, hampers long-term maintainability, and increases the difficulty of onboarding new developers.`;
  }
}

export function buildClientMarkdownReport(
  health: CodebaseHealthResponse,
  repoName: string,
  repoId: string
): string {
  const dateStr = new Date().toISOString().replace("T", " ").substring(0, 16) + " UTC";
  const criticalCount = health.smells.filter((s) => s.severity === "critical").length;
  const warningCount = health.smells.filter((s) => s.severity === "warning").length;
  const infoCount = health.smells.filter((s) => s.severity === "info").length;

  const lines: string[] = [
    `# 🏥 Architecture Health & Codebase Quality Audit Report: ${repoName}`,
    ``,
    `> **Repository Name:** \`${repoName}\` (\`${repoId}\`)  `,
    `> **Health Score:** **${health.health_score} / 100** — \`${health.health_rating}\`  `,
    `> **Audit Generated:** \`${dateStr}\` via **CodeAtlas Architectural Diagnostics Engine**  `,
    ``,
    `---`,
    ``,
    `## 📋 1. Executive Summary`,
    ``,
    health.summary,
    ``,
  ];

  if (health.health_score >= 85) {
    lines.push(
      `### Architectural Verdict: 🟢 Excellent Modularity`,
      `The repository exhibits clean separation of concerns, high modular cohesion, and minimal structural anti-patterns. Dependency graphs are largely acyclic and component fan-out is well-contained.`,
      ``
    );
  } else if (health.health_score >= 70) {
    lines.push(
      `### Architectural Verdict: 🔵 Healthy with Minor Improvement Areas`,
      `The codebase is in good structural health overall. However, a small number of architectural hotspots or oversized files have been detected. Proactive refactoring now will prevent technical debt from compounding.`,
      ``
    );
  } else if (health.health_score >= 50) {
    lines.push(
      `### Architectural Verdict: 🟡 Needs Attention — Moderate Architecture Debt`,
      `Several architectural warning signs were discovered, including high coupling, oversized modules, or circular dependencies. These anti-patterns elevate regression risks and increase cognitive onboarding load.`,
      ``
    );
  } else {
    lines.push(
      `### Architectural Verdict: 🔴 Degraded — Critical Architecture Debt`,
      `The codebase contains multiple critical architectural anti-patterns, such as circular dependency loops and over-coupled God modules. These issues threaten runtime stability, prevent isolated testing, and require structural refactoring.`,
      ``
    );
  }

  lines.push(
    `---`,
    ``,
    `## 📊 2. Scorecard & Vital Structural Metrics`,
    ``,
    `| Metric | Value | Architectural Interpretation |`,
    `| :--- | :--- | :--- |`,
    `| **Overall Health Score** | **${health.health_score}/100** (${health.health_rating}) | Weighted health index based on coupling, cycles, and modularity |`,
    `| **Total Modules Analyzed** | **${health.total_files} files** | Total distinct source code files indexed in dependency graph |`,
    `| **Total Lines of Code** | **${health.total_lines.toLocaleString()} LOC** | Aggregate volume of codebase lines |`,
    `| **Graph Coupling Density** | **${(health.graph_density * 100).toFixed(2)}%** | Ratio of actual import edges to total theoretically possible edges |`,
    `| **Total Architecture Smells** | **${health.smells.length} issues** | Detected anti-patterns across all severity tiers |`,
    `| ↳ Critical Smells | \`${criticalCount}\` | Urgent issues (cycles, tight coupling) risking runtime crashes |`,
    `| ↳ Warning Smells | \`${warningCount}\` | Moderately severe issues (God files, oversized modules) |`,
    `| ↳ Informational / Dead Code | \`${infoCount}\` | Minor hygiene issues (orphaned/unreferenced files) |`,
    `| **Circular Dependency Loops** | **${health.circular_dependencies.length} cycles** | Mutually recursive import cycles detected in static topology |`,
    ``,
    `---`,
    ``,
    `## ⚠️ 3. In-Depth Problem Explanations & Diagnostic Breakdown`,
    ``,
    `This section details each architectural problem identified in the repository, explaining the precise technical risks it poses and providing actionable refactoring strategies.`,
    ``
  );

  if (health.smells.length === 0) {
    lines.push(
      `> 🛡️ **Zero Architectural Smells Detected!**`,
      `> The codebase maintains clean architectural boundaries with no circular imports, no monolithic God files, and well-proportioned module sizes.`,
      ``
    );
  } else {
    health.smells.forEach((smell, idx) => {
      const sevEmoji = smell.severity === "critical" ? "🔴" : smell.severity === "warning" ? "🟡" : "🔵";
      lines.push(
        `### Problem #${idx + 1}: ${sevEmoji} [${smell.severity.toUpperCase()}] ${smell.title}`,
        ``,
        `- **Smell Category:** \`${smell.smell_type}\``,
        `- **Severity Level:** **${smell.severity.toUpperCase()}**`,
        `- **Observable Symptom:** ${smell.description}`,
        ``,
        explainSmell(smell),
        ``,
        `**Affected Modules & File Paths:**`
      );
      smell.affected_files.forEach((af) => {
        lines.push(`- \`[${af}]\``);
      });
      lines.push(
        ``,
        `**Recommended Remediation / Fix Strategy:**`,
        `> 💡 **Actionable Tip:** ${smell.refactoring_tip}`,
        ``,
        `---`,
        ``
      );
    });
  }

  lines.push(
    `## 🔄 4. Circular Dependency Loops Deep-Dive`,
    ``
  );

  if (health.circular_dependencies.length === 0) {
    lines.push(
      `✅ **No circular dependency cycles found.** The import graph forms a clean Directed Acyclic Graph (DAG).`,
      ``
    );
  } else {
    lines.push(
      `Detected **${health.circular_dependencies.length} circular loop(s)** in the codebase import graph. Circular cycles undermine module independence and frequently cause runtime import deadlocks.`,
      ``
    );
    health.circular_dependencies.forEach((cycle, cIdx) => {
      lines.push(
        `#### Cycle #${cIdx + 1} (${cycle.length - 1} hops):`,
        `> ${cycle.map((f) => `\`${f}\``).join(" ➔ ")}`,
        ``,
        `**How to break this cycle:**`,
        `1. Identify the shared data structures or functions shared between \`${cycle[0]}\` and \`${cycle[cycle.length - 2] || cycle[1]}\`.`,
        `2. Extract those shared entities into a separate, lower-level interface or types module (e.g. \`types.ts\` or \`schemas.py\`).`,
        `3. Update both modules to import from the new extracted module rather than importing each other directly.`,
        ``
      );
    });
  }

  lines.push(
    `---`,
    ``,
    `## 🔥 5. Hotspots & Architectural Blast Radius`,
    ``,
    `### Top Most Connected Hub Files (Highest Blast Radius)`,
    `Files with high degree centrality (fan-in + fan-out) represent core architectural junctions. Any bug or interface change in these modules radiates across dependent systems.`,
    ``,
    `| Module Path | Degree Centrality | Details |`,
    `| :--- | :--- | :--- |`
  );
  health.most_connected_files.forEach((h) => {
    lines.push(`| \`${h.file_path}\` | **${h.value} edges** | ${h.details || "Connected hub"} |`);
  });

  lines.push(
    ``,
    `### Largest Modules by Lines of Code`,
    `Modules with excessive length are prime candidates for SRP decomposition.`,
    ``,
    `| Module Path | Lines of Code | Complexity Chunks |`,
    `| :--- | :--- | :--- |`
  );
  health.largest_modules.forEach((m) => {
    lines.push(`| \`${m.file_path}\` | **${m.value} lines** | ${m.details || "-"} |`);
  });

  if (health.dead_files.length > 0) {
    lines.push(
      ``,
      `### Potential Orphaned / Dead Modules`,
      `These modules have 0 incoming imports and do not match standard entrypoint patterns (such as \`main.py\`, \`index.ts\`, \`page.tsx\`). Audit them to confirm if they are dynamically invoked, test files, or dead code.`,
      ``
    );
    health.dead_files.forEach((df) => {
      lines.push(`- \`[${df}]\``);
    });
  }

  lines.push(
    ``,
    `---`,
    ``,
    `## 💻 6. Language & Technology Stack Composition`,
    ``,
    `| Language | Files Count | Percentage Share |`,
    `| :--- | :--- | :--- |`
  );
  health.languages.forEach((l) => {
    lines.push(`| **${l.language}** | ${l.file_count} files | ${l.percentage}% |`);
  });

  lines.push(
    ``,
    `---`,
    ``,
    `## 🎯 7. Prioritized Engineering Remediation Roadmap`,
    ``,
    `To systematically elevate this codebase's health score and eliminate structural risks, follow this 3-phase remediation plan:`,
    ``,
    `### 🔴 Phase 1: High-Priority Safety Interventions (P0 — Days 1–3)`,
    `- **Break Circular Imports**: Eliminate all detected circular cycles by extracting shared interfaces or applying the Dependency Inversion Principle.`,
    `- **Decouple Mutual Pairs**: Invert dependencies on tightly coupled 2-node file pairs to enable isolated testing.`,
    ``,
    `### 🟡 Phase 2: Hub & Blast Radius Reduction (P1 — Week 1)`,
    `- **Refactor God Modules**: Introduce domain facades or divide multi-responsibility files into cohesive sub-services.`,
    `- **Protect Hub Callers**: Ensure unit tests thoroughly mock high fan-in dependencies to prevent upstream regression cascades.`,
    ``,
    `### 🔵 Phase 3: Maintainability & Code Hygiene (P2 — Ongoing)`,
    `- **Split Oversized Files**: Break files exceeding 350 LOC into modular presentation/logic subcomponents.`,
    `- **Clean Dead Code**: Verify and prune unused modules to reduce bundle weight and cognitive debt.`,
    ``,
    `---`,
    ``,
    `> *Report compiled automatically by **CodeAtlas**. For interactive visualization, visual cycle exploration, and Monaco line-by-line inspection, launch the CodeAtlas Web Workspace.*`
  );

  return lines.join("\n");
}
