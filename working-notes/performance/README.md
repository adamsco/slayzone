# Performance Optimization

## Current State (2026-03-14)

### Already Done
- React Compiler (auto-memoization)
- IPC batching (5→1 loadBoardData)
- SQLite WAL mode
- Selective React.memo (DiffView, TaskDetailPage)
- In-flight guard on data refreshes

---

## Live App Profiling (2026-03-14)

Profiled against real workspace: 4 task tabs open, 4 terminal sessions, ~510 git commits.

### Memory
- **154MB** JS heap used / **240MB** allocated / **4096MB** limit
- Renderer process: **2.9%** system memory, **27.7%** CPU (idle with Claude Code terminal)
- Main process: **0.4%** memory, **0.7%** CPU
- GPU process: **0.2%** memory, **11.5%** CPU
- Heap snapshots: `heap-live-1.heapsnapshot`

### DOM — 16,892 nodes total

#### Tag breakdown
| Tag | Count | Notes |
|-----|-------|-------|
| DIV | 7,821 | |
| SPAN | 2,092 | |
| path | 1,369 | SVG internals |
| svg | 1,135 | Mostly Lucide icons + 2 commit graphs |
| circle | 1,076 | Commit graph dots |
| rect | 1,033 | Commit graph elements |
| g | 1,014 | SVG groups |
| line | 997 | Commit graph lines |
| BUTTON | 147 | |
| P | 122 | |
| STYLE | 19 | xterm overrides + theme |
| TEXTAREA | 6 | xterm inputs |

#### Panel breakdown (absolute inset-0 containers)
| Panel | Nodes | Visible | SVGs | SVG children | Content |
|-------|-------|---------|------|-------------|---------|
| Task tab A (git panel) | 8,443 | invisible | 527 | 2,613 | Commit graph + rows |
| Task tab B (active) | 6,651 | **visible** | 510 | 2,551 | Commit graph + rows |
| Task tab C | 310 | invisible | 21 | 69 | No git panel open |
| Task tab D (git panel) | 6,917 | invisible | 528 | 2,608 | Commit graph + rows |
| Task tab E (active) | 6,671 | **visible** | 514 | 2,560 | Commit graph + rows |
| Settings panel | 619-654 | visible | 21 | 69 | |
| Other | 219 x2 | invisible | 11 | 43 | |

**Hidden panels = 54% of total DOM (16,108 of 30,049 panel nodes)**

#### Commit Graph deep dive
Each git panel instance contains:
- 1 SVG: **1,521 children** (84px × 22,000px tall) — lines, circles, rects, paths
- ~500 tooltip overlay DIVs (0 children each, `absolute transition-shadow`)
- ~510 commit row DIVs (`flex items-center cursor-pointer`, 8 children each)
- **Total per instance: ~6,500 DOM nodes**
- **2 visible + 2 invisible = ~26,000 nodes from commit graphs alone = 77% of DOM**

### Paint Timing
- First Paint: **728ms**
- First Contentful Paint: **7,676ms** (very slow)

### Resources
- **250** resources loaded
- Slowest (all ~3.7s, 300 bytes each — Vite HMR modules):
  - useTabStore.ts, AppearanceContext.tsx, apply-theme.ts, ThemeContext.tsx
  - UpdateToast.tsx, UserSettingsDialog.tsx, DevServerToast.tsx, SuccessToast.tsx
  - AnimatedPage.tsx, textarea.tsx

### Terminals
- **4 sessions** mounted (4 xterm textareas)
- Timer ID at ~9,281 (indicates significant interval/timeout churn)

### E2E Baseline (clean state, scaled to 100 tasks)
| Metric | Clean | Live | Factor |
|--------|-------|------|--------|
| Heap | 54MB | 154MB | 2.9x |
| DOM nodes | 2,138 | 16,892 | 7.9x |
| FCP | 1,048ms | 7,676ms | 7.3x |
| IPC loadBoardData | 5ms | — | — |
| refreshData | <1ms | — | — |

---

## Key Findings (prioritized)

### 1. CRITICAL: Commit Graph = 77% of DOM
4 commit graph instances (2 visible, 2 invisible on hidden tabs) produce ~26,000 of 16,892 visible + hidden DOM nodes. Each renders ALL ~510 commits as individual SVG elements + row DIVs + tooltip overlays in a 22,000px tall non-virtualized container.

**Fix:** Virtualize commit graph — only render rows in viewport. Expected reduction: ~24,000 nodes → ~500 (visible rows only).

### 2. HIGH: Hidden tabs keep full DOM mounted (54% waste)
Inactive tabs use `invisible` class but remain fully mounted. 3 hidden task panels contain 15,670 nodes doing nothing. Combined with #1, hidden commit graphs are the biggest offender.

**Fix:** Unmount heavy sub-panels (git, editor, browser) when tab is inactive. Keep terminal mounted for session persistence, but unmount git panel SVGs.

### 3. HIGH: FCP at 7.7s
All slowest resources are ~3.7s Vite HMR modules in the critical path. No code splitting means everything loads before first paint completes.

**Fix:** React.lazy() for non-critical paths: toasts, settings dialog, onboarding, git diff panel. Move heavy panels out of initial bundle.

### 4. MEDIUM: Renderer CPU at 27.7% idle
With Claude Code terminal running, renderer burns 28% CPU at idle. Likely terminal polling, git status polling, or animation frames from mounted-but-invisible components.

**Investigate:** Which intervals/observers are running. Profile with CDP to find idle CPU sources.

### 5. LOW: 19 inline style elements
One per xterm override. Consolidatable but not a perf concern.

---

## Optimization Opportunities

### Commit Graph Virtualization
Render only visible rows. Current: 22,000px SVG + 510 row DIVs + 510 tooltip DIVs per instance. Use IntersectionObserver or virtual scroll. Target: only ~20-30 visible rows rendered at a time.

### Tab Panel Unmounting
Unmount git panel, editor, browser panel when tab is hidden. Keep xterm mounted. Could save 15,000+ nodes.

### Code Splitting
React.lazy() for: UserSettingsDialog, OnboardingDialog, DevServerToast, UpdateToast, SuccessToast, AnimatedPage, GitDiffPanel, AI config panels.

### Virtual Scrolling (Kanban)
Kanban columns have 7-730 nodes currently (light). Not critical yet but will scale with tasks.

### Terminal Write Throttling
No throttling on PTY→xterm write(). Batch with rAF for fast output.

### WebGL Renderer for xterm
Disabled for CSS underline workaround. 5-10x rendering perf if re-enabled.

### SQLite Pragma Tuning
Missing: cache_size, mmap_size, busy_timeout, synchronous=NORMAL.

### Bundle Analysis
Add rollup-plugin-visualizer. Main bundle is 8.5MB (index-BZWBC6v2.js).

---

## Revised Priority

| # | Action | Impact | Effort |
|---|--------|--------|--------|
| 1 | Virtualize commit graph | Critical — 77% DOM reduction | 2-3hr |
| 2 | Unmount hidden tab sub-panels | High — 54% DOM reduction | 1-2hr |
| 3 | Code splitting | High — FCP from 7.7s → <2s | 1-2hr |
| 4 | Investigate idle CPU (28%) | Medium — battery/thermal | 1hr |
| 5 | Bundle analysis | Medium — informs #3 | 10min |
| 6 | SQLite pragma tuning | Medium | 5min |
| 7 | Terminal write throttling | Medium | 30min |
| 8 | WebGL xterm renderer | Medium | 1hr |
| 9 | Kanban virtual scrolling | Low (for now) | 1-2hr |
| 10 | Automated perf regression tests | Low (prevents regressions) | Done (e2e/68) |

## Artifacts
- `heap-live-1.heapsnapshot` — live app heap snapshot
- `heap-snapshot-1.heapsnapshot` — earlier snapshot
- `profiling-results.json` — E2E baseline metrics
- `cdp-metrics.json` — CDP performance counters
- `e2e/68-performance-profiling.spec.ts` — automated perf test suite (11 tests, all passing)
