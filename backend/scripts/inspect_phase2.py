"""
Inspection script for Phase 2: AST Code Chunker & Dependency Graph Extractor.
Tests AST parsing on Python and TypeScript fixtures, constructs a dependency graph,
and prints the resulting React Flow graph and CodeChunk objects.
"""

import json
from pathlib import Path
import tempfile

from app.services.ast_service import get_ast_service
from app.services.graph_service import get_graph_service


def run_inspection():
    print("=================================================================")
    print("CodeAtlas Phase 2: AST Parsing & Dependency Graph Inspection")
    print("=================================================================\n")

    ast_service = get_ast_service()
    graph_service = get_graph_service()

    with tempfile.TemporaryDirectory() as tmpdir:
        repo_dir = Path(tmpdir) / "sample_app"
        src_dir = repo_dir / "src"
        components_dir = src_dir / "components"
        components_dir.mkdir(parents=True)

        # 1. Component with TypeScript interface & Arrow Function
        (components_dir / "Button.tsx").write_text(
            """export interface ButtonProps {
    label: string;
    onClick: () => void;
    variant?: "primary" | "secondary";
}

export const Button = ({ label, onClick, variant = "primary" }: ButtonProps) => {
    return <button className={`btn-${variant}`} onClick={onClick}>{label}</button>;
};
""",
            encoding="utf-8",
        )

        # 2. Main App importing Component
        (src_dir / "App.tsx").write_text(
            """import { Button } from './components/Button';
import { calculateTax } from './taxEngine';

export function MainApp() {
    const tax = calculateTax(100);
    return (
        <div>
            <h1>Total Tax: {tax}</h1>
            <Button label="Pay" onClick={() => console.log('paid')} />
        </div>
    );
}
""",
            encoding="utf-8",
        )

        # 3. TypeScript utility function
        (src_dir / "taxEngine.ts").write_text(
            """export function calculateTax(amount: number): number {
    return amount * 0.15;
}
""",
            encoding="utf-8",
        )

        # 4. Python backend controller with classes and decorators
        backend_dir = repo_dir / "backend"
        backend_dir.mkdir(parents=True)

        (backend_dir / "models.py").write_text(
            """class OrderModel:
    def __init__(self, order_id: str, amount: float):
        self.order_id = order_id
        self.amount = amount

    def to_dict(self) -> dict:
        return {"order_id": self.order_id, "amount": self.amount}
""",
            encoding="utf-8",
        )

        (backend_dir / "server.py").write_text(
            """from .models import OrderModel

def create_order(order_id: str, amount: float) -> OrderModel:
    return OrderModel(order_id=order_id, amount=amount)
""",
            encoding="utf-8",
        )

        valid_files = [
            "src/components/Button.tsx",
            "src/App.tsx",
            "src/taxEngine.ts",
            "backend/models.py",
            "backend/server.py",
        ]

        print(f"Parsing AST Code Chunks for {len(valid_files)} source files...\n")
        chunks = ast_service.chunk_repository(repo_dir, valid_files)

        print(f"-> Extracted {len(chunks)} Code Chunks:\n")
        for idx, chunk in enumerate(chunks, 1):
            print(f"[{idx}] {chunk.file_path} | Type: {chunk.chunk_type} | Symbol: {chunk.symbol_name} (Lines {chunk.start_line}-{chunk.end_line})")
            print("-----------------------------------------------------------------")
            for line in chunk.content.splitlines()[:5]:
                print(f"   {line}")
            if len(chunk.content.splitlines()) > 5:
                print("   ...")
            print()

        print("=================================================================")
        print("Constructing React Flow Architecture Dependency Graph...\n")
        graph_data = graph_service.build_dependency_graph(repo_dir, valid_files)

        print(f"-> Nodes ({len(graph_data.nodes)}):")
        for node in graph_data.nodes:
            print(f"   - ID: {node.id:<30} | Folder: {node.folder:<20} | In: {node.in_degree} | Out: {node.out_degree}")

        print(f"\n-> Edges ({len(graph_data.edges)}):")
        for edge in graph_data.edges:
            print(f"   - {edge.id}")

        print("\nReact Flow Output JSON (Sample Node & Edge):")
        sample_json = {
            "nodes": [n.model_dump() for n in graph_data.nodes[:2]],
            "edges": [e.model_dump() for e in graph_data.edges[:2]],
        }
        print(json.dumps(sample_json, indent=2))
        print("\n[SUCCESS] Phase 2 verification complete.")


if __name__ == "__main__":
    run_inspection()

