# Agentic WarRoom - Development Pipeline

The flow: Ingest chaos outage → Chain autonomous agents (@LogBot → @DBAgent → @DeployBot) → Deliver interactive cards into Nexconn Group Channel → Human SRE approves remediation.

## Sprint Stages

| Stage | Job | Status |
|---|---|---|
| `01_foundation` | Chaos Engine, LLM Router, 3-Agent Sequential Pipeline | **Done** |
| `02_chat-sdk-sync` | Nexconn Chat SDK Web integration, Group Channel, Token Auth | **Done** |
| `03_interactivity` | Typing indicators, In-channel mention chips, Threaded drawer | **Done** |
| `04_channel-metadata` | Nexconn channel metadata, cross-tab sync, pinned cards | **Done** |
| `05_polish-demo` | Production hardening, voice briefings, demo runbook | **Active** |

Factory (stable across runs): `_shared/{card-schemas.md, nexconn-contract.md, incident-states.md}`  
Active Contract: [`stages/04_channel-metadata/CONTEXT.md`](stages/04_channel-metadata/CONTEXT.md) (Check passed: [`stages/04_channel-metadata/check.md`](stages/04_channel-metadata/check.md))

