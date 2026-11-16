# 05_polish-demo - Production Hardening, Voice Briefings & Demo Runbook

One job: Final polish, synthesized executive audio briefings (Microsoft Azure Neural TTS), unblockable Web Audio API engine, multi-persona switcher, and post-mortem verification.

## Inputs
- Working: `client/src/App.tsx`
- Working: `client/src/components/AudioBriefingPill.tsx`
- Working: `client/src/components/IncidentBanner.tsx`
- Working: `client/src/components/ChatPane.tsx`
- Working: `client/src/components/TelemetryPane.tsx`
- Working: `client/src/lib/speechService.ts`
- Working: `client/src/lib/constants.ts`
- Working: `server/src/routes/incidents.ts`
- Working: `server/src/services/ttsService.ts`
- Reference: `../../_shared/card-schemas.md`
- Reference: `../../_shared/nexconn-contract.md`
- Reference: `../../_shared/incident-states.md`

## Process
1. **Azure Neural Voice Debriefing**:
   - Stream 24kHz studio MP3 (`en-US-AriaNeural`) via server endpoint `/api/incidents/:id/audio` using `msedge-tts` (zero cost, zero API keys).
   - Natural human phrasing: strips raw database IDs (`inc-...`), strips container versions (`v2.4.1 —`), fixes duplicate words, replaces all underscores in spoken text, keeps verbal script crisp and short (under 18 words).
2. **Unblockable Web Audio API Player**:
   - Decodes audio array buffers directly with `AudioContext.decodeAudioData()` and plays via `AudioBufferSourceNode`, completely bypassing Chromium's asynchronous autoplay block on HTML5 `<audio>`.
   - Global one-touch audio priming on first user interaction in the tab.
3. **Guaranteed Resolution Auto-Activation**:
   - Top-level resolution watcher in root `App.tsx` automatically triggers `speechService.playBriefing(incident)` when `status === 'RESOLVED'`.
   - Fast 500ms poller in `ChatPane.tsx` upon playbook approval guarantees resolution detection within 2 seconds without relying purely on remote WebSocket packets.
4. **Dynamic Persona Management**:
   - Supports 3 live roles: Lead Dev (`lead_dev`), SRE On-Call (`sre_oncall`), and Security Lead (`sec_ops`).
   - Fixed URL parameter precedence in `constants.ts` so `setSessionUserId` updates `?as=<id>` query parameter, ensuring instant, seamless persona switching.
5. **Post-Mortem Export & MTTR**:
   - Validated markdown post-mortem download and synchronized digital MTTR timer across all tabs.

## Outputs
- `server/src/services/ttsService.ts`
- `server/src/routes/incidents.ts`
- `client/src/lib/speechService.ts`
- `client/src/lib/constants.ts`
- `client/src/components/AudioBriefingPill.tsx`
- `client/src/components/IncidentBanner.tsx`
- `client/src/components/ChatPane.tsx`
- `client/src/App.tsx`

## Check
Run end-to-end demo flow. Confirm 1-click chaos trigger, automated multi-agent diagnosis, responder page, approve & execute, audio summary/briefing, and post-mortem report download. Write verdict to `check.md`.

