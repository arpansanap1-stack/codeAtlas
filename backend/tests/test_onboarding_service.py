import pytest

from app.db.supabase import get_db
from app.main import generate_onboarding_docs, get_onboarding_docs
from app.models.schemas import CodeChunk
from app.services.onboarding_service import get_onboarding_service


def test_gather_high_signal_context_and_synthesis():
    db = get_db()
    repo_id = "test-repo-onboard-1"

    # Seed repository
    db.create_repository(
        repo_id=repo_id,
        repo_url="https://github.com/octocat/sample-app",
        repo_name="sample-app",
        status="completed",
        directory_tree="sample-app/\n├── package.json\n├── README.md\n└── src/\n    ├── index.ts\n    └── utils.ts",
        graph_data={
            "nodes": [
                {"id": "src/index.ts", "label": "index.ts", "folder": "src", "in_degree": 0, "out_degree": 2},
                {"id": "src/utils.ts", "label": "utils.ts", "folder": "src", "in_degree": 1, "out_degree": 0},
            ],
            "edges": [
                {"id": "src/index.ts->src/utils.ts", "source": "src/index.ts", "target": "src/utils.ts"}
            ],
        },
    )

    # Save manifest files
    db.save_file_content(repo_id, "package.json", '{\n  "name": "sample-app",\n  "version": "1.0.0"\n}')
    db.save_file_content(repo_id, "README.md", "# Sample App\nWelcome to Sample App.")

    # Save sample code chunks
    chunks = [
        CodeChunk(
            file_path="src/index.ts",
            symbol_name="startApp",
            chunk_type="function_definition",
            start_line=1,
            end_line=15,
            content="# File: src/index.ts | Symbol: startApp | Lines: 1-15\nexport function startApp() {}",
        ),
        CodeChunk(
            file_path="src/utils.ts",
            symbol_name="formatData",
            chunk_type="function_definition",
            start_line=5,
            end_line=20,
            content="# File: src/utils.ts | Symbol: formatData | Lines: 5-20\nexport function formatData() {}",
        ),
    ]
    db.save_code_chunks(repo_id, chunks)

    onboarding_service = get_onboarding_service()
    context = onboarding_service.gather_high_signal_context(repo_id)

    assert context["repo_name"] == "sample-app"
    assert "package.json" in context["manifests"]
    assert "README.md" in context["manifests"]
    assert len(context["top_files"]) == 2
    # Verify degree sorting: index.ts (centrality = 2) should be ranked first
    assert context["top_files"][0]["file_path"] == "src/index.ts"

    # Test generation
    doc_record = onboarding_service.generate_onboarding_documentation(repo_id)
    content = doc_record["markdown_content"]

    # Verify 6 mandatory sections
    assert "1. Executive Architecture Overview & Tech Stack" in content
    assert "2. System Data Flow Diagram" in content
    assert "```mermaid" in content
    assert "graph TD" in content
    assert "3. Core Modules & Entry Points" in content
    assert "4. Directory Structure Walkthrough" in content
    assert "5. Day-1 Local Setup & Run Guide" in content
    assert "6. \"Where to Make Changes\" Playbook" in content

    # Verify line citations
    assert "[src/index.ts:" in content

    # Verify API endpoints
    post_res = generate_onboarding_docs(repo_id)
    assert post_res.repo_id == repo_id
    assert "Executive Architecture Overview" in post_res.markdown_content

    get_res = get_onboarding_docs(repo_id)
    assert get_res.repo_id == repo_id
    assert get_res.markdown_content == post_res.markdown_content

