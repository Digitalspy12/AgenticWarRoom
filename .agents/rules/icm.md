# Interpretable Context Methodology (ICM) Rules

1. **Entry Protocol (The Walk)**:
   - At the start of a task or session, read `GEMINI.md` or `AGENTS.md` first to identify the active stage and routing pointers.
   - Never slurp the entire repo. Read only the current stage's `CONTEXT.md` and the exact files listed under its `## Inputs` (keep context under 8,000 tokens).

2. **Factory vs. Product Separation**:
   - `_shared/` is the Factory: only stable references (schemas, API contracts, design tokens) belong here. Never write run outputs, logs, or scratch files into `_shared/`.
   - Working outputs and deliverables belong strictly in `stages/<NN_stage>/output/` or code source files (`client/`, `server/`).

3. **Check-First Verification (Invariant 6)**:
   - Never mark a stage or task as complete without verifying against the explicit `## Check` in that stage's `CONTEXT.md`.
   - If a check fails, stop immediately, report the failure, and fix the stage contract/inputs before proceeding.

4. **Lean Catalog (Invariant 2)**:
   - `GEMINI.md` and `AGENTS.md` must remain under 60 lines. They are pure routing tables and must hold zero code or content payloads.
   - Do NOT edit or read `.env` without explicit user permission.

