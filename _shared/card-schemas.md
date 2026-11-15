# Custom Card Schemas (The Factory)

Single source of truth for Nexconn customType payloads and card contracts.

## 1. DIAGNOSTIC_LOG (@LogBot)
- **`customType`**: `DIAGNOSTIC_LOG`
- **Agent**: `@LogBot`
- **`customData` Schema**:
```json
{
  "culpritLine": "apps/order-service/src/db/pool.ts:88",
  "errorSignature": "FATAL: remaining connection slots are reserved for non-replication superuser connections",
  "logSnippet": "PostgreSQL connection pool exhausted. Active: 100/100...",
  "suggestedInvestigate": ["DB connection pooling", "Leaked client instances"],
  "cardId": "diag-log-<timestamp>"
}
```

## 2. ROOT_CAUSE_ANALYSIS (@DBAgent)
- **`customType`**: `ROOT_CAUSE_ANALYSIS`
- **Agent**: `@DBAgent`
- **`customData` Schema**:
```json
{
  "rootCause": "PostgreSQL connection pool leak caused by unclosed transactions in payment webhooks",
  "severity": "CRITICAL",
  "affectedServices": ["order-service", "payment-service"],
  "propagationPath": ["Webhook burst", "Unclosed client sessions", "DB max_connections hit", "502 Gateway Errors"],
  "telemetryMetrics": {
    "cpuPercent": 94,
    "activeConnections": 100,
    "latencyMs": 3200
  },
  "cardId": "rca-<timestamp>"
}
```

## 3. ACTION_CARD (@DeployBot)
- **`customType`**: `ACTION_CARD`
- **Agent**: `@DeployBot`
- **`customData` Schema**:
```json
{
  "cardId": "act-<timestamp>",
  "actionTitle": "Expand Connection Pool & Recycle Stale DB Backends",
  "risk": "MEDIUM",
  "command": "kubectl patch configmap pg-config --patch '{\"data\":{\"max_connections\":\"250\"}}' && kubectl rollout restart deploy/order-service",
  "rollbackCommand": "kubectl rollout undo deploy/order-service",
  "status": "AWAITING_APPROVAL",
  "executedBy": null,
  "executedAt": null
}
```

## 4. TYPING_INDICATOR
- **`customType`**: `TYPING_INDICATOR`
- **`customData` Schema**:
```json
{
  "agentName": "@LogBot",
  "status": "typing",
  "statusText": "🤖 @LogBot is analyzing stack traces...",
  "timestamp": 1731500000000,
  "threadId": "card-id-optional"
}
```

## 5. CARD_ANNOTATION & THREAD_REPLY
- **`customType`**: `CARD_ANNOTATION` / `THREAD_REPLY`
- **`customData` Schema**:
```json
{
  "cardId": "card-id",
  "note": "SRE annotation text",
  "author": "lead_dev",
  "timestamp": 1731500000000
}
```

## 6. INCIDENT_SYNC
- **`customType`**: `INCIDENT_SYNC`
- **`customData` Schema**:
```json
{
  "incidentId": "inc-1731500000000-xxxx",
  "status": "CRITICAL | DIAGNOSING | AWAITING_APPROVAL | MITIGATING | RESOLVED",
  "startedAt": 1731500000000,
  "resolvedAt": 1731500025000,
  "mttrSeconds": 25,
  "approvedBy": "sre_oncall",
  "actionCardStatus": "EXECUTING | EXECUTED_BY_HUMAN"
}
```


