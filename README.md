# ⚡ Agentic WarRoom

> **Autonomous Multi-Agent Production Incident Triage Cockpit**  
> *Built for the Nexconn Build Challenge Hackathon (Nov 2026)*

Agentic WarRoom eliminates cognitive lag during mission-critical outages. Instead of context-switching between terminal windows, log viewers, and disjointed messaging tools, on-call software engineers and specialized AI agents collaborate within a shared **Nexconn Chat** operational channel to detect, diagnose, and remediate production incidents in seconds.

---

## 🌟 Key Capabilities

- **🔥 1-Click Chaos Simulator**: Side control panel to inject synthetic outages (PostgreSQL Connection Exhaustion, Pod CrashLoopBackOff, Redis 502 Spikes).
- **🤖 Autonomous 3-Agent Swarm**:
  - `@LogBot`: Parses raw stack traces, identifies offending source lines, and extracts error signatures.
  - `@DBAgent`: Analyzes database and infrastructure telemetry to isolate the root cause and map the failure cascade.
  - `@DeployBot`: Synthesizes findings into a Human-In-The-Loop (HITL) remediation playbook with executable commands.
- **⚡ Interactive Action Cards**: In-chat UI cards rendering executable commands (`kubectl`, `sql`, `sysctl`) with an interactive **"Approve & Execute"** CTA.
- **📡 Real-Time Nexconn Chat SDK Integration**: Automatic group channel creation (`#inc-<id>`), server-side message dispatch, and WebSocket streaming powered by `@nexconn/chat`.
- **⏱️ Live MTTR Stopwatch & Telemetry Cockpit**: Live tracking of incident Mean-Time-To-Resolve (MTTR), CPU/memory load, active pods, and latency.
- **📄 1-Click Post-Mortem Exporter**: Generates and downloads a markdown Incident Post-Mortem Report upon resolution.

---

## 🗺️ Project Structure & Quick Navigation

```
nexconn_chatapp_Hackathon/
├── package.json                   # Root orchestrator (runs concurrently dev servers)
├── .env.example                   # Environment configuration template
│
├── client/                        # React + TypeScript + Vite + Tailwind CSS v4
│   ├── src/
│   │   ├── components/
│   │   │   ├── IncidentBanner.tsx # Top status bar: severity badge, MTTR timer, telemetry pills
│   │   │   ├── ChaosDrawer.tsx    # Left pane: 1-click chaos injector & active session list
│   │   │   ├── ChatPane.tsx       # Center pane: real-time WebSocket chat stream & command bar
│   │   │   ├── TelemetryPane.tsx  # Right pane: KPI gauges, agent reasoning trace, RCA export
│   │   │   └── cards/
│   │   │       ├── DiagnosticLogCard.tsx  # @LogBot stack trace card with copyable log
│   │   │       ├── RootCauseCard.tsx      # @DBAgent RCA card with propagation timeline
│   │   │       └── ActionCard.tsx         # @DeployBot HITL card with Approve/Reject CTA
│   │   ├── lib/
│   │   │   ├── nexconnClient.ts   # Nexconn Chat SDK (NCEngine, GroupChannel, MessageHandler)
│   │   │   ├── api.ts             # Typed REST API client for incident management
│   │   │   ├── constants.ts       # Shared single source of truth for IDs & message types
│   │   │   └── types.ts           # Shared TypeScript interfaces & models
│   │   ├── App.tsx                # Cockpit root layout & state sync
│   │   ├── index.css              # Obsidian dark theme design tokens & scrollbar styles
│   │   └── main.tsx               # Client entry point
│   └── package.json
│
└── server/                        # Node.js + Express + TypeScript API Server
    ├── src/
    │   ├── agents/
    │   │   ├── logBot.ts          # @LogBot prompt engineering & JSON schema definition
    │   │   ├── dbAgent.ts         # @DBAgent prompt engineering & RCA schema definition
    │   │   └── deployBot.ts       # @DeployBot prompt engineering & Action Card schema
    │   ├── routes/
    │   │   ├── incidents.ts       # REST endpoints: /trigger, /execute, /reject, /scenarios
    │   │   └── auth.ts            # Nexconn session token issuance & config routes
    │   ├── services/
    │   │   ├── nexconnService.ts  # Nexconn Platform Chat API client (SHA-1 HMAC signing)
    │   │   ├── agentPipeline.ts   # Sequential pipeline chaining (@LogBot → @DBAgent → @DeployBot)
    │   │   ├── chaosEngine.ts     # Realistic outage scenarios, stack traces & metrics
    │   │   └── llmRouter.ts       # Unified LLM client (Groq cloud / TwIL-8B local toggle)
    │   ├── data/
    │   │   └── fallbackResponses.ts # Deterministic fallback responses (safety net)
    │   ├── app.ts                 # Express middleware & route mounting
    │   └── index.ts               # Server bootstrap (Port 3001)
    └── package.json
```

---

## 🚀 Hackathon Roadmap: What Every Phase Achieves

### ✅ Phase 1 (Day 1) — Foundation & Chaos Engine
*Status: COMPLETED*
- **Unified LLM Router**: Seamless switching between cloud (Groq `qwen/qwen3.8-27b`) and local LLM server via `.env` configuration. Fixed Node 24 gzip compatibility.
- **Chaos Engine**: 3 realistic production outages with detailed stack traces, container error codes, and telemetry metrics.
- **3-Agent Sequential Pipeline**: Chained agent execution (`@LogBot` → `@DBAgent` → `@DeployBot`) with 8-second timeout fallbacks.
- **Incident State Machine**: State transitions (`CRITICAL` → `DIAGNOSING` → `AWAITING_APPROVAL` → `MITIGATING` → `RESOLVED`).

### ✅ Phase 2 (Day 2) — Nexconn Chat SDK & Real-Time Sync
*Status: COMPLETED*
- **Chat SDK Integration**: Installed and configured `@nexconn/chat` and `@nexconn/engine` for the Web browser.
- **Server Token Issuance**: Implemented `GET /api/auth/token` utilizing Nexconn’s signature algorithm `SHA1(AppSecret + Nonce + Timestamp)` to register and issue user tokens dynamically.
- **Automated Channel Provisioning**: Incident triggering calls `POST /v4/group-channel/create` to provision a dedicated group channel (`#inc-<id>`) on Nexconn’s Singapore data center.
- **Server-Side Message Dispatch**: Agents post custom JSON payloads (`customType`, `customData`, `agentName`) via `POST /v4/group-channel/message/send`.
- **Bidirectional Human Chat**: Engineers can send text messages directly into the war room channel via the interactive input bar.
- **Obsidian SRE Cockpit Redesign**: Complete visual overhaul with glass panels, high-contrast badges, and user-aware auto-scroll that preserves scroll position when reading earlier messages.

### ✅ Phase 3 (Day 3) — Agent Interactivity & Typing Indicators
*Status: COMPLETED*
- **Live Typing Indicators**: Real-time agent typing state broadcast via Nexconn WebSocket (`customType: 'TYPING_INDICATOR'`) rendered with animated bouncing wave dots and agent-specific status phrases (`🤖 @LogBot is analyzing stack traces...`, `🧠 @DBAgent is correlating telemetry...`, `🛠️ @DeployBot is synthesizing remediation playbook...`).
- **In-Channel Agent Prompting**: On-call engineers can directly query or instruct agents in-channel (e.g., `@DeployBot change risk to LOW`, `@LogBot show last 20 lines`, `@DBAgent explain deadlock`) using the interactive input bar or 1-click Quick Mention action chips.
- **Dynamic Playbook Adaptation**: When instructed to alter risk or commands, `@DeployBot` regenerates a revised `ACTION_CARD` in real time and updates the incident state machine so the new playbook can be immediately approved and executed.
- **Threaded Discussions & Card Annotations**: Every diagnostic card (`DiagnosticLogCard`, `RootCauseCard`, `ActionCard`) features a slide-over discussion drawer (`CardThreadDrawer.tsx`) supporting threaded Q&A, tailored quick prompt chips, and pinned SRE annotations displayed directly on cards in the main feed.

### 🔜 Phase 4 (Day 4) — Nexconn Channel Metadata & Cross-Tab Sync
*Target: Nov 12, 2026*
- **Nexconn Room KV Store**: Sync incident status, active severity, and started timestamp in channel key-value metadata.
- **Cross-Tab Synchronization**: Zero-polling live sync — opening the WarRoom in multiple tabs reflects status updates and actions instantaneously.

### 🔜 Phase 5 (Day 5) — Voice Dispatch & Incident Briefings
*Target: Nov 13, 2026*
- **Nexconn RTC / Voice Integration**: Voice call capability for emergency sync.
- **Audio Outage Briefings**: Synthesized voice summary of the incident upon resolution.

### 🔜 Phase 6 (Day 6) — Production Deployment & Final Polish
*Target: Nov 14, 2026*
- **Railway Deployment**: Cloud deployment for both backend API and React client.
- **Demo Script & Video**: End-to-end recording showcasing complete incident triage under 30 seconds MTTR.

---

## ⚡ Quickstart

### 1. Prerequisites
- Node.js 18+ (tested on Node 20 & Node 24)
- Nexconn App Key & App Secret ([Nexconn Console](https://console.nexconn.ai))
- Groq API Key ([Groq Console](https://console.groq.com))

### 2. Configure Environment
Copy `.env.example` to `.env` in the root folder and provide your credentials:
```bash
# Nexconn Chat Platform Credentials
NEXCONN_APP_KEY=your_app_key_here
NEXCONN_APP_SECRET=your_app_secret_here
NEXCONN_BOT_USER_ID=warroom_bot
NEXCONN_API_URL=https://api.sg-light-api.com

# LLM Inference Configuration (Groq)
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_API_KEY=your_groq_api_key_here
LLM_MODEL=qwen/qwen3.8-27b
```

### 3. Run Development Servers
From the project root:
```bash
npm run dev
```
- **Web Cockpit**: `http://localhost:5173`
- **Backend API**: `http://localhost:3001`
- **Health Check**: `http://localhost:3001/api/health`

