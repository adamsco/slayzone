# SlayZone Distribution Rollout — Status and Plan (2026-03-05)

## Context

Parent task: `942382b3-0c14-4818-b49c-ad4ef4a2dd4f`  
Goal: make SlayZone installable via Homebrew Cask, WinGet, Nix flake, and Flathub using a shared release foundation.

## Current Status

All rollout subtasks are created, documented, and currently in `inbox` with priority `3`.

- `c229dea3-1b72-43b8-b7d5-3641717b3850` — Infrastructure foundation
- `f9a73993-3078-4e1d-9ff1-54624fced49b` — Homebrew Cask rollout
- `cde24a3f-e55e-4e02-8f98-f5f9e4a6047f` — WinGet rollout
- `a2dd296d-5e9a-4cde-9eb0-bd990e5220e5` — Nix flake rollout
- `c0dddb93-5c31-4ac2-9b12-931e9241f994` — Flathub rollout

Each subtask now has full description text:
- Background
- Why this matters
- Scope
- Out of scope
- Definition of done

## What Is Already Done

- Subtasks created under the parent task.
- Full descriptions added to all five subtasks.
- Rollout sequencing agreed.
1. Infrastructure foundation first.
2. Homebrew + WinGet + Nix flake next.
3. Flathub after foundation channels are stable.

## Execution Plan

### Phase 1: Foundation

Owner task: `c229dea3-1b72-43b8-b7d5-3641717b3850`

- Implement tag-triggered release workflow (`vX.Y.Z`).
- Standardize artifact naming and output paths.
- Generate release checksums and canonical release manifest.
- Add dry-run vs publish controls.
- Ensure channel jobs are rerunnable independently.
- Document release, rollback, and failure recovery.

### Phase 2: Core Channels

Owner tasks:
- `f9a73993-3078-4e1d-9ff1-54624fced49b` (Homebrew)
- `cde24a3f-e55e-4e02-8f98-f5f9e4a6047f` (WinGet)
- `a2dd296d-5e9a-4cde-9eb0-bd990e5220e5` (Nix flake)

Plan:
- Implement Homebrew cask automation from release manifest.
- Implement WinGet manifest generation + PR submission flow.
- Add first-party flake outputs and CI flake checks.
- Run smoke installs for each channel using the same release artifacts.

### Phase 3: Linux Desktop Reach

Owner task: `c0dddb93-5c31-4ac2-9b12-931e9241f994`

- Create Flatpak manifest and metadata.
- Validate permissions and portal usage.
- Add CI Flatpak build validation.
- Submit to Flathub and iterate on review feedback.

## Immediate Next Actions

1. Move infrastructure subtask to `in_progress`.
2. Create release artifact/manifest schema contract.
3. Define CI job matrix and per-channel handoff interface.
4. Keep the other channel tasks in `inbox` until foundation is green.
