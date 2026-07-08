# 3D HOUSE FS

3D HOUSE FS is a monorepo prototype for a beginner-friendly house layout editor with:

- guided layout creation
- heatmap visualization
- room airflow visualization
- fengshui information panels with a 3D compass

## Structure

- `apps/web`: Next.js front-end prototype
- `packages/core`: shared layout types, validation, geometry helpers, fengshui helpers
- `packages/simulation`: heatmap and airflow calculation helpers
- `backend`: FastAPI service stubs for analysis and future AI/CFD expansion

## Run

### Web

```bash
npm install
npm run dev
```

### Backend

```bash
python -m venv .venv
.venv\\Scripts\\activate
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload
```

## Current scope

This first implementation focuses on the MVP backbone:

- shared `HouseLayout` schema
- template-driven beginner editor experience
- heatmap, airflow, and fengshui information views
- 3D compass-oriented fengshui visualization
- backend API stubs aligned with the same data model

## Notes

- Fengshui outputs are informational references, not prescriptive conclusions.
- The front-end currently uses a lightweight visualization-first scene instead of a full Three.js production renderer.

