# 3D HOUSE FS Stabilization, Productization, and SketchUp-Style Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Turn the current feature-rich prototype into a secure, testable, maintainable product foundation, while adding a constrained SketchUp-inspired 3D editing workflow for the existing single-floor rectangular-house domain.

**Architecture:** packages/core becomes the only versioned runtime data contract and domain-command layer. packages/simulation consumes validated topology in a versioned Web Worker protocol. apps/web separates editing state, AI boundaries, 3D layers, and SketchUp-style tool interaction. The Python backend remains an explicitly experimental integration stub rather than a second simulation implementation.

**Tech Stack:** Next.js 15, React 19, TypeScript, Three.js, React Three Fiber, Zod, Vitest, Testing Library, Playwright, Turborepo, FastAPI, Pydantic, Pytest.

---

## Confirmed scope

This plan implements the approved design in:

- docs/superpowers/specs/2026-07-10-stabilization-and-productization-design.md

The delivery estimate is 6–8 weeks for one engineer. The critical order is:

1. Quality baseline.
2. Versioned data integrity.
3. AI/API security.
4. Simulation topology and regression tests.
5. Frontend decomposition.
6. SketchUp-inspired editing.
7. Cross-device acceptance and documentation.

This plan does not implement engineering-grade CFD, arbitrary solid modeling, free-form Push/Pull, CAD/BIM import, cloud accounts, or multi-floor projects.

## Current evidence and known baseline

- npm.cmd run typecheck currently passes for all three workspaces.
- npm.cmd run build currently passes.
- python -m pytest backend/tests -q currently reports 2 passed.
- npm.cmd run lint currently fails because next lint is deprecated and no ESLint configuration exists.
- apps/web/src/components/AppShell.tsx is about 1,200 lines.
- apps/web/src/components/Scene/ThreeSceneCanvas.tsx is about 2,650 lines and contains unused legacy overlays.
- apps/web/src/app/globals.css is about 1,500 lines.
- TypeScript packages have no automated unit tests.
- Browser AI configuration currently crosses the application server.
- Root plan.md is stale and is replaced by this document.

## Planned file map

### Root engineering files

- Modify: package.json
- Modify: package-lock.json
- Modify: .gitignore
- Create: eslint.config.mjs
- Create: vitest.config.ts
- Create: playwright.config.ts
- Create: playwright.baseline.config.ts
- Create: .github/workflows/ci.yml
- Create: scripts/measure-simulation.ts
- Create: docs/quality/performance-baseline.md

### Core data and domain

- Modify: packages/core/package.json
- Modify: packages/core/src/index.ts
- Modify: packages/core/src/types/layout.ts
- Modify: packages/core/src/validation/layout.ts
- Modify: packages/core/src/geometry/layout-helpers.ts
- Modify: packages/core/src/geometry/templates.ts
- Create: packages/core/src/schema/layout-schema.ts
- Create: packages/core/src/schema/layout-migrations.ts
- Create: packages/core/src/domain/entity-id.ts
- Create: packages/core/src/domain/layout-commands.ts
- Create: packages/core/src/topology/layout-topology.ts
- Create: packages/core/test/layout-schema.test.ts
- Create: packages/core/test/layout-migrations.test.ts
- Create: packages/core/test/layout-commands.test.ts
- Create: packages/core/test/layout-topology.test.ts
- Create: packages/core/test/fixtures/*.json

### Simulation

- Modify: packages/simulation/package.json
- Modify: packages/simulation/src/types.ts
- Modify: packages/simulation/src/grid/rasterize.ts
- Modify: packages/simulation/src/heat/solveHeat.ts
- Modify: packages/simulation/src/airflow/solveFlow.ts
- Modify: packages/simulation/src/summarize.ts
- Create: packages/simulation/src/worker-transfer.ts
- Create: packages/simulation/test/fixtures.ts
- Create: packages/simulation/test/heat.test.ts
- Create: packages/simulation/test/airflow.test.ts
- Create: packages/simulation/test/determinism.test.ts
- Create: packages/simulation/test/worker-transfer.test.ts

### Web application

- Modify: apps/web/package.json
- Modify: apps/web/.env.example
- Modify: apps/web/src/components/AppShell.tsx
- Modify: apps/web/src/components/Scene/SceneViewport.tsx
- Modify: apps/web/src/components/Scene/ThreeSceneCanvas.tsx
- Modify: apps/web/src/components/Editor/LayoutEditor.tsx
- Modify: apps/web/src/components/Analysis/ModelingPanel.tsx
- Modify: apps/web/src/simulation/useSimulation.ts
- Modify: apps/web/src/simulation/simulation.worker.ts
- Create: apps/web/src/simulation/useSimulation.test.tsx
- Modify: apps/web/src/utils/serializers/layout-storage.ts
- Modify: apps/web/src/app/api/ai/layout-from-text/route.ts
- Modify: apps/web/src/app/api/ai/server-config-status/route.ts
- Delete: apps/web/src/app/api/analyze/route.ts
- Delete: apps/web/src/components/EditorWizard/QuickStartWizard.tsx
- Create: apps/web/src/ai/provider-draft.ts
- Create: apps/web/src/ai/browser-provider.ts
- Create: apps/web/src/app/api/ai/_lib/request-guards.ts
- Create: apps/web/src/app/api/ai/_lib/rate-limit.ts
- Create: apps/web/src/hooks/useLayoutEditor.ts
- Create: apps/web/src/hooks/useLayoutHistory.ts
- Create: apps/web/src/hooks/useAiDraft.ts
- Create: apps/web/src/hooks/useWorkspaceUi.ts
- Create: apps/web/src/components/Studio/StudioTopbar.tsx
- Create: apps/web/src/components/Studio/ToolRail.tsx
- Create: apps/web/src/components/Studio/Inspector.tsx
- Create: apps/web/src/components/Studio/AnalysisDock.tsx
- Create: apps/web/src/components/Scene/layers/*.tsx
- Create: apps/web/src/components/Scene/interaction/EditorInteractionPlane.tsx
- Create: apps/web/src/components/Scene/interaction/SceneCameraController.tsx
- Create: apps/web/src/components/Editor/MeasurementBox.tsx
- Create: apps/web/src/components/Editor/ToolStatusBar.tsx
- Create: apps/web/src/components/Editor/MobileToolControls.tsx
- Modify: apps/web/src/components/Scene/interaction/EditorInteractionPlane.tsx
- Modify: apps/web/src/components/Scene/interaction/SceneCameraController.tsx
- Create: apps/web/src/editor/tools.ts
- Create: apps/web/src/editor/scene-coordinates.ts
- Create: apps/web/src/editor/inference.ts
- Create: apps/web/src/editor/tool-reducer.ts
- Create: apps/web/src/editor/*.test.ts
- Create: apps/web/src/hooks/*.test.tsx
- Create: apps/web/src/test/setup.ts
- Create: apps/web/e2e/helpers/editor.ts
- Create: apps/web/e2e/baseline-performance.spec.ts
- Create: apps/web/e2e/*.spec.ts

### CSS and backend

- Modify: apps/web/src/app/globals.css
- Create: apps/web/src/styles/tokens.css
- Create: apps/web/src/styles/studio.css
- Create: apps/web/src/styles/editor.css
- Create: apps/web/src/styles/analysis.css
- Create: apps/web/src/styles/responsive.css
- Modify: backend/models.py
- Modify: backend/main.py
- Modify: backend/tests/test_services.py
- Create: backend/tests/fixtures/layout-v2.json
- Modify: README.md

---

# Phase P0: Engineering baseline

### Task 1: Replace the broken lint command and add test tooling

**Files:**

- Modify: package.json
- Modify: package-lock.json
- Modify: apps/web/package.json
- Modify: packages/core/package.json
- Modify: packages/simulation/package.json
- Create: eslint.config.mjs
- Create: vitest.config.ts

- [ ] **Step 1: Capture the current lint failure**

Run:

~~~powershell
npm.cmd run lint
~~~

Expected: FAIL because next lint requests interactive ESLint setup.

- [ ] **Step 2: Install the approved development dependencies**

Run the runtime dependency install first:

~~~powershell
npm.cmd install zod@^4 --workspace @fengshui/core
~~~

Then install development dependencies:

~~~powershell
npm.cmd install -D eslint@^9 eslint-config-next@15.5.20 typescript-eslint@^8 vitest@^3 @vitest/coverage-v8@^3 jsdom@^26 @testing-library/react@^16 @testing-library/jest-dom@^6 @playwright/test@^1.55 tsx@^4
~~~

Expected: package.json and package-lock.json update without peer dependency errors.

- [ ] **Step 3: Create the flat ESLint configuration**

Create eslint.config.mjs with:

~~~javascript
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  globalIgnores([
    "**/.next/**",
    "**/dist/**",
    "**/coverage/**",
    "**/.turbo/**",
    "**/*.tsbuildinfo",
    "output/**"
  ]),
  ...nextVitals,
  ...nextTypescript,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "error"
    }
  }
]);
~~~

- [ ] **Step 4: Create the Vitest configuration**

Create vitest.config.ts with:

~~~typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "packages/**/test/**/*.test.ts",
      "apps/web/src/**/*.test.ts",
      "apps/web/src/**/*.test.tsx"
    ],
    environment: "node",
    environmentMatchGlobs: [
      ["apps/web/src/**/*.test.tsx", "jsdom"],
      ["apps/web/src/hooks/**/*.test.ts", "jsdom"]
    ],
    setupFiles: ["apps/web/src/test/setup.ts"],
    passWithNoTests: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: [
        "packages/core/src/**/*.ts",
        "packages/simulation/src/**/*.ts",
        "apps/web/src/editor/**/*.ts",
        "apps/web/src/hooks/**/*.ts"
      ]
    }
  }
});
~~~

Create apps/web/src/test/setup.ts:

~~~typescript
import "@testing-library/jest-dom/vitest";
~~~

- [ ] **Step 5: Replace workspace scripts**

Set the root scripts to:

~~~json
{
  "lint": "eslint .",
  "typecheck": "turbo run typecheck",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage",
  "build": "turbo run build",
  "e2e": "playwright test",
  "start:web": "npm.cmd run start --workspace web -- --hostname 127.0.0.1 --port 3000"
}
~~~

Remove apps/web script next lint, replace it with eslint src, and add start: next start.

- [ ] **Step 6: Run lint to expose real source issues**

Run:

~~~powershell
npm.cmd run lint
~~~

Expected: FAIL only on actionable unused/dead code or style errors, not configuration prompts.

- [ ] **Step 7: Fix the initial lint findings without broad refactors**

Remove unused imports, mark intentionally unused callback arguments with an underscore, and do not disable no-unused-vars globally.

- [ ] **Step 8: Run the baseline quality commands**

Run:

~~~powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test
~~~

Expected: PASS; test may initially report no tests only until Task 3, but the command must exit successfully.

- [ ] **Step 9: Commit the tooling baseline**

~~~powershell
git add package.json package-lock.json apps/web/package.json packages/core/package.json packages/simulation/package.json eslint.config.mjs vitest.config.ts apps/web/src/test/setup.ts
git commit -m "chore: establish lint and test tooling"
~~~

### Task 2: Clean generated artifacts, add CI, and record performance baselines

**Files:**

- Modify: .gitignore
- Create: .github/workflows/ci.yml
- Create: scripts/measure-simulation.ts
- Create: playwright.baseline.config.ts
- Create: apps/web/e2e/baseline-performance.spec.ts
- Modify: apps/web/src/simulation/useSimulation.ts
- Modify: apps/web/src/components/AppShell.tsx
- Create: docs/quality/performance-baseline.md

- [ ] **Step 1: Add generated paths to .gitignore**

Add:

~~~gitignore
*.tsbuildinfo
output/
playwright-report/
test-results/
coverage/
~~~

- [ ] **Step 2: Stop tracking generated files**

Run:

~~~powershell
git rm --cached apps/web/tsconfig.tsbuildinfo
git rm -r --cached output
~~~

Expected: files remain locally if present but are staged for removal from Git.

- [ ] **Step 3: Write the simulation baseline script**

Create scripts/measure-simulation.ts:

~~~typescript
import { createTemplateLayout } from "@fengshui/core";
import { generateSimulation } from "@fengshui/simulation";
import type { TemplateId } from "@fengshui/core";

const templates: TemplateId[] = ["blank", "compact-two-room", "family-three-room"];

for (const templateId of templates) {
  const layout = createTemplateLayout(templateId);
  generateSimulation(layout);
  const samples: number[] = [];

  for (let run = 0; run < 5; run += 1) {
    const start = performance.now();
    generateSimulation(layout);
    samples.push(performance.now() - start);
  }

  samples.sort((left, right) => left - right);
  console.log(JSON.stringify({
    templateId,
    medianMs: Number(samples[2].toFixed(2)),
    samplesMs: samples.map((value) => Number(value.toFixed(2)))
  }));
}
~~~

- [ ] **Step 4: Run and record the baseline**

Run:

~~~powershell
npx.cmd tsx --tsconfig tsconfig.json scripts/measure-simulation.ts
~~~

Record this as the pure synchronous solver baseline only. Do not use it by itself to choose the Worker fallback cap.

- [ ] **Step 5: Instrument browser simulation timing and long tasks**

In useSimulation, add performance marks named simulation-request-start and simulation-request-end around each request. In AppShell, add stable test hooks:

~~~tsx
<div data-testid="simulation-status" data-state={simulationStatus}>
  ...
</div>
~~~

The instrumentation must not include layout JSON or user content in mark names.

- [ ] **Step 6: Create the production browser baseline config**

Create playwright.baseline.config.ts with one desktop and one mobile project, a production webServer using npm.cmd run start:web, and testMatch restricted to baseline-performance.spec.ts.

The baseline test must run each default template five times after one warm-up and collect:

- time from simulation request start to ready.
- total and maximum PerformanceObserver longtask duration.
- desktop 1440×900 and mobile 390×844 results.
- page First Load JS from the preceding production build output.

Write the test output as JSON to test-results/performance-baseline.json; the engineer then copies the reviewed values into docs/quality/performance-baseline.md.

- [ ] **Step 7: Run and record the browser baseline**

Run:

~~~powershell
npm.cmd run build
npx.cmd playwright install chromium
npx.cmd playwright test --config playwright.baseline.config.ts
~~~

Record Node version, browser version, CPU model, pure solver medians, Worker-ready medians, long tasks, homepage First Load JS, and date. Task 10 derives the fallback cap from the browser results, not from the synchronous script alone.

- [ ] **Step 8: Create CI**

Create .github/workflows/ci.yml:

~~~yaml
name: CI

on:
  push:
  pull_request:

jobs:
  quality:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: npm ci
      - run: pip install -r backend/requirements.txt
      - run: npm.cmd run lint
      - run: npm.cmd run typecheck
      - run: npm.cmd run test
      - run: npm.cmd run build
      - run: python -m pytest backend/tests
~~~

- [ ] **Step 9: Verify the clean gate**

Run:

~~~powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
python -m pytest backend/tests
git status --short
~~~

Expected: all commands pass; status contains only intended P0 changes.

- [ ] **Step 10: Commit P0**

~~~powershell
git add .gitignore .github/workflows/ci.yml scripts/measure-simulation.ts playwright.baseline.config.ts apps/web/e2e/baseline-performance.spec.ts apps/web/src/simulation/useSimulation.ts apps/web/src/components/AppShell.tsx docs/quality/performance-baseline.md
git add -u apps/web/tsconfig.tsbuildinfo output
git commit -m "chore: add CI and repository hygiene"
~~~

---

# Phase P1: Versioned data integrity

### Task 3: Add HouseLayout v2 runtime schema and migration fixtures

**Files:**

- Modify: packages/core/src/types/layout.ts
- Modify: packages/core/src/index.ts
- Create: packages/core/src/schema/layout-schema.ts
- Create: packages/core/src/schema/layout-migrations.ts
- Create: packages/core/test/layout-schema.test.ts
- Create: packages/core/test/layout-migrations.test.ts
- Create: packages/core/test/fixtures/layout-unversioned.json
- Create: packages/core/test/fixtures/layout-v1.json
- Create: packages/core/test/fixtures/layout-v2.json
- Create: packages/core/test/fixtures/layout-future.json
- Create: packages/core/test/fixtures/layout-v1-broken.json

- [ ] **Step 1: Write failing schema limit tests**

Tests must cover:

- schemaVersion 2 accepted.
- more than 32 rooms rejected.
- more than 256 walls rejected.
- more than 256 openings rejected.
- more than 64 sensors rejected.
- more than 64 devices rejected.
- duplicate entity IDs rejected.
- NaN, Infinity, negative dimensions, and out-of-bounds rooms rejected.
- positive-area room overlap rejected.
- touching room edges accepted.
- orphan openings and devices rejected.
- opening width/offset outside its wall rejected.
- device point outside its assigned room rejected.
- non-integer schemaVersion rejected.

Run:

~~~powershell
npm.cmd run test -- packages/core/test/layout-schema.test.ts
~~~

Expected: FAIL because HouseLayoutSchema does not exist.

- [ ] **Step 2: Define constants and primitive schemas**

Create layout-schema.ts with these exported limits:

~~~typescript
export const CURRENT_SCHEMA_VERSION = 2 as const;

export const LAYOUT_LIMITS = {
  rooms: 32,
  walls: 256,
  openings: 256,
  sensors: 64,
  devices: 64
} as const;
~~~

Define strict Zod schemas for points, bounds, rooms, walls, openings, sensors, devices, weather, orientation, and metadata. Use superRefine for cross-entity invariants.

- [ ] **Step 3: Make HouseLayout derive from the schema**

Replace the hand-maintained HouseLayout interface with:

~~~typescript
export type HouseLayout = z.infer<typeof HouseLayoutSchema>;
~~~

Keep public supporting types exported from the schema module so existing consumers do not import Zod internals.

- [ ] **Step 4: Implement one parse entry point**

Export:

~~~typescript
export interface LayoutParseResult {
  success: boolean;
  layout?: HouseLayout;
  issues: ValidationIssue[];
}

export function parseHouseLayoutDocument(input: unknown): LayoutParseResult;
~~~

No application code may cast unknown JSON directly to HouseLayout after this task.

- [ ] **Step 5: Write failing migration tests**

Required fixtures:

- missing schemaVersion is treated as v1.
- explicit v1 migrates to v2.
- v2 remains v2.
- future version rejects.
- broken v1 rejects with field issues.

- [ ] **Step 6: Implement v1 to v2 migration**

Migration rules:

- Add schemaVersion: 2.
- Add devices: [] when missing.
- Preserve IDs and numeric values.
- Recompute facingLabel and frontDoorLabel from degrees.
- Do not silently invent rooms or repair invalid geometry.
- Return explicit UNSUPPORTED_VERSION for versions greater than 2.

- [ ] **Step 7: Run schema and migration tests**

~~~powershell
npm.cmd run test -- packages/core/test/layout-schema.test.ts packages/core/test/layout-migrations.test.ts
~~~

Expected: PASS.

- [ ] **Step 8: Export the schema API**

Update packages/core/src/index.ts to export schema, migrations, and parseHouseLayoutDocument.

- [ ] **Step 9: Commit**

~~~powershell
git add packages/core
git commit -m "feat(core): add versioned layout schema"
~~~

### Task 4: Replace array-length IDs and mutations with tested domain commands

**Files:**

- Create: packages/core/src/domain/entity-id.ts
- Create: packages/core/src/domain/layout-commands.ts
- Create: packages/core/test/layout-commands.test.ts
- Modify: packages/core/src/geometry/layout-helpers.ts
- Modify: packages/core/src/index.ts

- [ ] **Step 1: Write the duplicate-ID regression test**

Use a layout containing custom-wall-1 and custom-wall-3, delete custom-wall-2, then add a wall.

Expected: the new ID is unique and no existing wall is overwritten.

- [ ] **Step 2: Implement deterministic unique IDs**

Create:

~~~typescript
export function nextEntityId(prefix: string, existingIds: Iterable<string>): string {
  const used = new Set(existingIds);
  let index = 1;
  while (used.has(prefix + "-" + index)) {
    index += 1;
  }
  return prefix + "-" + index;
}
~~~

Use this helper for walls, openings, devices, sensors, and AI-created entities.

- [ ] **Step 3: Define command result types**

~~~typescript
export interface LayoutCommandFailure {
  ok: false;
  issues: ValidationIssue[];
}

export interface LayoutCommandSuccess {
  ok: true;
  layout: HouseLayout;
}

export type LayoutCommandResult = LayoutCommandFailure | LayoutCommandSuccess;
~~~

- [ ] **Step 4: Write failing command tests**

Cover:

- moving a room within bounds.
- rejecting room overlap.
- resizing without exceeding bounds.
- removing a custom wall cascades its openings.
- removing a room cascades devices, sensors assigned by position, openings, and derived walls.
- moving a custom wall preserves opening offset.
- derived room wall cannot be independently deleted.
- moving a door/window only changes wall offset.

- [ ] **Step 5: Implement commands**

Implement and export:

~~~typescript
moveRoom
resizeRoom
addCustomWall
moveCustomWall
removeWall
removeRoom
addOpening
moveOpening
removeOpening
addDevice
moveDevice
removeDevice
addSensor
moveSensor
removeSensor
replaceLayout
~~~

Each command validates the candidate layout before returning ok: true.

- [ ] **Step 6: Remove duplicate mutation logic**

Update geometry/layout-helpers.ts so it contains geometry helpers, not application transaction logic. Keep syncDerivedLayoutData only as a migration compatibility wrapper until Task 5 removes call sites.

- [ ] **Step 7: Run tests**

~~~powershell
npm.cmd run test -- packages/core/test/layout-commands.test.ts
npm.cmd run typecheck
~~~

Expected: PASS.

- [ ] **Step 8: Commit**

~~~powershell
git add packages/core
git commit -m "feat(core): add validated layout commands"
~~~

### Task 5: Route every input through the v2 contract

**Files:**

- Modify: apps/web/src/utils/serializers/layout-storage.ts
- Modify: apps/web/src/components/Templates/LayoutPersistencePanel.tsx
- Modify: apps/web/src/components/AppShell.tsx
- Modify: apps/web/src/components/Scene/SceneViewport.tsx
- Modify: apps/web/src/components/Editor/LayoutEditor.tsx
- Modify: apps/web/src/app/api/ai/layout-from-text/route.ts
- Delete: apps/web/src/app/api/analyze/route.ts
- Modify: packages/core/src/geometry/templates.ts
- Modify: docs/samples/demo-layout.json

- [ ] **Step 1: Write serializer tests**

Create apps/web/src/utils/serializers/layout-storage.test.ts covering:

- unversioned import migration.
- v2 round trip.
- future version rejection.
- malformed arrays rejection.
- actionable issue text returned to the UI.

- [ ] **Step 2: Replace normalizeImportedLayout**

layout-storage.ts must call parseHouseLayoutDocument. Remove rooms as HouseLayout["rooms"] and all equivalent unsafe assertions.

- [ ] **Step 3: Update the persistence panel**

Display structured issues without replacing the active layout. Successful import must return a v2 layout.

- [ ] **Step 4: Update templates and samples**

Every createTemplateLayout result and docs/samples/demo-layout.json must include schemaVersion: 2.

- [ ] **Step 5: Remove the unused analysis route**

Confirm no fetch call references /api/analyze:

~~~powershell
rg -n "/api/analyze|generateHeatmap|generateAirflow" apps packages
~~~

Delete apps/web/src/app/api/analyze/route.ts.

- [ ] **Step 6: Validate AI-generated layouts**

The AI route must call the same v2 parser after draft normalization. Invalid provider output returns a fallback response without exposing malformed layout data.

- [ ] **Step 7: Replace all frontend layout mutation call sites**

Update AppShell, SceneViewport, and LayoutEditor so every layout change dispatches a Task 4 domain command. In particular replace direct object reconstruction for room movement/resize, wall creation/deletion, openings, devices, sensors, templates, imports, and AI replacement.

SceneViewport must emit a command intent or call a typed onCommand callback; it must not construct a new HouseLayout. AppShell may remain a large component until P4, but its mutation boundary must already be the core command layer.

Run:

~~~powershell
rg -n "syncDerivedLayoutData|setLayout\(|onCommitLayout" apps/web/src/components apps/web/src/utils
~~~

Expected: syncDerivedLayoutData remains only in migration/compatibility code; no interactive editor mutation bypasses domain commands.

- [ ] **Step 8: Add a P1 mutation-boundary integration test**

Render the editor, perform one room move, one wall add, one opening add, and one invalid overlap. Verify valid actions return v2 layouts and the invalid action leaves the previous layout unchanged with an issue message.

- [ ] **Step 9: Run gates**

~~~powershell
npm.cmd run test
npm.cmd run typecheck
npm.cmd run build
~~~

Expected: PASS.

- [ ] **Step 10: Commit**

~~~powershell
git add apps/web packages/core docs/samples
git commit -m "feat: enforce layout schema at every input"
~~~

---

# Phase P2: AI and API security

### Task 6: Move browser-key AI calls into the browser

**Files:**

- Create: apps/web/src/ai/provider-draft.ts
- Create: apps/web/src/ai/browser-provider.ts
- Create: apps/web/src/ai/browser-provider.test.ts
- Modify: apps/web/src/components/Analysis/ModelingPanel.tsx
- Modify: apps/web/src/components/AppShell.tsx

- [ ] **Step 1: Extract provider draft normalization**

Move provider JSON to HouseLayout normalization out of the server route into provider-draft.ts. The module must import only browser-safe code and return a v2 parse result.

- [ ] **Step 2: Write failing browser-provider tests**

Mock fetch and verify:

- Authorization uses the browser key.
- the request goes directly to configured baseUrl.
- no request is made to /api/ai/layout-from-text in browser mode.
- timeout produces a typed error.
- CORS/network failure produces the explicit server-mode suggestion.
- images are capped before encoding.

- [ ] **Step 3: Implement direct browser requests**

browser-provider.ts must:

- enforce HTTPS except localhost development addresses.
- limit prompt to 4,000 characters.
- limit images to 3 and 5 MB each.
- encode allowed image MIME types only.
- use AbortController.
- parse and validate the provider draft locally.

- [ ] **Step 4: Correct the privacy copy**

ModelingPanel must state:

- Browser mode sends the key directly to the selected Provider.
- The key stays in localStorage and does not pass through the application server.
- Provider CORS may require server mode.

- [ ] **Step 5: Wire browser mode**

Until Task 11 extracts useAiDraft, update the current AppShell branch so browser mode calls requestBrowserAiDraft directly.

- [ ] **Step 6: Run tests**

~~~powershell
npm.cmd run test -- apps/web/src/ai/browser-provider.test.ts
npm.cmd run typecheck
~~~

Expected: PASS.

- [ ] **Step 7: Commit**

~~~powershell
git add apps/web/src/ai apps/web/src/components
git commit -m "fix(ai): keep browser keys out of the server"
~~~

### Task 7: Make server AI private-by-default and bounded

**Files:**

- Modify: apps/web/.env.example
- Create: apps/web/src/app/api/ai/_lib/request-guards.ts
- Create: apps/web/src/app/api/ai/_lib/rate-limit.ts
- Create: apps/web/src/app/api/ai/_lib/request-guards.test.ts
- Create: apps/web/src/app/api/ai/_lib/rate-limit.test.ts
- Modify: apps/web/src/app/api/ai/layout-from-text/route.ts
- Modify: apps/web/src/app/api/ai/server-config-status/route.ts

- [ ] **Step 1: Add explicit environment flags**

Document:

~~~env
AI_SERVER_ENABLED=false
AI_SERVER_PASSWORD=
AI_TRUST_PROXY=false
AI_PROVIDER=openai
AI_BASE_URL=https://api.openai.com/v1
AI_CHAT_COMPLETIONS_PATH=/chat/completions
AI_TIMEOUT_MS=20000
AI_MODEL=gpt-4.1-mini
AI_API_KEY=
~~~

- [ ] **Step 2: Write request guard tests**

Cover:

- disabled server returns 404 or 503 without provider details.
- wrong password returns 401.
- prompt above 4,000 characters returns 413.
- more than 3 images returns 413.
- image above 5 MB returns 413.
- invalid MIME returns 415.
- three maximum-size 5 MiB images plus prompt/JSON overhead are accepted.
- chunked request without Content-Length stops once total bytes exceed 24 MiB.
- slow body streaming exceeding 10 seconds cancels the reader and returns REQUEST_TIMEOUT.
- Provider response above 2 MB returns PROVIDER_RESPONSE_TOO_LARGE.
- client body cannot override provider URL, path, model, or key.

- [ ] **Step 3: Replace multipart with bounded streaming JSON**

Server mode accepts application/json only:

~~~typescript
interface ServerAiRequestBody {
  prompt: string;
  serverPassword: string;
  referenceImages: Array<{
    name: string;
    mediaType: string;
    dataUrl: string;
  }>;
}
~~~

The browser validates and converts at most three 5 MB files before sending. The route must not call request.json or request.formData directly.

Implement readBoundedJson(request, { maxBytes: 24 * 1024 * 1024, timeoutMs: 10_000 }):

1. Reject Content-Length above maxBytes when present.
2. Read request.body with getReader.
3. Race every reader.read call against the remaining deadline.
4. Cancel the reader immediately on timeout or once accumulated bytes exceed maxBytes.
5. Decode and JSON.parse only after the bounded read completes.
6. Re-check decoded Data URL byte lengths, count, and MIME allowlist.

This application-level reader must enforce the limit even when Content-Length is missing or the request uses chunked transfer. The deployment proxy should still apply the same or a stricter raw body limit as defense in depth.

- [ ] **Step 4: Write rate-limit tests with a fake clock**

Test:

- 10 requests per 10-minute bucket allowed.
- request 11 returns 429 and Retry-After.
- maximum 2 concurrent requests per client bucket.
- maximum 4 global provider requests.
- counters release in finally.
- AI_TRUST_PROXY=false ignores X-Forwarded-For and uses the global untrusted bucket.
- AI_TRUST_PROXY=true uses the first normalized forwarded address.

- [ ] **Step 5: Implement the limiter**

Expose:

~~~typescript
export async function withAiRequestPermit<T>(
  request: Request,
  operation: () => Promise<T>
): Promise<T>;
~~~

The function must acquire per-client and global permits, release them in finally, and throw typed HTTP errors.

- [ ] **Step 6: Bound Provider response reading**

Before response.json:

1. Reject Content-Length above 2 MB when present.
2. Read response.body with a stream reader.
3. Stop and cancel the reader once accumulated bytes exceed 2 MB.
4. Decode and parse JSON only after the bounded read finishes.
5. Keep the existing Provider timeout active across headers and body reading.

- [ ] **Step 7: Update the server-mode client payload**

Reuse the browser-side bounded image encoder from Task 6 and POST the JSON shape above. Do not append FormData, browserConfig, baseUrl, model, or path.

- [ ] **Step 8: Remove browser configuration from the server route**

The route accepts only prompt, serverPassword, and referenceImages. Provider configuration comes only from environment variables.

- [ ] **Step 9: Sanitize errors**

Responses must use stable codes such as AI_DISABLED, AUTH_FAILED, RATE_LIMITED, INPUT_TOO_LARGE, PROVIDER_TIMEOUT, PROVIDER_FAILED. Do not return baseUrl or raw provider errors.

- [ ] **Step 10: Run security tests and build**

~~~powershell
npm.cmd run test -- apps/web/src/app/api/ai
npm.cmd run typecheck
npm.cmd run build
~~~

Expected: PASS.

- [ ] **Step 11: Commit**

~~~powershell
git add apps/web/.env.example apps/web/src/app/api/ai
git commit -m "fix(ai): harden server provider access"
~~~

---

# Phase P3: Simulation topology and trustworthy regression tests

### Task 8: Build normalized wall topology

**Files:**

- Create: packages/core/src/topology/layout-topology.ts
- Create: packages/core/test/layout-topology.test.ts
- Modify: packages/core/src/index.ts

- [ ] **Step 1: Write topology fixtures**

Create tests for:

- two identical shared wall segments.
- one long wall partially overlapped by a shorter neighboring wall.
- T-junction.
- exterior wall.
- internal door on a partial shared wall.
- external window.
- diagonal custom wall treated as internal unless explicitly modeled otherwise.

- [ ] **Step 2: Define topology types**

~~~typescript
export interface TopologyInterval {
  startOffset: number;
  endOffset: number;
  openingId?: string;
}

export interface TopologyEdge {
  id: string;
  start: LayoutPoint;
  end: LayoutPoint;
  ownerRoomIds: string[];
  exterior: boolean;
  sourceWallIds: string[];
  openings: TopologyInterval[];
}
~~~

- [ ] **Step 3: Implement line normalization**

For collinear room walls:

1. Project endpoints to a normalized one-dimensional axis.
2. Collect all split coordinates.
3. Create non-overlapping edge intervals.
4. Attach all owning room IDs.
5. Mark ownerRoomIds.length === 1 as exterior.
6. Attach opening intervals by source wall and projected offset.

Custom walls remain internal barriers in this cycle.

- [ ] **Step 4: Verify partial overlap behavior**

Run:

~~~powershell
npm.cmd run test -- packages/core/test/layout-topology.test.ts
~~~

Expected: PASS; the shared subsegment has two owners and exterior false.

- [ ] **Step 5: Export buildLayoutTopology**

Update packages/core/src/index.ts.

- [ ] **Step 6: Commit**

~~~powershell
git add packages/core/src/topology packages/core/test/layout-topology.test.ts packages/core/src/index.ts
git commit -m "feat(core): normalize shared wall topology"
~~~

### Task 9: Reuse topology/grid and add solver acceptance tests

**Files:**

- Modify: packages/simulation/src/grid/rasterize.ts
- Modify: packages/simulation/src/heat/solveHeat.ts
- Modify: packages/simulation/src/airflow/solveFlow.ts
- Modify: packages/simulation/src/summarize.ts
- Modify: packages/simulation/src/types.ts
- Create: packages/simulation/test/fixtures.ts
- Create: packages/simulation/test/fixtures/baseline-diagnostics.json
- Create: packages/simulation/test/heat.test.ts
- Create: packages/simulation/test/airflow.test.ts
- Create: packages/simulation/test/determinism.test.ts
- Modify: apps/web/src/components/Analysis/AnalysisControlsPanel.tsx
- Modify: apps/web/src/components/Analysis/HeatmapPanel.tsx
- Modify: apps/web/src/components/Analysis/AirflowPanel.tsx

- [ ] **Step 1: Freeze deterministic fixtures**

Create programmatic fixtures for:

- two rooms with a solid shared wall.
- the same layout with an internal door.
- one room with AC.
- one room with kitchen heat.
- two exterior windows aligned with wind.
- partial shared wall with internal door.

Avoid Date.now and random IDs in fixtures.

- [ ] **Step 2: Capture pre-change diagnostics**

Before changing rasterize or solveFlow, run the fixtures against current code and save heat residual/means plus flow divergence, pressure span, mean speed, and inlet count to baseline-diagnostics.json. This file is characterization evidence, not the final acceptance target.

- [ ] **Step 3: Write failing heat acceptance tests**

Assertions:

- door case neighboring-room response is at least 2 times solid-wall response.
- AC lowers average room temperature by at least 0.1°C.
- kitchen heat raises average room temperature by at least 0.1°C.

- [ ] **Step 4: Write failing airflow acceptance tests**

Assertions:

- windward window becomes a positive inlet.
- leeward window is not a positive inlet.
- average pressure near the windward opening is greater than average pressure near the leeward opening for the fixed wind fixture.
- internal door position is absent from inlets.
- divergenceMean is at most 0.02.
- divergenceMax is at most 0.25.

Apply the regression guard from the spec: when the saved baseline was already below an absolute divergence threshold, the new result may be at most baseline times 1.10 instead of using the looser absolute threshold.

- [ ] **Step 5: Make rasterize consume topology**

Change rasterizeLayout to accept a prebuilt topology and use normalized edge/opening intervals instead of scanning raw walls for the closest full segment.

- [ ] **Step 6: Reuse one grid per simulation request**

Update solveFlow and solveHeat options:

~~~typescript
export interface SimulationGeometry {
  topology: LayoutTopology;
  grid: SimGrid;
}
~~~

generateSimulation builds geometry once, passes it to flow, then passes the same grid and flow field to heat.

- [ ] **Step 7: Remove exact wall-key exterior detection**

Delete exteriorWallMap and wallKey logic from solveFlow. Opening sources use topologyEdge.exterior.

- [ ] **Step 8: Add deterministic tests**

Run the same input twice and require:

- every TypedArray element differs by at most 1e-6.
- rounded room summaries are deeply equal.

- [ ] **Step 9: Add the fixed product-boundary notice**

HeatmapPanel, AirflowPanel, and AnalysisControlsPanel must display a concise persistent notice: physics-lite browser simulation; not engineering CFD or construction-review evidence. Add a component test asserting the notice remains visible in heat and airflow analysis modes.

- [ ] **Step 10: Run the complete simulation suite**

~~~powershell
npm.cmd run test -- packages/simulation/test
npm.cmd run typecheck
~~~

Expected: PASS.

- [ ] **Step 11: Record the new simulation baseline**

Run scripts/measure-simulation.ts and append before/after medians to docs/quality/performance-baseline.md. A median regression above 20% requires explanation before proceeding.

- [ ] **Step 12: Commit**

~~~powershell
git add packages/simulation packages/core apps/web/src/components/Analysis docs/quality/performance-baseline.md
git commit -m "fix(simulation): use validated shared-wall topology"
~~~

### Task 10: Version the Worker protocol and transfer buffers

**Files:**

- Create: packages/simulation/src/worker-transfer.ts
- Create: packages/simulation/test/worker-transfer.test.ts
- Modify: apps/web/src/simulation/simulation.worker.ts
- Modify: apps/web/src/simulation/useSimulation.ts
- Create: apps/web/src/simulation/useSimulation.test.tsx

- [ ] **Step 1: Write transfer-list tests**

Verify the transfer list contains every unique ArrayBuffer from:

- heat temperature.
- heat layers.
- flow pressure, vx, vy, verticalVelocity, vorticity, divergence.
- all grid typed arrays.

No buffer may appear twice.

- [ ] **Step 2: Implement collectSimulationTransferables**

~~~typescript
export function collectSimulationTransferables(
  result: SimulationResult
): Transferable[] {
  const buffers = new Set<ArrayBuffer>();
  // Add each typed-array buffer once.
  return Array.from(buffers);
}
~~~

- [ ] **Step 3: Define the Worker protocol**

~~~typescript
export const SIMULATION_PROTOCOL_VERSION = 1;

export interface SimulationRequest {
  protocolVersion: 1;
  id: number;
  layout: HouseLayout;
}

export interface SimulationSuccess {
  protocolVersion: 1;
  id: number;
  ok: true;
  result: SimulationResult;
}

export interface SimulationFailure {
  protocolVersion: 1;
  id: number;
  ok: false;
  code: string;
  message: string;
}
~~~

- [ ] **Step 4: Transfer buffers from the Worker**

Use:

~~~typescript
ctx.postMessage(message, collectSimulationTransferables(result));
~~~

- [ ] **Step 5: Add controlled fallback**

useSimulation must expose status:

~~~typescript
type SimulationStatus = "idle" | "computing" | "ready" | "worker-unavailable" | "failed";
~~~

Derive the main-thread fallback cell cap from P0 results. Start with 8,000 cells as a provisional cap, then set the final numeric cap so fallback median remains below 250 ms on the reference machine. Larger layouts show an error instead of blocking the main thread.

- [ ] **Step 6: Remove unconditional initial main-thread solving**

Delete the current useMemo(() => generateSimulation(layout), []) initialization. Initialize simulation as null and status as computing, then render a loading placeholder until the first Worker result.

Add tests proving:

- mounting useSimulation does not call generateSimulation on the main thread when Worker construction succeeds.
- Worker-unavailable fallback calls generateSimulation only below the measured cell cap.
- a layout above the cap returns worker-unavailable/failed state without synchronous solving.

- [ ] **Step 7: Handle stale and failed responses**

Only the latest request ID may update state. Worker failure must not reuse a stale captured layout.

- [ ] **Step 8: Run tests**

~~~powershell
npm.cmd run test -- packages/simulation/test/worker-transfer.test.ts apps/web/src/simulation/useSimulation.test.tsx
npm.cmd run typecheck
~~~

Expected: PASS.

- [ ] **Step 9: Commit**

~~~powershell
git add packages/simulation apps/web/src/simulation
git commit -m "perf(simulation): transfer worker field buffers"
~~~

---

# Phase P4: Frontend decomposition and SketchUp-style editing

### Task 11: Extract layout history, editor, AI, and workspace hooks

**Files:**

- Create: apps/web/src/hooks/useLayoutHistory.ts
- Create: apps/web/src/hooks/useLayoutHistory.test.tsx
- Create: apps/web/src/hooks/useLayoutEditor.ts
- Create: apps/web/src/hooks/useLayoutEditor.test.tsx
- Create: apps/web/src/hooks/useAiDraft.ts
- Create: apps/web/src/hooks/useWorkspaceUi.ts
- Modify: apps/web/src/components/AppShell.tsx

- [ ] **Step 1: Write history transaction tests**

Cover:

- one command creates one undo entry.
- repeated numeric edits with the same transaction key merge.
- a different field starts a new transaction.
- undo/redo preserves schemaVersion 2.
- new edit clears redo.
- maximum 30 entries.
- Ctrl/Cmd+Z triggers undo, Ctrl/Cmd+Shift+Z triggers redo, and Ctrl/Cmd+S invokes the browser-save callback without submitting a form.

- [ ] **Step 2: Implement useLayoutHistory**

Expose beginTransaction, commitTransaction, undo, redo, canUndo, canRedo, and current layout. Do not clone with JSON.parse(JSON.stringify). Use structuredClone for v2 plain data.

- [ ] **Step 3: Write editor-hook tests**

Verify useLayoutEditor calls core commands and does not commit failed results.

- [ ] **Step 4: Implement useLayoutEditor**

Own layout, selection, command errors, and command dispatch. Keep UI-only tool state outside this hook.

- [ ] **Step 5: Move AI state into useAiDraft**

Both browser direct and server modes return the same typed result. AppShell must not build FormData or read provider configuration directly.

- [ ] **Step 6: Move workspace state into useWorkspaceUi**

Own workspace mode, active analysis, inspector, layers, dock height, and analysis controls.

Install one guarded window keydown handler for Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, and Ctrl/Cmd+S. Ignore shortcuts when the event target is an input, textarea, select, or contenteditable element.

- [ ] **Step 7: Reduce AppShell to composition**

Target: AppShell below 350 lines after Tasks 11 and 12.

- [ ] **Step 8: Run tests and typecheck**

~~~powershell
npm.cmd run test -- apps/web/src/hooks
npm.cmd run typecheck
~~~

Expected: PASS.

- [ ] **Step 9: Commit**

~~~powershell
git add apps/web/src/hooks apps/web/src/components/AppShell.tsx
git commit -m "refactor(web): extract workspace state hooks"
~~~

### Task 12: Split Studio chrome and 3D scene layers

**Files:**

- Create: apps/web/src/components/Studio/StudioTopbar.tsx
- Create: apps/web/src/components/Studio/ToolRail.tsx
- Create: apps/web/src/components/Studio/Inspector.tsx
- Create: apps/web/src/components/Studio/AnalysisDock.tsx
- Create: apps/web/src/components/Scene/layers/StructureLayer.tsx
- Create: apps/web/src/components/Scene/layers/OpeningLayer.tsx
- Create: apps/web/src/components/Scene/layers/DeviceLayer.tsx
- Create: apps/web/src/components/Scene/layers/HeatLayer.tsx
- Create: apps/web/src/components/Scene/layers/AirflowLayer.tsx
- Create: apps/web/src/components/Scene/layers/CompassLayer.tsx
- Create: apps/web/src/components/Scene/layers/BaguaLayer.tsx
- Create: apps/web/src/components/Scene/layers/SceneControls.tsx
- Modify: apps/web/src/components/Scene/ThreeSceneCanvas.tsx
- Delete: apps/web/src/components/EditorWizard/QuickStartWizard.tsx

- [ ] **Step 1: Add a current-render snapshot test**

Render AppShell with a template and assert the three workspace buttons, seven future tool slots, inspector tabs, and analysis dock region exist. This protects composition while files move.

- [ ] **Step 2: Extract Studio components without changing behavior**

Move topbar, rail, inspector, and dock markup first. Keep callbacks typed and explicit.

- [ ] **Step 3: Extract scene layers one at a time**

After each layer extraction run:

~~~powershell
npm.cmd run typecheck
~~~

Expected: PASS.

- [ ] **Step 4: Delete unused legacy overlays**

Remove HeatmapOverlay, AirflowOverlay, makeHeatmapTexture, and helpers referenced only by those overlays. Remove unused heatmap and airflow props from ThreeSceneCanvas and SceneViewport.

- [ ] **Step 5: Add resource disposal tests/helpers**

Every created DataTexture, BufferGeometry, ShaderMaterial, SpriteMaterial, and CanvasTexture must be disposed when replaced or unmounted.

- [ ] **Step 6: Delete QuickStartWizard**

Confirm no import exists, then delete the unused component.

- [ ] **Step 7: Enforce file size guidance**

ThreeSceneCanvas becomes an assembly file below 250 lines. Individual layer files should remain below about 500 lines; split utilities when a layer exceeds that boundary.

- [ ] **Step 8: Run gates**

~~~powershell
npm.cmd run lint
npm.cmd run test
npm.cmd run typecheck
npm.cmd run build
~~~

Expected: PASS.

- [ ] **Step 9: Commit**

~~~powershell
git add apps/web/src/components
git commit -m "refactor(scene): split studio and 3d layers"
~~~

### Task 13: Add camera modes, coordinate mapping, and inference engine

**Files:**

- Create: apps/web/src/editor/tools.ts
- Create: apps/web/src/editor/scene-coordinates.ts
- Create: apps/web/src/editor/scene-coordinates.test.ts
- Create: apps/web/src/editor/inference.ts
- Create: apps/web/src/editor/inference.test.ts
- Create: apps/web/src/editor/tool-reducer.ts
- Create: apps/web/src/components/Scene/interaction/SceneCameraController.tsx
- Create: apps/web/src/components/Scene/interaction/EditorInteractionPlane.tsx
- Modify: apps/web/src/components/Scene/SceneViewport.tsx

- [ ] **Step 1: Define the tool and camera contracts**

~~~typescript
export type EditorTool =
  | "select"
  | "wall"
  | "move"
  | "door"
  | "window"
  | "device"
  | "measure";

export type SceneView = "perspective" | "top" | "front" | "isometric";
export type AxisLock = "free" | "x" | "z";
~~~

World mapping is fixed:

- layout x to world X.
- layout y to world Z.
- world Y is visual height only.
- no editing along world Y.

- [ ] **Step 2: Write coordinate round-trip tests**

layoutToWorld then worldToLayout must return the original x/y within 1e-6 for all template bounds.

- [ ] **Step 3: Implement camera switching**

SceneCameraController owns one perspective and one orthographic camera. Top edit view uses the orthographic camera; perspective/isometric/front use the perspective camera. F frames the selected object bounds.

Configure SketchUp-style navigation explicitly:

- middle-button drag orbits in perspective/isometric/front views.
- Shift + middle-button drag pans.
- wheel zooms toward the current target.
- left button remains reserved for selection/tools.
- top edit view disables orbit but keeps middle-button pan and wheel zoom.

OrbitControls does not natively distinguish Shift + middle-button. Add a small pointer-down adapter that temporarily maps the middle button to PAN when Shift is held and to ROTATE otherwise, then restores the mapping on pointer-up/cancel.

Add component tests with mocked OrbitControls events for middle orbit, Shift-middle pan, wheel zoom, and left-button non-navigation.

- [ ] **Step 4: Write inference tests**

Cover:

- endpoint snap.
- midpoint snap.
- wall-edge projection.
- grid snap.
- parallel inference.
- perpendicular inference.
- X and Z locks.
- Shift retains the current inference.
- equal-distance candidates use deterministic priority: endpoint, midpoint, edge, axis, grid.

- [ ] **Step 5: Implement pure inference**

~~~typescript
export interface InferenceResult {
  point: LayoutPoint;
  kind: "endpoint" | "midpoint" | "edge" | "parallel" | "perpendicular" | "axis-x" | "axis-z" | "grid" | "free";
  sourceId?: string;
}
~~~

The inference module must not import React or Three.js.

- [ ] **Step 6: Replace the DOM percentage drawing overlay**

EditorInteractionPlane receives R3F pointer events, intersects the top work plane, converts to layout coordinates, then applies inference. SceneViewport must delete pointFromPointer.

- [ ] **Step 7: Add key handling**

Desktop:

- Shift locks current inference.
- Left/right locks X.
- Up/down locks Z.
- Esc cancels.
- Enter commits.
- F frames selection.

Ignore shortcuts while typing in input, textarea, or contenteditable elements.

- [ ] **Step 8: Run tests**

~~~powershell
npm.cmd run test -- apps/web/src/editor
npm.cmd run typecheck
~~~

Expected: PASS.

- [ ] **Step 9: Commit**

~~~powershell
git add apps/web/src/editor apps/web/src/components/Scene
git commit -m "feat(editor): add sketch-style camera and inference"
~~~

### Task 14: Implement Select, Wall, and Move tools

**Files:**

- Modify: apps/web/src/editor/tool-reducer.ts
- Create: apps/web/src/editor/tool-reducer.test.ts
- Modify: apps/web/src/components/Scene/interaction/EditorInteractionPlane.tsx
- Modify: apps/web/src/components/Studio/ToolRail.tsx
- Create: apps/web/src/components/Editor/MeasurementBox.tsx
- Create: apps/web/src/components/Editor/ToolStatusBar.tsx

- [ ] **Step 1: Write Select tool tests**

Success:

- click room, wall, opening, device, sensor.
- hover differs from selection.
- F frames selected entity.
- Delete removes an allowed selected room, custom wall, opening, device, or sensor through the corresponding domain command.

Invalid:

- clicking empty space clears selection.
- Delete does not delete a derived room wall.
- a failed cascade/validation result keeps the selection and layout unchanged while showing the issue.

- [ ] **Step 2: Implement Select**

All selectable scene objects expose entity type and ID through userData. Selection state contains both type and ID, not separate room/wall fields.

Route Delete/Backspace by selected entity type to removeRoom, removeWall, removeOpening, removeDevice, or removeSensor. Guard input fields and prevent the browser Back action only when an editor deletion actually runs.

- [ ] **Step 3: Write Wall tool tests**

Success:

- top-view start/end creates a custom wall.
- endpoint and midpoint snaps.
- X/Z axis lock.
- typed length changes endpoint and Enter commits.

Invalid:

- under 0.35 m.
- out of bounds.
- duplicate wall interval.

- [ ] **Step 4: Implement numeric entry**

MeasurementBox appears after the first point. Typing 3.5 then Enter creates a 3.5 m segment along the current inferred direction.

- [ ] **Step 5: Write Move tool tests**

Success:

- room moves by drag and typed delta.
- custom wall moves as one segment.
- device and sensor remain inside bounds.
- custom wall opening retains offset.

Invalid:

- room overlap.
- room out of bounds.
- device outside its room.
- derived wall selected for independent movement.

- [ ] **Step 6: Implement Move via core commands**

Preview state may be local and transient. Only pointer-up or Enter commits a domain command and creates one history transaction. Esc discards preview.

- [ ] **Step 7: Add status feedback**

ToolStatusBar shows tool, inference kind, x/z, distance, keyboard hints, and the latest validation error.

- [ ] **Step 8: Run tests**

~~~powershell
npm.cmd run test -- apps/web/src/editor apps/web/src/components/Editor
npm.cmd run typecheck
~~~

Expected: PASS.

- [ ] **Step 9: Commit**

~~~powershell
git add apps/web/src/editor apps/web/src/components
git commit -m "feat(editor): add select wall and move tools"
~~~

### Task 15: Implement Door, Window, Device, and Measure tools

**Files:**

- Modify: packages/core/src/domain/layout-commands.ts
- Modify: packages/core/test/layout-commands.test.ts
- Modify: apps/web/src/editor/tool-reducer.ts
- Modify: apps/web/src/components/Scene/interaction/EditorInteractionPlane.tsx
- Modify: apps/web/src/components/Studio/ToolRail.tsx
- Modify: apps/web/src/components/Editor/LayoutEditor.tsx

- [ ] **Step 1: Add opening collision validation**

Write tests rejecting two openings whose intervals overlap on the same wall. Touching interval endpoints are allowed with a 0.02 m tolerance.

- [ ] **Step 2: Implement Door tool**

Clicking a wall creates a preview centered on the hit offset. After placement, dragging the door projects the pointer back onto the owning wall and updates offset continuously in preview state. MeasurementBox edits width and offset. Pointer-up or Enter commits one history transaction; Esc restores the original offset.

- [ ] **Step 3: Implement Window tool**

Reuse the opening placement and along-wall offset-dragging state machine, with window defaults and sillHeight. Keep height and sillHeight in the inspector.

- [ ] **Step 4: Add Door/Window tests**

Each tool requires:

- one successful room-wall case.
- one successful custom-wall case.
- no-wall rejection.
- wall-range rejection.
- overlap rejection.
- successful along-wall offset drag.
- drag canceled by Esc restores the original offset.
- undo/redo case.

- [ ] **Step 5: Implement Device tool**

ToolRail provides AC and kitchen-heat subtypes. Clicking inside a room places a default device at the raycast point. Direction and strength remain inspector fields.

- [ ] **Step 6: Add Device tests**

Success inside a room; reject empty space and another room when a target room is locked.

- [ ] **Step 7: Implement transient Measure tool**

First point starts measurement; second point freezes the displayed distance until the next click or Esc. Never write measurement data into HouseLayout.

- [ ] **Step 8: Add Measure tests**

Test endpoint, midpoint, free point, Esc clearing, and absence from exported JSON.

- [ ] **Step 9: Run the seven-tool matrix**

~~~powershell
npm.cmd run test -- apps/web/src/editor packages/core/test/layout-commands.test.ts
npm.cmd run typecheck
~~~

Expected: every tool has at least one successful and one invalid-operation test.

- [ ] **Step 10: Commit**

~~~powershell
git add packages/core apps/web/src/editor apps/web/src/components
git commit -m "feat(editor): complete sketch-style tool set"
~~~

### Task 16: Add mobile controls, split CSS, and enforce performance gates

**Files:**

- Create: apps/web/src/components/Editor/MobileToolControls.tsx
- Create: apps/web/src/styles/tokens.css
- Create: apps/web/src/styles/studio.css
- Create: apps/web/src/styles/editor.css
- Create: apps/web/src/styles/analysis.css
- Create: apps/web/src/styles/responsive.css
- Modify: apps/web/src/app/globals.css
- Modify: apps/web/src/app/layout.tsx
- Modify: apps/web/src/app/page.tsx
- Create: apps/web/src/components/Scene/SceneErrorBoundary.tsx
- Modify: docs/quality/performance-baseline.md

- [ ] **Step 1: Add touch controls**

MobileToolControls provides:

- red X lock.
- green Z lock.
- free movement.
- numeric value input.
- confirm.
- cancel.
- top/isometric view switch.

Blue-axis editing is absent.

Implement the touch gesture contract in the interaction/camera components:

- one active pointer is owned by the selected tool and may select, place, draw, or move.
- when a second pointer appears, cancel any uncommitted one-finger tool preview without history, suspend tool hit handling, and enter navigation mode.
- two-pointer centroid movement pans the camera target.
- two-pointer distance change zooms the active camera.
- lifting back to one pointer ends navigation; it does not automatically resume the canceled tool gesture.
- touch navigation does not rotate the camera in this cycle.

Use pointer capture and a Map keyed by pointerId so mouse and touch share one event path.

- [ ] **Step 2: Add mobile reducer tests**

Verify the on-screen controls dispatch the same reducer actions as desktop keys. Add interaction tests proving one finger reaches tool handlers, two fingers suppress tool commits, centroid delta pans, distance delta zooms, and pointer cancellation clears gesture state.

- [ ] **Step 3: Split CSS by responsibility**

globals.css should contain imports and minimal reset only:

~~~css
@import "../styles/tokens.css";
@import "../styles/studio.css";
@import "../styles/editor.css";
@import "../styles/analysis.css";
@import "../styles/responsive.css";
~~~

Do not rename all classes during the split.

- [ ] **Step 4: Add dynamic scene loading**

Use next/dynamic for the 3D workspace with ssr: false, a stable loading placeholder, and SceneErrorBoundary.

- [ ] **Step 5: Measure production bundle**

Run:

~~~powershell
npm.cmd run build
~~~

Expected: homepage First Load JS at or below 360 kB. If not, inspect heavy imports and lazy-load analysis/report panels before changing the target.

- [ ] **Step 6: Measure simulation and long tasks**

Repeat the P0 measurement method. Set the final main-thread fallback cap and record the before/after median. Any long-task median regression above 20% must be fixed or documented with explicit approval.

- [ ] **Step 7: Run accessibility lint/manual checks**

Verify and test the approved WCAG 2.2 AA subset:

- every tool, view switch, axis lock, confirm, cancel, save, undo, and redo control is reachable by keyboard in a logical order.
- focus remains visibly distinguishable on dark backgrounds.
- buttons and form inputs have accessible names.
- validation, save, simulation, tool, and AI states are exposed as text; asynchronous changes use an appropriate aria-live region without repeated announcements.
- text and interactive-control contrast meets AA.

Add Testing Library tests that tab through the desktop toolbar and assert status text after a successful and failed operation. Add Playwright assertions for visible focus and live status text in the desktop critical flow.

- [ ] **Step 8: Run gates**

~~~powershell
npm.cmd run lint
npm.cmd run test
npm.cmd run typecheck
npm.cmd run build
~~~

Expected: PASS.

- [ ] **Step 9: Commit**

~~~powershell
git add apps/web/src/styles apps/web/src/app apps/web/src/components/Editor apps/web/src/components/Scene docs/quality/performance-baseline.md
git commit -m "feat(web): add responsive sketch-style editing"
~~~

---

# Phase P5: Backend positioning and end-to-end acceptance

### Task 17: Align the experimental backend contract without duplicating simulation

**Files:**

- Modify: backend/models.py
- Modify: backend/main.py
- Modify: backend/cfd/service.py
- Modify: backend/fengshui/service.py
- Modify: backend/ai/service.py
- Modify: backend/tests/test_services.py
- Create: backend/tests/fixtures/layout-v2.json
- Modify: README.md

- [ ] **Step 1: Add the shared v2 fixture**

Copy the canonical v2 compact layout fixture into backend/tests/fixtures/layout-v2.json.

- [ ] **Step 2: Update Pydantic models**

Add schemaVersion and ClimateDevice. Configure aliases so Python fields may remain snake_case internally while accepting and returning TypeScript camelCase.

- [ ] **Step 3: Write compatibility tests**

Verify:

- v2 fixture accepted.
- devices retained.
- unknown future schema rejected.
- invalid dimensions rejected.
- extra uncontrolled fields rejected.

- [ ] **Step 4: Remove parity claims**

The backend must not claim its 6×6 heatmap or simple airflow equals browser physics-lite. Preferred implementation: remove /analyze/complete, /analyze/heatmap, and /analyze/airflow until a real backend consumer exists. Keep /health and explicitly experimental AI/report extension endpoints only.

- [ ] **Step 5: Update README**

State:

- browser simulation is authoritative for the current product.
- backend is optional and experimental.
- no engineering CFD claim.
- server AI is disabled by default.
- browser AI CORS tradeoff.
- supported schema version.

- [ ] **Step 6: Run backend tests**

~~~powershell
python -m pytest backend/tests -q
~~~

Expected: PASS with more than the original two tests.

- [ ] **Step 7: Commit**

~~~powershell
git add backend README.md
git commit -m "refactor(backend): align the experimental v2 contract"
~~~

### Task 18: Add Playwright desktop/mobile acceptance and final documentation

**Files:**

- Create: playwright.config.ts
- Create: apps/web/e2e/modeling-desktop.spec.ts
- Create: apps/web/e2e/modeling-mobile.spec.ts
- Create: apps/web/e2e/persistence.spec.ts
- Create: apps/web/e2e/analysis.spec.ts
- Create: apps/web/e2e/ai-fallback.spec.ts
- Create: apps/web/e2e/helpers/editor.ts
- Modify: .github/workflows/ci.yml
- Modify: README.md
- Modify: plan.md
- Modify: docs/superpowers/specs/2026-07-10-stabilization-and-productization-design.md

- [ ] **Step 1: Configure Playwright**

Use Chromium projects:

~~~typescript
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "apps/web/e2e",
  webServer: {
    command: "npm.cmd run dev --workspace web -- --hostname 127.0.0.1 --port 3000",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI
  },
  projects: [
    {
      name: "desktop",
      testMatch: [
        "**/modeling-desktop.spec.ts",
        "**/persistence.spec.ts",
        "**/analysis.spec.ts",
        "**/ai-fallback.spec.ts"
      ],
      use: { viewport: { width: 1440, height: 900 } }
    },
    {
      name: "mobile",
      testMatch: ["**/modeling-mobile.spec.ts"],
      use: {
        ...devices["Pixel 7"],
        viewport: { width: 390, height: 844 },
        hasTouch: true
      }
    }
  ]
});
~~~

- [ ] **Step 2: Add stable editor test hooks and helpers**

Add data-testid values for the viewport, active tool, active view, selected entity, measurement input, status message, mobile axis buttons, simulation status, and save status. Do not locate WebGL entities by rendered pixels alone.

Create apps/web/e2e/helpers/editor.ts with deterministic helpers for loading the compact fixture, switching to top view, converting known layout coordinates to viewport coordinates, selecting tools, and waiting for simulation ready. Document the fixed viewport coordinates used by pointer tests.

- [ ] **Step 3: Write desktop seven-tool tests**

Cover Select, Wall, Move, Door, Window, Device, and Measure success paths. Add invalid wall length, room overlap, opening overlap, and invalid device placement.

- [ ] **Step 4: Write SketchUp-style desktop interaction tests**

Cover:

- top/isometric/front/perspective switches.
- F focus.
- endpoint, midpoint, wall-edge, grid, parallel, perpendicular inference.
- Shift inference lock.
- arrow axis lock.
- direct numeric length.
- Esc cancel.
- undo/redo.
- middle-button orbit.
- Shift + middle-button pan.
- wheel zoom.
- Ctrl/Cmd+S save.
- Select-tool deletion for every allowed entity type.
- door and window offset dragging, including Esc cancellation.

- [ ] **Step 5: Write touch-enabled mobile tests**

Cover:

- select.
- top-view wall drawing.
- on-screen X/Z/free lock.
- on-screen numeric input.
- confirm/cancel.
- invalid-operation feedback.

Use a Chromium CDP touch session for a pinch/pan smoke check. Keep it a smoke assertion, not pixel-perfect gesture physics.

- [ ] **Step 6: Write persistence and import tests**

Cover save, reload, restore, v1 migration, future version rejection, malformed geometry rejection, and absence of transient measurements from export.

- [ ] **Step 7: Write analysis and AI tests**

Cover three analysis modes, simulation ready state, worker failure message, browser AI local fallback, server AI disabled response, wrong password, and rate limit response.

Keep E2E deterministic with Playwright routing:

- intercept the browser Provider URL and return a fixed compatible draft or a fixed network failure.
- intercept /api/ai/server-config-status and /api/ai/layout-from-text with separate 503 AI_DISABLED, 401 AUTH_FAILED, 429 RATE_LIMITED, and successful fixture responses.
- never call a real Provider or depend on repository secrets in E2E.

Task 7 unit/integration tests remain responsible for executing the real limiter, password comparison, enabled/disabled environment logic, and bounded body readers. E2E verifies that the UI handles each stable HTTP contract.

- [ ] **Step 8: Run E2E**

~~~powershell
npx.cmd playwright install chromium
npm.cmd run e2e
~~~

Expected: all desktop and mobile tests pass with no unhandled console errors.

- [ ] **Step 9: Add E2E to CI**

Append to the Windows CI job after build:

~~~yaml
      - run: npx.cmd playwright install chromium
      - run: npm.cmd run e2e
~~~

Upload playwright-report and test-results on failure with actions/upload-artifact@v4.

- [ ] **Step 10: Run the complete release gate**

~~~powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
python -m pytest backend/tests
npm.cmd run e2e
git diff --check
~~~

Expected: every command exits 0.

- [ ] **Step 11: Reconcile documentation**

Update README, the design spec status, and this plan:

- mark completed checkboxes only after evidence.
- record final bundle and simulation values.
- record browser/mobile versions used.
- keep physics-lite and no-Push/Pull limitations visible.

- [ ] **Step 12: Commit the acceptance suite**

~~~powershell
git add playwright.config.ts apps/web/e2e .github/workflows/ci.yml README.md docs/superpowers/specs plan.md
git commit -m "test: add productization acceptance suite"
~~~

---

# Phase exit checklist

## P0 exit

- [ ] lint is non-interactive and passing.
- [ ] test command exists.
- [ ] CI runs all non-E2E gates.
- [ ] generated artifacts are untracked.
- [ ] baseline performance is recorded.

## P1 exit

- [ ] all layouts are schemaVersion 2 in memory.
- [ ] unversioned/v1 migration is covered.
- [ ] unknown future versions reject.
- [ ] IDs, geometry, limits, and references are validated.
- [ ] every mutation uses a domain command.

## P2 exit

- [ ] browser Key never enters the application server.
- [ ] server AI is disabled by default.
- [ ] server provider URL cannot be user-controlled.
- [ ] upload, prompt, concurrency, proxy, and rate-limit tests pass.
- [ ] error responses expose no secrets or provider internals.

## P3 exit

- [ ] partial shared walls are correctly internal.
- [ ] internal doors never become exterior inlets.
- [ ] heat/airflow fixture thresholds pass.
- [ ] deterministic result tests pass.
- [ ] Worker transfer lists are complete and unique.
- [ ] fallback cell cap is measured and recorded.

## P4 exit

- [ ] AppShell is below 350 lines.
- [ ] ThreeSceneCanvas is below 250 lines.
- [ ] old overlays and unused wizard are removed.
- [ ] seven tools have success and invalid-operation tests.
- [ ] world/layout coordinate mapping is explicit.
- [ ] desktop and touch axis/numeric controls share reducer actions.
- [ ] homepage First Load JS is at or below 360 kB.

## P5 exit

- [ ] backend v2 fixture compatibility passes.
- [ ] backend duplicate simulation endpoints are removed or explicitly deprecated.
- [ ] desktop and mobile E2E pass.
- [ ] key accessibility checks meet WCAG 2.2 AA scope.
- [ ] README, spec, and plan match implemented behavior.
- [ ] full release gate exits 0.

# Execution notes

- Implement in phase order. Do not begin P4 before P1–P3 gates pass.
- Use TDD for schema, domain commands, topology, simulation, rate limiting, inference, tool reducers, and persistence.
- Keep commits scoped to one task or coherent subtask.
- Do not change visual styling during the scene extraction step; style work belongs in Task 16.
- Do not add Push/Pull or editable world-Y movement without a new approved schema/design cycle.
- If a fixture exposes a current simulation result outside the target tolerance, first save the characterization result, then make the smallest topology/solver change needed to meet the approved criterion.
