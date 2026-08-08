# Workspace Rules

## Knowledge Graph Maintenance
Whenever significant architectural changes are made, new features are introduced, or major database schema migrations occur, you MUST update the `KNOWLEDGE_GRAPH.md` file in the root of the workspace.

The knowledge graph should represent:
- Frontend components and their hierarchy
- Backend endpoints and their functions
- Database tables and relations
- Background workers or crons

Make sure the Knowledge Graph uses Mermaid diagrams for visualization.

## Lessons Learned Maintenance
Whenever important bugs are fixed, significant edge cases are discovered, or complex workarounds are implemented, you MUST summarize the problem, the root cause (mistake), and the final solution/lesson in the `LESSONS_LEARNED.md` file in the root of the workspace. This ensures that future agents and developers do not repeat the same mistakes.
