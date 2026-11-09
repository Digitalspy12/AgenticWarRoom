# System Architecture: Nexconn SDK + Hybrid AI Engine

## 1. End-to-End Architectural Topology

**Agentic WarRoom** uses an event-driven architecture that pairs **Nexconn's Software-Defined Communication Accelerate Network (SD-CAN)** with a **Dual-Mode AI Orchestrator** capable of switching transparently between a local `llama.cpp` server (`TwIL-8B`) and cloud inference (`Groq API`).

```
+---------------------------------------------------------------------------------------------------+
|                                  CLIENT TIER (Browser / React + Vite)                             |
|                                                                                                   |
|  +-----------------------+    +------------------------------+    +----------------------------+  |
|  | Chaos Control Trigger |    | Nexconn Chat & Room KV View  |    | Nexconn 1-Click Voice Call |  |
|  +-----------+-----------+    +--------------+---------------+    +--------------+-------------+  |
+--------------|-------------------------------|-----------------------------------|----------------+
               | HTTP POST                     | WSS (Sub-120ms SD-CAN)            | WebRTC Audio
               | /api/incidents/*              v                                   v
               |                +----------------------------------------------------------------+
               |                |              NEXCONN CLOUD INFRASTRUCTURE (CPaaS)              |
               |                |                                                                |
               |                | • Stateful WebSocket Gateways & Pub/Sub Fan-Out                |
               |                | • Room Key-Value (KV) State Sync & Cursor Pagination           |
               |                | • QoS High-Priority Message Queue & Directed Messaging         |
               |                | • STUN/TURN Voice Relay & Multi-Device Unread Sync             |
               |                +--------------+-----------------------------------+-------------+
               |                               ^                                   |
               |                               | Server REST / SDK                 | Webhook Events
               v                               | (Post Cards / Mutate KV)          v
+----------------------------------------------+----------------------------------------------------+
|                              BACKEND ORCHESTRATOR TIER (Node.js / Express)                        |
|                                                                                                   |
|  +--------------------------+     +-----------------------------+     +------------------------+  |
|  | Incident & Chaos Manager | --> | Multi-Agent State Machine   | <-- | Webhook & HITL Handler |  |
|  +--------------------------+     | (@LogBot/@DBAgent/@Deploy)  |     +------------------------+  |
|                                   +--------------+--------------+                                 |
|                                                  |                                                |
|                                                  v                                                |
|                                   +-----------------------------+                                 |
|                                   | Unified OpenAI-Compat Client|                                 |
|                                   |  • Strips <think> tags      |                                 |
|                                   |  • Rolling Context Window   |                                 |
|                                   |  • JSON Schema Validator    |                                 |
|                                   +--------------+--------------+                                 |
+--------------------------------------------------|------------------------------------------------+
                                                   |
                         +-------------------------+-------------------------+
                         | (ENV = development)                               | (ENV = production)
                         v                                                   v
+-------------------------------------------------+ +-----------------------------------------------+
|       LOCAL INFERENCE ENGINE (llama.cpp)        | |         CLOUD INFERENCE ENGINE (Groq)         |
|                                                 | |                                               |
| • Model: webAI-Official/TwIL-8B                 | | • Chat Model: llama-3.1-8b-instant (~560 t/s) |
| • File: TwIL-8B-Q4_K_M-balanced.gguf            | | • Audio Model: whisper-large-v3-turbo         |
| • Server: http://127.0.0.1:8080/v1 (-c 8192)    | | • Endpoint: https://api.groq.com/openai/v1    |
+-------------------------------------------------+ +-----------------------------------------------+
```

---

## 2. Deep Dive: Nexconn SDK Primitives Used & Why

To demonstrate deep technical mastery of the Nexconn platform, **Agentic WarRoom** integrates six distinct Nexconn architectural primitives:

1. **Programmatic Group Channel Provisioning:**
   * Instead of static chat rooms, every incident dynamically provisions an isolated Group Channel (`#inc-<id>`), automatically registering the human on-call squad alongside the three bot identities (`bot_log_analyzer`, `bot_db_diagnostician`, `bot_deploy_executor`).
2. **Quality-of-Service (QoS) Message Priority:**
   * During an outage, high-volume log dumps can choke standard WebSocket streams. Critical system alerts and `@DeployBot` `ACTION_CARD` payloads are flagged with high priority so Nexconn's transport layer guarantees delivery ahead of conversational chatter.
3. **Room Key-Value (KV) Real-Time Synchronization:**
   * Rather than polling a separate REST database for incident severity, live CPU/error telemetry, or MTTR timers, the backend writes state updates directly to the Nexconn Channel KV store. All connected clients subscribe to KV mutation events to render a synchronized top-bar dashboard with zero drift.
4. **In-Channel Directed Messaging (RBAC Security):**
   * When `@DeployBot` proposes a destructive production action (such as killing database PIDs or rolling back a container), it sends an **In-Channel Directed Message** targeted specifically at the Incident Commander's `userId`. Other observers see the public `ACTION_CARD`, but only the authorized commander receives the cryptographic execution prompt inside the shared stream.
5. **Optimistic UI & Message State Mutation:**
   * When the engineer clicks `[Approve & Execute]`, the client uses optimistic UI rendering while the backend updates the existing `ACTION_CARD` message payload in-place (`status: "AWAITING_APPROVAL"` $\rightarrow$ `"EXECUTED_BY_HUMAN"`), preventing duplicate approval clicks (race conditions) from other engineers.
6. **1-Click Voice Escalation & Streaming Transcription:**
   * Engineers can escalate from text triage into an embedded audio bridge with a single click. Voice segments are piped to Whisper to inject timestamped live voice summaries directly into the channel timeline.

---

## 3. Deep Dive: Hybrid AI Inference & KV Cache Architecture

### 3.1 Unified Inference Router (`llmRouter.ts`)
Because `llama-server` and Groq both expose the OpenAI `/v1/chat/completions` contract, our backend uses a single adapter that switches behavior via environment variables:

```typescript
export const LLM_CONFIG = {
  development: {
    baseURL: "http://127.0.0.1:8080/v1",
    apiKey: "local-llama-cpp",
    model: "twil-8b",
    maxTokens: 1024,
    temperature: 0.2
  },
  production: {
    baseURL: "https://api.groq.com/openai/v1",
    apiKey: process.env.GROQ_API_KEY,
    model: "llama-3.1-8b-instant",
    maxTokens: 1024,
    temperature: 0.2
  }
};
```

### 3.2 Managing `TwIL-8B` Reasoning Tokens & Local KV Cache
When running `webAI-Official/TwIL-8B` (`TwIL-8B-Q4_K_M-balanced.gguf`) locally via `llama-server` at $\sim 7.1\text{ tokens/sec}$, two bottlenecks must be controlled:
1. **Reasoning Trace Extraction (`<think>` Blocks):**
   * `TwIL-8B` emits `<think>...</think>` reasoning tokens before its final output.
   * **How We Process It:** Our streaming reader intercepts tokens inside `<think>` tags and throttles them into 1-second **Nexconn Ephemeral Status Updates** (displayed in Pane 3's *AI Thinking Trace* box), so the user sees live progress instead of staring at a frozen screen for $12\text{ seconds}$. Once `</think>` is reached, the remaining JSON string is parsed and posted to the Nexconn channel as a structured card.
2. **KV Cache Discipline & Sliding Context Window:**
   * Running `llama-server` with `-c 40960` allocates massive KV buffers across 4 slots that degrade prompt evaluation speed as chat history grows.
   * **How We Process It:** Launch local `llama-server` with `-c 8192 -np 1` (single parallel slot dedicated to the active war room) and implement **Sliding Context Truncation** in the orchestrator: each agent call receives only (a) its specific System Prompt, (b) the current Room KV summary, and (c) the last $6$ structured messages ($\le 1,500\text{ tokens}$ total). This keeps local prompt evaluation under $2.5\text{ seconds}$.

---

## 4. Step-by-Step Processing Sequence (Outage-to-Resolution)

```
Human Dev          WarRoom UI         Nexconn Cloud       Orchestrator API       LLM (TwIL-8B / Groq)
    |                  |                    |                     |                       |
    |--1. Click Chaos->|                    |                     |                       |
    |                  |--2. POST /trigger----------------------->|                       |
    |                  |                    |<-3. Create Channel--|                       |
    |                  |                    |<-4. Set KV (SEV-1)--|                       |
    |                  |<-5. WSS Sync KV----|                     |                       |
    |                  |                    |                     |--6. Prompt @LogBot--->|
    |                  |<-7. Stream <think> Status (WSS)----------|<-7. Stream <think>----|
    |                  |                    |<-8. Post LOG Card---|<-8. Return JSON-------|
    |                  |<-9. Render Card----|                     |                       |
    |                  |                    |                     |--10. Prompt @DBAgent->|
    |                  |                    |<-11. Post RCA Card--|<-11. Return JSON------|
    |                  |                    |                     |--12. Prompt @Deploy-->|
    |                  |                    |<-13. Directed Auth--|<-13. Return JSON------|
    |                  |                    |<-14. Post ACTION----|                       |
    |                  |<-15. Render Button-|                     |                       |
    |--16. Approve---->|                    |                     |                       |
    |                  |--17. POST /execute---------------------->|                       |
    |                  |                    |<-18. Mutate Card----|                       |
    |                  |                    |<-19. Set KV (GREEN)-|                       |
    |                  |<-20. Render Green + Auto-RCA Summary-----|                       |
```

### Detailed Stage Processing Breakdown

1. **Step 1–5 (Ingestion & State Initialization):**
   * User triggers a Chaos preset $\rightarrow$ Backend generates `inc-2026-xxxx`, creates the Nexconn Group Channel, sets Room KV (`status: "CRITICAL"`), and posts the high-priority stack trace.
   * **Latency Target:** $< 600\text{ ms}$ end-to-end via Nexconn WebSocket fan-out.
2. **Step 6–9 (`@LogBot` Telemetry Extraction):**
   * Orchestrator feeds the raw stack trace to the LLM using the `@LogBot` system prompt $\rightarrow$ LLM isolates the exact file, line number, and error code $\rightarrow$ Backend posts a `DIAGNOSTIC_LOG` custom message to Nexconn.
3. **Step 10–11 (`@DBAgent` Root-Cause Diagnosis):**
   * Orchestrator passes `@LogBot`'s JSON output + simulated telemetry metrics into the `@DBAgent` prompt $\rightarrow$ LLM identifies the underlying architectural failure and posts a `ROOT_CAUSE` card.
4. **Step 12–15 (`@DeployBot` HITL Proposal & Directed Guardrail):**
   * Orchestrator invokes `@DeployBot` $\rightarrow$ Dispatches an **In-Channel Directed Message** to `@lead_dev` verifying rollback authority $\rightarrow$ Broadcasts the interactive `ACTION_CARD` with `status: "AWAITING_APPROVAL"`.
5. **Step 16–20 (Human Approval, Execution & Auto-RCA):**
   * `@lead_dev` clicks `[Approve & Execute]` $\rightarrow$ Backend validates user role, mutates the `ACTION_CARD` to `EXECUTED_BY_HUMAN`, updates Room KV to `status: "RESOLVED"` with final `mttrSeconds`, and synthesizes the downloadable Markdown Root Cause Analysis (RCA) report.

---

## 5. Production Deployment & Resilience Strategy

* **Frontend Hosting:** Deployed on **Vercel** as a static SPA with environment variables pointing to the hosted Orchestrator and Nexconn WebSocket gateway.
* **Backend Hosting:** Deployed on **Render / Railway** (Node.js runtime) configured with `NODE_ENV=production` and `GROQ_API_KEY` so judges experience sub-second ($\sim 560\text{ tokens/sec}$) multi-agent responses 24/7 without requiring your local laptop to stay online.
* **Deterministic Schema Fallback:** If either the local `TwIL-8B` model or cloud API ever returns malformed JSON or times out under heavy load, the Orchestrator includes a deterministic JSON repair parser and fallback template so a live judge demo never crashes.