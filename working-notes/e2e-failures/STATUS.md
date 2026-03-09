# E2E Failure Status (2026-03-09)

379 passed, 36 failed, 40 skipped (38.9m)

## 5 distinct failures, 1 cascade

| # | Test | Error | Root Cause |
|---|------|-------|------------|
| 1 | 14: imports GitHub repo issues | `no such table: integration_project_connections` | Missing migration — DB schema out of sync |
| 2 | 43: MCP server initialize handshake | `ECONNREFUSED 127.0.0.1:65503` | MCP server not ready/port mismatch |
| 3 | 46: panels tab shows native+external | `Diff` card not found | UI missing "Diff" panel card |
| 4 | 46: disabling Editor panel | strict mode: 2 switches on `Editor` card | Card selector matches 2 switch elements |
| 5 | 60: CLI tasks create | `CLI created …` not visible | REST notify didn't trigger UI refresh |
| 6-36 | 62/63/64: context-manager + execution-context (×31) | `Target page closed` | **App crashed** in test 62 — all cascade |

## Priority

1. **Test 62 crash** — 1 fix eliminates 31 failures. App crashes during `openProjectContextManager`. Investigate what kills the Electron process.
2. **Test 1 (missing table)** — `integration_project_connections` table missing. Migration not applied or renamed.
3. **Tests 3-4 (web panels)** — "Diff" card missing from settings UI; `Editor` card has 2 switches (selector ambiguity).
4. **Tests 2, 5 (timing)** — MCP server not bound in time; REST notify race condition. Likely need longer waits or retry.
