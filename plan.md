# 3D HOUSE FS Upgrade Plan

## Goal
Upgrade the current 3D house and fengshui workspace into a richer, more practical editor: cleaner UI, a fuller multi-layer 3D compass, stronger 3D editing feedback, and everyday functions such as undo, redo, browser save, and JSON export.

## Current Review
- The project is a Next.js monorepo with the main app in `apps/web`, shared layout/fengshui logic in `packages/core`, and browser-side simulation in `packages/simulation`.
- The existing workspace already has modeling, analysis, renovation report modes, Three.js rendering, heat/airflow overlays, fengshui analysis, local layout import/export, and template creation.
- The biggest usability gaps are concentrated in `AppShell`, `LayoutEditor`, `SceneViewport`, `ThreeSceneCanvas`, and `globals.css`: actions are powerful but not surfaced as a polished workflow, the compass looks thin, and editor recovery actions are not visible enough.

## Scope
- In: UI polish, topbar action controls, undo/redo history, quick save/export, improved 3D compass visual layers, stronger scene polish, better editor status feedback.
- Out: backend CFD replacement, real engineering-grade Navier-Stokes simulation, payment/account systems, and major data-model migrations.

## Action Items
- [x] Audit project structure, scripts, and key frontend modules.
- [x] Record this feasible implementation plan in `plan.md`.
- [ ] Add layout history management in `AppShell` so template changes, room edits, openings, devices, sensors, AI drafts, imports, and drawn walls can be undone/redone.
- [ ] Add high-frequency topbar actions for undo, redo, save to browser, and export JSON with compact status feedback.
- [ ] Redesign the Three.js compass as a bottom multi-ring plate with direction, 24-mountain, bagua/star, 64-hexagram, fengshui, active-sector, needle, glow, and scan effects.
- [ ] Improve workspace styling so panels feel denser, clearer, and more human-friendly across desktop and mobile.
- [ ] Keep existing local file panel import/export behavior compatible with the new topbar save flow.
- [ ] Run `npm.cmd run typecheck` and, if practical, launch the dev server for a visual smoke test.

## Implementation Notes
- Keep the current `HouseLayout` model and simulation pipeline unchanged.
- Prefer local helper functions in `AppShell` over a broad state-management rewrite.
- Keep the compass data static for now, but structure it as arrays so more professional rings can be added later.
- Use browser `localStorage` for quick save because the project already stores layout JSON there.

## Risks
- The source contains Chinese UI text; some terminals display it as mojibake, so edits should avoid unnecessary rewrites of existing copy.
- Undo history should clone layouts before storage to avoid accidental mutation.
- Compass labels need to remain readable without overwhelming the 3D house model.
