import pytest
from app.db.supabase import get_db
from app.models.schemas import CodeChunk
from app.services.journey_service import get_journey_service


def test_journey_suggestions_and_generation():
    db = get_db()
    repo_id = "test-repo-journey-1"

    # Seed repository
    db.create_repository(
        repo_id=repo_id,
        repo_url="https://github.com/example/auth-app",
        repo_name="auth-app",
        status="completed",
        directory_tree="auth-app/\n├── src/components/Login.tsx\n├── src/api/auth.ts\n├── src/services/authService.ts\n└── src/db/users.ts",
        graph_data={
            "nodes": [
                {"id": "src/components/Login.tsx", "label": "Login.tsx", "folder": "src/components", "in_degree": 0, "out_degree": 1},
                {"id": "src/api/auth.ts", "label": "auth.ts", "folder": "src/api", "in_degree": 1, "out_degree": 1},
                {"id": "src/services/authService.ts", "label": "authService.ts", "folder": "src/services", "in_degree": 1, "out_degree": 1},
                {"id": "src/db/users.ts", "label": "users.ts", "folder": "src/db", "in_degree": 1, "out_degree": 0},
            ],
            "edges": [
                {"id": "e1", "source": "src/components/Login.tsx", "target": "src/api/auth.ts"},
                {"id": "e2", "source": "src/api/auth.ts", "target": "src/services/authService.ts"},
                {"id": "e3", "source": "src/services/authService.ts", "target": "src/db/users.ts"},
            ],
        },
    )

    chunks = [
        CodeChunk(
            file_path="src/components/Login.tsx",
            symbol_name="LoginForm",
            chunk_type="function_definition",
            start_line=12,
            end_line=45,
            content="export function LoginForm() {}",
        ),
        CodeChunk(
            file_path="src/api/auth.ts",
            symbol_name="handleLogin",
            chunk_type="function_definition",
            start_line=5,
            end_line=30,
            content="export async function handleLogin() {}",
        ),
        CodeChunk(
            file_path="src/services/authService.ts",
            symbol_name="authenticateUser",
            chunk_type="function_definition",
            start_line=10,
            end_line=50,
            content="export function authenticateUser() {}",
        ),
    ]
    db.save_code_chunks(repo_id, chunks)

    service = get_journey_service()

    # 1. Test Suggestions
    suggestions = service.get_suggested_journeys(repo_id)
    assert suggestions.repo_id == repo_id
    assert len(suggestions.journeys) >= 1
    auth_suggestion = any("auth" in j.topic.lower() for j in suggestions.journeys)
    assert auth_suggestion is True

    # 2. Test Journey Generation (Authentication Flow)
    journey = service.generate_journey(repo_id, "How does authentication work?")
    assert journey.repo_id == repo_id
    assert "authentication" in journey.topic.lower()
    assert len(journey.steps) >= 3

    # Verify Step sequence
    step1 = journey.steps[0]
    assert step1.step_number == 1
    assert step1.file_path == "src/components/Login.tsx"
    assert step1.start_line == 12
    assert step1.end_line == 45
    assert step1.outgoing_target == "src/api/auth.ts"

    # 3. Test caching
    cached_journey = service.generate_journey(repo_id, "How does authentication work?")
    assert len(cached_journey.steps) == len(journey.steps)
    assert cached_journey.steps[0].file_path == journey.steps[0].file_path

