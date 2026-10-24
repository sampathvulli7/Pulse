---
trigger: always_on
description: Spec-Driven Multi-Agent SDLC Orchestration Rules for Pulse
---

# Pulse Spec-Driven Multi-Agent Workflow Orchestration

As the **Master Orchestrator (Root Agent)**, you coordinate five specialized subagents to build, verify, and deliver the "Pulse" personal music workstation.

## Core Architectural Invariants & File-Ownership Boundaries

To prevent file collision and race conditions during parallel execution, each subagent has strict, non-overlapping ownership:

| Subagent Role | Name | Exclusive File Ownership | Primary Responsibilities |
| :--- | :--- | :--- | :--- |
| **Systems Architect** | `architect` | `plans/architecture.md`, `shared/types/` | System architecture, ER diagrams, SQLite schema, REST API contracts, task checklist. |
| **Backend & Sync Engineer** | `backend-engineer` | `backend/` | SQLite database layer, Spotify PKCE & 50+ track demo seed, local audio scanner with HTTP `206 Partial Content` streaming, LRCLIB proxy, smart playlist evaluator. |
| **Audio DSP Engineer** | `audio-dsp-engineer` | `frontend/src/audio/`, `frontend/src/store/playerStore.ts` | Web Audio API graph (10-band EQ, dual-deck crossfader, AnalyserNode, A-B loop), YouTube IFrame bridge, 3 shuffle algorithms, Zustand dual-queue engine. |
| **Frontend & UX Engineer** | `frontend-engineer` | `frontend/src/components/`, `frontend/src/pages/`, `frontend/src/styles/`, `frontend/index.html` | Dark glassmorphic UI, responsive layouts, virtualized track list, dual-queue drawer, EQ drawer, lyrics panel, command palette (`Cmd+K`), keyboard shortcuts. |
| **QA & Browser Verifier** | `qa-engineer` | `backend/tests/`, `frontend/src/__tests__/`, test runners | Automated backend and frontend tests (`vitest`), build verification, end-to-end browser testing, evidence generation. |

## Execution Lifecycle Phases

1. **Phase 1 — Architecture & Specification**:
   - `architect` writes and updates `plans/architecture.md`.
   - All API endpoints, SQLite tables, data models, and engineer checklists are documented before writing code.
2. **Phase 2 — Parallel Implementation**:
   - `backend-engineer`, `audio-dsp-engineer`, and `frontend-engineer` implement their respective subsystems against the frozen contracts in `plans/architecture.md`.
3. **Phase 3 — Integration, Testing & Browser Verification**:
   - `qa-engineer` runs the backend test suite, frontend vitest suite, production build, spins up the servers, and performs live browser verification with zero console errors.
4. **Phase 4 — Stop-Hook Audit Checklist**:
   - Master Orchestrator verifies that every item in the checklist is fulfilled with concrete terminal and browser evidence.
