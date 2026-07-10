# Performance baseline

Status: **pending final unified verification collection**.

The repository now contains deterministic synchronous and browser baseline harnesses. The browser run, Chromium version, CPU identification, worker-ready medians, and long-task totals must be collected during the final unified verification pass. No browser values are estimated or copied from development-mode runs.

## Measurement method

- Synchronous solver: `npx.cmd tsx --tsconfig tsconfig.json scripts/measure-simulation.ts`
- Browser baseline: `npx.cmd playwright test --config playwright.baseline.config.ts`
- Templates: `blank`, `compact-two-room`, and `family-three-room`
- Sampling: one warm-up followed by five recorded runs per template
- Browser projects: desktop 1440x900 and mobile 390x844
- Browser output: `test-results/performance-baseline.json`

## Environment

| Item | Value |
| --- | --- |
| Date | 2026-07-10 (Asia/Shanghai) |
| Node.js | v24.14.0 (preliminary local run; CI targets Node.js 22) |
| CPU | Pending final collection; local WMI query was denied |
| Chromium | Pending final collection; installation/run was stopped when verification was deferred |

## Preliminary synchronous solver results

These values came from the required synchronous command before verification was deferred. They should be refreshed in the final unified pass.

| Template | Median | Sorted samples (ms) |
| --- | ---: | --- |
| `blank` | 1254.042 ms | 1166.239, 1240.206, 1254.042, 1288.897, 1440.176 |
| `compact-two-room` | 1755.702 ms | 1680.237, 1696.327, 1755.702, 2196.747, 2299.934 |
| `family-three-room` | 1963.336 ms | 1947.738, 1951.531, 1963.336, 2043.065, 2051.116 |

## Production build and browser baseline

| Metric | Desktop | Mobile |
| --- | ---: | ---: |
| Worker request start-to-ready median | Pending | Pending |
| Long-task total median | Pending | Pending |
| Maximum long task median | Pending | Pending |

The preliminary production build reported **378 kB** First Load JS for `/` (275 kB route code plus 103 kB shared). Refresh this value alongside the final browser run so the recorded baseline comes from the same verification pass.
