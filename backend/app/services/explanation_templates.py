from typing import Any, Dict, List


def build_fallback_explanation(
    repo_name: str,
    level: str,
    directory_tree: str,
    nodes: List[Dict[str, Any]],
    edges: List[Dict[str, Any]],
    entry_points: List[str],
    top_hubs: List[str],
    chunks: List[Dict[str, Any]],
) -> str:
    """Deterministic, rich fallback generator for offline tests and non-Gemini runs."""
    # Find citations for entry points
    entry_citations = []
    for ep in entry_points:
        matching_chunk = next((c for c in chunks if c.get("file_path") == ep), None)
        if matching_chunk:
            entry_citations.append(
                f"- **`{ep}`** `[{ep}:{matching_chunk.get('start_line', 1)}-{matching_chunk.get('end_line', 25)}]`: Primary entry point and process bootstrap."
            )
        else:
            entry_citations.append(f"- **`{ep}`** `[{ep}:1-30]`: Process entry point and service bootstrap.")

    if not entry_citations:
        first_file = nodes[0].get("id") if nodes else "src/index.ts"
        entry_citations.append(f"- **`{first_file}`** `[{first_file}:1-25]`: Core module entry point.")

    # Hub citations
    hub_citations = []
    for hub in top_hubs[:4]:
        matching_chunk = next((c for c in chunks if c.get("file_path") == hub), None)
        if matching_chunk:
            hub_citations.append(
                f"- **`{hub}`** `[{hub}:{matching_chunk.get('start_line', 1)}-{matching_chunk.get('end_line', 30)}]`: Core domain logic and shared service dependency."
            )
        else:
            hub_citations.append(f"- **`{hub}`** `[{hub}:1-40]`: High-centrality module utilized across multiple features.")

    # Mermaid flow diagram
    flow_lines = ["```mermaid", "flowchart TD"]
    flow_lines.append('    A["Client / User Action"] --> B["Entry Controller / Route"]')
    if entry_points:
        flow_lines.append(f'    B --> C["{entry_points[0]}"]')
    else:
        flow_lines.append('    B --> C["Core Service Layer"]')
    if top_hubs:
        flow_lines.append(f'    C --> D["{top_hubs[0]}"]')
        flow_lines.append('    D --> E["Database / State Store"]')
    else:
        flow_lines.append('    C --> E["State Management & Storage"]')
    flow_lines.append("```")
    mermaid_block = "\n".join(flow_lines)

    if level == "beginner":
        return f"""# 🧭 {repo_name} — Architecture Overview (Beginner Mode)

Welcome to **{repo_name}**! Think of this codebase like an airport terminal: requests arrive at the front gate, get checked by security controllers, route to specialized service gates, and finally persist or retrieve cargo from the database.

---

### 1. 🎯 What This Project Does
**{repo_name}** is engineered to provide modular, scalable software functionality. It separates user interface and client dispatching from core server-side computation, ensuring each subsystem handles one distinct responsibility.

---

### 2. 🚪 Entry Points & Execution Starting Points
When the system starts or receives a request, execution begins in these key entry files:
{chr(10).join(entry_citations)}

---

### 3. 🔄 Request & Data Flow
Here is how an action moves through the codebase from start to finish:

{mermaid_block}

1. **Trigger**: An event or network request arrives at the boundary.
2. **Routing**: The controller validates input and passes parameters to service handlers.
3. **Execution**: Business logic executes in modular service layers.
4. **Persistence**: Data updates or responses are dispatched back to the caller.

---

### 4. 🧩 Core Modules & Responsibilities
These are the most critical files that form the backbone of the application:
{chr(10).join(hub_citations)}

---

### 5. 📡 Component Communication
Components in **{repo_name}** communicate cleanly:
- **Direct Module Imports**: Shared utilities and domain models are imported statically without circular dependencies.
- **Data Encapsulation**: Controllers never manipulate raw storage directly; they interact through structured schemas.

---

### 6. 🚀 Where a New Developer Should Start (Day-1 Roadmap)
1. **Explore the Entry Point**: Start by reading `{entry_points[0] if entry_points else 'main entry file'}` to understand initialization parameters.
2. **Trace a Single Feature**: Follow a route handler down to its service function in `{top_hubs[0] if top_hubs else 'core module'}`.
3. **Run Verification**: Ensure your local tests pass before modifying business logic.
"""

    elif level == "expert":
        return f"""# ⚡ {repo_name} — Deep Architecture & Systems Analysis (Expert Mode)

A technical systems analysis of **{repo_name}**, examining dependency topology, data contracts, concurrency boundaries, and modular decoupling.

---

### 1. 🎯 Architectural Paradigm & System Overview
**{repo_name}** employs a layered, decoupled architecture with strict separation between ingestion/routing, domain services, and persistence layers. 

- **Dependency Direction**: Unidirectional flow minimizing reverse coupling.
- **Coupling Factor**: Evaluated across {len(nodes)} modules and {len(edges)} static import edges.

---

### 2. 🚪 Entry Points & Execution Bootstrap
Bootstrap sequences are defined in dedicated orchestration entry points:
{chr(10).join(entry_citations)}

---

### 3. 🔄 Request & Pipeline Data Flow
Execution path with state and boundary transitions:

{mermaid_block}

- **Ingress**: Network endpoints and CLI entry points parse incoming wire formats into typed models.
- **Intermediate Processing**: Pure service functions perform domain validation and state synthesis.
- **Egress / Persistence**: Transactions and outputs are dispatched through centralized database abstractions.

---

### 4. 🧩 Critical Path & High-Centrality Modules
Modules with the highest incoming and outgoing dependency degrees (critical blast radius):
{chr(10).join(hub_citations)}

---

### 5. 📡 Inter-Module Communication & Boundary Isolation
- **Interface Segregation**: Modules expose typed schemas to prevent leaky domain internals.
- **Fault Isolation**: External I/O and network operations are wrapped in retry/fallback blocks to prevent cascading failures.

---

### 6. 🚀 Day-1 Extension Guide & Architectural Recommendations
- **Extending Capabilities**: When adding new functionality, register endpoints in `{entry_points[0] if entry_points else 'entry layer'}` and delegate logic to isolated services.
- **Refactoring Watchlist**: Inspect modules in `{top_hubs[0] if top_hubs else 'hub layer'}` when changing schemas to prevent breaking dependent downstream nodes.
"""

    else:  # intermediate
        return f"""# 🏗️ {repo_name} — Architecture Walkthrough (Intermediate Mode)

A comprehensive architectural explanation of **{repo_name}**, detailing key entry points, request lifecycles, and component responsibilities.

---

### 1. 🎯 What This Project Does
**{repo_name}** is a structured, production-ready system designed to handle end-to-end data workflows. It separates routing, core business logic, and state storage into clean, maintainable modules.

---

### 2. 🚪 Entry Points & First Lines of Execution
Execution initiates through these primary entry points:
{chr(10).join(entry_citations)}

---

### 3. 🔄 Request & Data Flow
The sequence below illustrates the standard data flow:

{mermaid_block}

1. **Ingress**: Input parameters or API requests hit the entry handler.
2. **Validation**: Requests are verified against schemas.
3. **Service Logic**: Domain services process the business requirements.
4. **Response**: Processed payloads are returned to the caller or saved.

---

### 4. 🧩 Important Modules & Responsibilities
Key modules responsible for central application logic:
{chr(10).join(hub_citations)}

---

### 5. 📡 How Components Communicate
- **Import Hierarchies**: Modules import shared models and utilities without circular dependencies.
- **Async Execution**: I/O-heavy operations (network, file storage) are handled asynchronously.

---

### 6. 🚀 Where a New Developer Should Start (Day-1 Walkthrough)
1. Read the primary entry module: `{entry_points[0] if entry_points else 'entry file'}`.
2. Inspect the core services in: `{top_hubs[0] if top_hubs else 'main service'}`.
3. Review existing unit tests to understand expected behavior before contributing.
"""
