# 05_polish-demo - Production Hardening, Voice Briefings & Demo Runbook

One job: Final polish, audio incident summary briefings, post-mortem export validation, and end-to-end 30s MTTR demo runbook.

## Inputs
- Working: `client/src/components/TelemetryPane.tsx`
- Working: `client/src/components/IncidentBanner.tsx`
- Working: `server/src/routes/incidents.ts`
- Reference: `../../_shared/card-schemas.md`
- Reference: `../../_shared/nexconn-contract.md`

## Process
1. Validate post-mortem markdown download formatting and telemetry KPIs across all 3 chaos scenarios.
2. Integrate synthesized audio briefing / voice announcement upon incident resolution.
3. Verify edge-case fallbacks when LLM rate limits occur.
4. Prepare end-to-end demo walkthrough script and verification.

## Outputs
- `client/src/components/TelemetryPane.tsx`
- `client/src/components/IncidentBanner.tsx`
- `server/src/routes/incidents.ts`

## Check
Run end-to-end demo flow. Confirm 1-click chaos trigger, automated multi-agent diagnosis, responder page, approve & execute, audio summary/briefing, and post-mortem report download. Write verdict to `check.md`.

