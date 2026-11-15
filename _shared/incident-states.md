# Incident Lifecycle & State Machine (The Factory)

Stable state transitions and telemetry rules for incident triage.

## 1. Lifecycle States

```
[CRITICAL] ──(Chaos injected)──> [DIAGNOSING]
                                      │
                                      ▼ (@DeployBot emits ACTION_CARD)
                             [AWAITING_APPROVAL]
                                 │         │
                 (Approve Action)│         │(Reject / Request revision)
                                 ▼         ▼
                            [MITIGATING] [DIAGNOSING]
                                 │
                 (Chaos resolved)│
                                 ▼
                             [RESOLVED]
```

## 2. State Invariants

| State | Who Acts | Channel Indicator | UI State |
|---|---|---|---|
| `CRITICAL` | System / Chaos Engine | Red Banner, Pulsing Siren | MTTR stopwatch starts |
| `DIAGNOSING` | `@LogBot` → `@DBAgent` → `@DeployBot` | Typing waves, Diagnostic cards streamed | Cards populate center pane |
| `AWAITING_APPROVAL` | Human SRE (HITL) | Amber Banner, Action Card active | "Approve & Execute" CTA enabled |
| `MITIGATING` | Backend Runner | Blue Banner, Executing command | Command spinner active |
| `RESOLVED` | Cockpit / Post-Mortem | Green Banner, MTTR stopped | Post-Mortem download CTA visible |

## 3. Metrics Invariants
- `cpuPercent`: Spike during outage (85-98%), drops post-mitigation (<40%).
- `errorRatePercent`: 15-45% during outage, drops to 0% when resolved.
- `healthyPods`: e.g., "1/5" or "0/3" during outage, recovers to "5/5" on resolved.
- `requestLatencyMs`: >2000ms degraded, <120ms normal.

