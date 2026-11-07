from typing import Any, Dict, List
from app.models.schemas import SuggestedJourneyItem


def build_suggested_journeys(nodes: List[Dict[str, Any]]) -> List[SuggestedJourneyItem]:
    """Inspects codebase graph nodes to suggest relevant execution journeys."""
    all_paths = [n.get("id", "").lower() for n in nodes]
    suggestions: List[SuggestedJourneyItem] = []

    # Check for Ingestion / Pipeline
    if any("git" in p or "ingest" in p or "pipe" in p for p in all_paths):
        suggestions.append(
            SuggestedJourneyItem(
                topic="Repository Ingestion & Processing Pipeline",
                description="Follow how raw GitHub URLs are cloned, filtered, AST-chunked, and stored.",
                category="Core Pipeline",
            )
        )

    # Check for AI / Chat / RAG
    if any("chat" in p or "rag" in p or "embed" in p or "ai" in p for p in all_paths):
        suggestions.append(
            SuggestedJourneyItem(
                topic="AI Streaming RAG & Citation Flow",
                description="Trace how user queries retrieve vector chunks, expand graph context, and stream over SSE.",
                category="AI & Reasoning",
            )
        )

    # Check for Auth
    if any("auth" in p or "login" in p or "jwt" in p or "session" in p or "user" in p for p in all_paths):
        suggestions.append(
            SuggestedJourneyItem(
                topic="Authentication & Session Verification Flow",
                description="Trace credentials validation, token verification, and route protection.",
                category="Security",
            )
        )

    # Check for UI / State Visualization
    if any("component" in p or "map" in p or "ui" in p or "view" in p for p in all_paths):
        suggestions.append(
            SuggestedJourneyItem(
                topic="Architecture Map Rendering & Interactive Synchronization",
                description="Trace how graph nodes, layout algorithms, and Monaco code highlighting synchronize.",
                category="Frontend & UI",
            )
        )

    # Universal Default Suggestions
    if len(suggestions) < 3:
        suggestions.append(
            SuggestedJourneyItem(
                topic="Primary Request / Response Lifecycle",
                description="Trace an incoming request from public entry route to backend database.",
                category="Lifecycle",
            )
        )
        suggestions.append(
            SuggestedJourneyItem(
                topic="Data Persistence & Storage Execution Path",
                description="Follow how domain entities are transformed and saved into the database layer.",
                category="Database",
            )
        )

    return suggestions
