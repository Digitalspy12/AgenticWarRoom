# Agentic WarRoom

**Team Fall_ak** | Kundan K Khuntia & Arihant Bulbulsingh Yadav  
**Nexconn App Key:** qd46yzrfq1sof
**GitHub:** https://github.com/Digitalspy12/AgenticWarRoom  
**Demo Video:** `YOUR_DEMO_VIDEO_URL`  
**Live App:** `YOUR_LIVE_APP_URL`

---

### The big idea

When software breaks in production, the fix usually takes hours because the team is scattered across a dozen disconnected tools. Agentic WarRoom puts AI specialists and human developers in the same chat room. The AI agents investigate the problem and prepare a fix; the humans review it, approve it, and watch every teammate's screen update at the same moment. Think of it as a smart emergency room for software teams, where diagnosis and treatment happen in one shared space instead of six separate ones.

---

## The problem

When a production system goes down at 2 AM, on-call engineers scramble across six tabs: an alert tool, raw logs, a team chat thread, a monitoring dashboard, a terminal, and an AI assistant. Context ends up scattered across tools that do not talk to each other. Resolution time stretches from minutes into hours while the team pieces together what happened, who should act, and what commands are safe to run.

We built Agentic WarRoom because we watched this happen repeatedly and thought: what if the chat room itself was the control plane? AI agents act as junior specialists who fetch data, diagnose the failure, and prepare the fix, while a human commander reviews and approves every action before it runs.

## What it does

Agentic WarRoom is a real-time incident triage cockpit. An on-call engineer triggers a simulated outage (database connection exhaustion, container crash loops, or cache gateway errors) with one click. Three AI agents chain together automatically:

1. **@LogBot** parses the raw error output and extracts the failure signature.
2. **@DBAgent** correlates infrastructure telemetry to identify the root cause and map how the failure spread.
3. **@DeployBot** turns those findings into a remediation playbook with specific commands the team can run.

The playbook arrives as an interactive Action Card inside the Nexconn chat channel. The engineer reads the proposed commands, checks the risk level, and clicks "Approve & Execute" or rejects it.

When the incident resolves, a natural voice debrief plays automatically: "War Room, incident resolved in 10 seconds. Root cause: Bad Canary Deployment. Canary Rollback executed by lead dev. Systems nominal." The system also generates a downloadable post-mortem report from the full channel history.

## How AI agents and dev teams collaborate

The full workflow is a 4-step loop where humans and AI agents work side by side:

1. **Engineer triggers an outage.** One click in the Chaos Drawer injects a realistic production failure. The system instantly opens a dedicated Nexconn group channel for that incident.
2. **AI agents investigate together.** @LogBot, @DBAgent, and @DeployBot chain their outputs in sequence. While they work, every team member in the channel sees live typing indicators ("@DBAgent is correlating telemetry...") so the room never feels like a black box.
3. **Team arrives and collaborates.** The incident commander hits "Page SRE" to pull a second responder directly into the channel mid-crisis. Both engineers see the same diagnostic cards, the same live timer, and the same proposed fix at the same instant across separate browser tabs. Either can @-mention an agent to ask follow-up questions ("@DeployBot change risk to LOW") or add their own observations in plain chat alongside the bots.
4. **Human approves, system executes.** Only a human can click "Approve & Execute." If two people click at the same time, the server accepts the first and blocks the second to prevent conflicting actions. Once resolved, every responder hears the same voice debrief simultaneously.

## Nexconn SDK features used

Every message, state change, and coordination signal in Agentic WarRoom flows through Nexconn.

- **Group channel creation** (`POST /v4/group-channel/create`): Each incident provisions a dedicated `#inc-<id>` channel. This channel is the war room.
- **Server-side message dispatch** (`POST /v4/group-channel/message/send`): All three agents post structured JSON payloads (`customType` + `customData`) as the bot user. The client parses these into diagnostic cards, root cause timelines, and interactive action cards.
- **Web SDK real-time streaming** (`NCEngine.init`, `engine.connect`, `onMessageReceived`): The React client subscribes to the channel and renders incoming agent messages, human chat, and typing indicators via WebSocket.
- **Typing indicators** (`customType: 'TYPING_INDICATOR'`): When an agent is working, the channel broadcasts a typing event. The UI shows animated status phrases ("@LogBot is analyzing stack traces...").
- **Cross-tab state sync** (`customType: 'INCIDENT_SYNC'`): Incident state transitions are broadcast as custom messages. Every open tab sees the same state at the same moment.
- **Dynamic group membership** (`POST /v4/group-channel/join`): The "Page SRE" button invites additional responders into the active channel mid-incident, no approval wall needed.
- **SHA-1 HMAC server authentication**: Every Platform API call is cryptographically signed, generated fresh per request.
- **Human bidirectional chat**: Engineers type directly into the war room and can @-mention agents to ask follow-up questions or tell @DeployBot to revise a playbook.

## Engineering risks we overcame

Building a multiplayer incident cockpit on a chat SDK surfaced hard problems.

**Concurrent approvals in multiplayer rooms.** Two engineers clicking "Approve" at the same time could trigger conflicting rollbacks. The first request atomically locks the incident; any later call is rejected. A broadcast simultaneously disables all approval buttons across every responder's tab.

**LLM hallucinations in destructive commands.** An unconstrained model could generate dangerous infrastructure commands. We enforced strict output schemas on all agent responses, added timeout-based deterministic fallback playbooks, and kept a mandatory human approval gate before any command runs.

**Cross-continent message latency.** Messages route through Nexconn's Singapore cluster. Network jitter could delay state sync between responders. We paired WebSocket broadcasts with local HTTP polling as a fallback, so state changes arrive within 2 seconds regardless of network conditions.

**Browser autoplay blocking voice debriefs.** Modern browsers block audio playback on asynchronous events. We bypassed this using the Web Audio API's buffer decoding path, which cannot be blocked once the audio context is primed by any earlier user interaction.

**Timer drift across browser tabs.** Background tab throttling causes local timers to diverge by 5 to 15 seconds between responders. All clients compute elapsed time from the server's original timestamp, so every responder sees the same resolution timer to the millisecond.


## Prior work disclosure

This project was built entirely during the Nexconn Build Challenge window (Oct 28 to Nov 22, 2026). No prior codebase existed before the challenge began.

## Traction and feedback

We ran 15+ simulated incident drills during development, covering all three outage scenarios (database exhaustion, container crash loops, cache gateway errors). Average resolution time across drills: under 30 seconds from trigger to resolved state. We demonstrated the cockpit to a peer engineering lead who manages an on-call rotation. His response: "This is a nice idea, something my team would actually use." We are onboarding a small group of SRE teams for live incident drill testing.

## Why this can become a product

Every software company with on-call rotations has the same scattered-tools problem. Existing incident platforms (PagerDuty, Rootly, incident.io) handle alerting and post-mortems well, but none put AI agents and human responders in the same real-time chat room where diagnosis, discussion, and remediation happen together. Agentic WarRoom fills that gap using Nexconn's chat infrastructure, which supports 10,000 monthly active users on the free tier. Revenue would come from premium features: custom agent playbooks for specific infrastructure stacks, integrations with existing alerting and monitoring tools, audit-grade incident logs, and team analytics dashboards. The core loop (trigger, diagnose, approve, resolve, debrief) takes under 30 seconds in our demo.

---
