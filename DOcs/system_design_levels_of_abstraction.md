# System Design: Levels of Abstraction, UI Wireframes & Data Schemas

## 1. Levels of Abstraction (L0 $\rightarrow$ L3)

To keep the codebase modular and easy for hackathon judges to evaluate, **Agentic WarRoom** is designed across four explicit levels of abstraction:

```
+-----------------------------------------------------------------------------------+
| LEVEL 0 (L0): CONCEPTUAL MODEL (The "Zero-Toggle" Digital War Room)               |
| Humans and AI Agents share one real-time room where chat IS the control plane.    |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| LEVEL 1 (L1): SYSTEM CONTAINERS                                                   |
| [War Room Web Client] <==> [Nexconn SD-CAN Cloud] <==> [Agent Orchestrator API]   |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| LEVEL 2 (L2): FUNCTIONAL COMPONENTS                                               |
| • Chaos Simulator Drawer       • Multi-Agent Router (@LogBot, @DBAgent, @Deploy)  |
| • Pinned Room KV Status Bar    • HITL Custom Card Renderer & Voice Bridge         |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| LEVEL 3 (L3): DATA & PAYLOAD PRIMITIVES                                           |
| • JSON Message Schemas (ACTION_CARD, DIAGNOSTIC_LOG, RCA_SUMMARY)                 |
| • Room KV State Attributes & In-Channel Directed RBAC Payloads                    |
+-----------------------------------------------------------------------------------+
```

---

### Level 0 (L0): The Conceptual Abstraction
* **Plain English:** Instead of a human reading a server alert, opening another app to read logs, asking ChatGPT for help in a third tab, and running a script in a terminal, **the chat room itself is the terminal and dashboard**. AI agents act like junior site-reliability engineers who fetch the data and prepare the button; the human acts as the commander who reviews and clicks "Approve."
* **Technical Principle:** Event-Driven ChatOps with Human-in-the-Loop (HITL) State Mutation. Every stage of an outage lifecycle is represented as an immutable message event or a synchronized Room Key-Value mutation inside a single Nexconn Group Channel.

---

### Level 1 (L1): System Container Abstraction
* **Plain English:** The system consists of three main boxes: (1) The **Web Browser** where the engineer watches the room and clicks buttons, (2) **Nexconn's Global Network** which delivers messages, voice calls, and room statuses instantly, and (3) our **Backend Brain** which pretends to be the broken server (Chaos Simulator) and runs the three AI bots.
* **Technical Principle:** Decoupled Client-Server-CPaaS triad. The React client never calls the LLM directly; all client interactions publish events to the Nexconn SDK or REST Orchestrator, ensuring every connected engineer sees identical state transitions simultaneously.

---

### Level 2 (L2): Component & UI Layout Design

The War Room interface uses a **Zero-Navigation 3-Pane Cockpit** so judges can trigger, observe, and resolve an outage on a single screen without scrolling away:

```
+--------------------------------------------------------------------------------------------------+
| [⚡ AGENTIC WARROOM]   Nexconn SD-CAN: Connected (42ms)        Active User: @lead_dev (Commander) |
+------------------------+------------------------------------------------+------------------------+
| PANE 1: CHAOS & ROOMS  | PANE 2: LIVE NEXCONN WAR ROOM CHANNEL          | PANE 3: LIVE TELEMETRY |
|                        |------------------------------------------------| & AI REASONING STREAM  |
| [🔥 CHAOS SIMULATOR]   | 🔴 SEV-1: #inc-db-deadlock   MTTR: 00:01:42    |                        |
|                        | Status: AWAITING_APPROVAL | [📞 Voice Huddle]  | [SYSTEM METRICS (KV)]  |
| 1. [Trigger DB Lock]   |------------------------------------------------| CPU Load:  [|||||||| ] |
| 2. [Trigger Pod Crash] | ⚡ SYSTEM (QoS: HIGH)                 20:14:02 | Error Rate: 48.2%      |
| 3. [Trigger 502 Spike] | Alert: Postgres pool exhausted (max_conn=200)  | Active Pods: 2/12      |
|                        |                                                |                        |
|------------------------| 🤖 @LogBot [DIAGNOSTIC_LOG]           20:14:05 | [AI THINKING TRACE]    |
| [ACTIVE INCIDENTS]     | Extracted faulty query in `order_repo.ts:142`  | > @LogBot: Parsed 312  |
| > 🔴 #inc-db-deadlock  | `SELECT * FROM orders FOR UPDATE NOWAIT`       |   lines in 1.2s        |
|   🟢 #inc-auth-timeout |                                                | > @DBAgent: Identified |
|   🟢 #inc-cdn-purge    | 🧠 @DBAgent [ROOT_CAUSE]              20:14:09 |   unindexed lock on    |
|                        | Uncommitted transaction holding row lock on    |   orders_pkey...       |
| [ONLINE PARTICIPANTS]  | `orders_pkey` for >45,000ms.                   |                        |
| 🟢 @lead_dev (Human)   |                                                | [SECURITY GUARDRAIL]   |
| 🤖 @LogBot (AI)        | 🛡️ @DeployBot [DIRECTED TO @lead_dev] 20:14:11 | Directed RBAC active:  |
| 🧠 @DBAgent (AI)       | Commander auth required to terminate PID 8841. | Only @lead_dev can     |
| 🛠️ @DeployBot (AI)     |                                                | execute rollbacks.     |
|                        | 🛠️ @DeployBot [ACTION_CARD]           20:14:12 |                        |
|                        | +--------------------------------------------+ | [POST-MORTEM EXPORT]   |
|                        | | Proposed Fix: Kill Idle PIDs & Scale Pool  | | [📄 Download RCA .MD]  |
|                        | | Command: `pg_terminate_backend(8841)`      | | (Unlocks on Resolve)   |
|                        | | [ ✅ Approve & Execute ]  [ ❌ Reject ]     | |                        |
|                        | +--------------------------------------------+ |                        |
|                        |------------------------------------------------|                        |
|                        | [ Type a command or @mention an agent...  [>] ]|                        |
+------------------------+------------------------------------------------+------------------------+
```

---

## 2. Incident State Machine Design

Every Nexconn incident channel progresses through a deterministic 6-stage state machine stored inside the **Nexconn Room Key-Value (KV) Store**:

```
   (Chaos Button Clicked)
             |
             v
     +---------------+
     |  1. CRITICAL  |  <-- QoS High-Priority Alert injected into channel
     +---------------+
             |
             v
     +---------------+
     | 2. DIAGNOSING |  <-- @LogBot & @DBAgent stream <think> & post root cause
     +---------------+
             |
             v
  +----------------------+
  | 3. AWAITING_APPROVAL |  <-- @DeployBot posts interactive ACTION_CARD
  +----------------------+      + In-Channel Directed Message to Commander
        |          |
        |          +---> (Human Clicks "Reject" or asks follow-up) ---> Loops back to 2. DIAGNOSING
        |
        v (Human Clicks "Approve & Execute")
     +---------------+
     | 4. MITIGATING |  <-- Card locks; simulated remediation script runs (2s)
     +---------------+
             |
             v
     +---------------+
     |  5. RESOLVED  |  <-- Room KV Banner turns GREEN; MTTR timer freezes;
     +---------------+      Auto-RCA Post-Mortem card is generated
```

---

## 3. Level 3 (L3): Data & Payload Schemas

### 3.1 Nexconn Room Key-Value (KV) State Schema
Stored at the channel level so any engineer joining mid-outage immediately renders the current dashboard state without re-reading the entire message history:

```json
{
  "incident_id": "inc-2026-8841",
  "title": "PostgreSQL Connection Pool Exhaustion",
  "severity": "SEV-1",
  "status": "AWAITING_APPROVAL",
  "commander_id": "user_lead_dev",
  "started_at_unix": 1794235442,
  "resolved_at_unix": null,
  "metrics": {
    "cpu_pct": 94,
    "error_rate_pct": 48.2,
    "healthy_pods": "2/12"
  },
  "active_action_id": "act_99201"
}
```

### 3.2 Nexconn Custom Message Schema: `ACTION_CARD`
Emitted by `@DeployBot` (and enforced via JSON schema validation on the LLM output) to render the interactive Human-in-the-Loop approval component:

```json
{
  "channelId": "inc-2026-8841",
  "senderId": "bot_deploy_executor",
  "customType": "ACTION_CARD",
  "priority": "HIGH",
  "text": "Remediation plan ready: Terminate hung PostgreSQL backend PID 8841 and scale connection pooler.",
  "customData": {
    "actionId": "act_99201",
    "actionType": "DB_KILL_AND_SCALE",
    "riskLevel": "MEDIUM",
    "targetService": "rds-prod-orders-01",
    "commandPreview": "SELECT pg_terminate_backend(8841); kubectl scale deploy/pgbouncer --replicas=6",
    "confidenceScore": 0.96,
    "status": "AWAITING_APPROVAL",
    "approvedBy": null,
    "executedAt": null
  }
}
```

### 3.3 Nexconn Custom Message Schema: `DIAGNOSTIC_LOG`
Emitted by `@LogBot` after filtering raw stack traces:

```json
{
  "channelId": "inc-2026-8841",
  "senderId": "bot_log_analyzer",
  "customType": "DIAGNOSTIC_LOG",
  "priority": "NORMAL",
  "text": "Isolated offending lock contention in order processing service.",
  "customData": {
    "service": "order-service-v2.4",
    "filePath": "src/repositories/order_repo.ts",
    "lineNumber": 142,
    "errorSignature": "PostgresError: 55P03 lock_not_available",
    "snippet": "await tx.raw('SELECT * FROM orders WHERE id = $1 FOR UPDATE NOWAIT', [orderId]);"
  }
}
```