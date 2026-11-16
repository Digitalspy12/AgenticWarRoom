# Agentic WarRoom

Autonomous Multi-Agent Production Incident Triage Cockpit on Nexconn Chat SDK.

## Where things live

| Path | Purpose |
|---|---|
| `stages/` | Active development tasks & contracts (numbered) |
| `_shared/` | Factory: stable schemas, API contracts, and state machines |
| `client/` | React 19 + TypeScript + Vite + Tailwind CSS v4 cockpit frontend |
| `server/` | Node.js + Express + TypeScript agent triage pipeline & Nexconn Platform client |
| `DOcs/` | Architecture specs & sprint timeline documentation |

## Route by what you are doing

| If you are... | Go to | Then check |
|---|---|---|
| Reviewing Phase 4 (Multiplayer War Room & Cross-Tab Sync) | [`stages/04_channel-metadata/CONTEXT.md`](stages/04_channel-metadata/CONTEXT.md) | `stages/04_channel-metadata/check.md` (PASSED) |
| Reviewing Phase 5 (Production Polish & Voice Debriefs) | [`stages/05_polish-demo/CONTEXT.md`](stages/05_polish-demo/CONTEXT.md) | `stages/05_polish-demo/check.md` (PASSED) |
| Verifying or adding custom card payloads | [`_shared/card-schemas.md`](_shared/card-schemas.md) | `client/src/lib/types.ts` parity |
| Checking Nexconn SDK / Platform API rules | [`_shared/nexconn-contract.md`](_shared/nexconn-contract.md) | `server/src/services/nexconnService.ts` |
| Updating incident state machine | [`_shared/incident-states.md`](_shared/incident-states.md) | State transitions in client/server |
| Checking overall sprint roadmap | [`CONTEXT.md`](CONTEXT.md) | Completed vs upcoming stages |

## The one rule

Nothing moves to the next stage until the current stage's check passes.
Follow rules in [`.agents/rules/icm.md`](.agents/rules/icm.md).

