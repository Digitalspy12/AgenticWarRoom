# 04_channel-metadata - Nexconn Channel Metadata & Cross-Tab Sync

One job: Synchronize incident state, MTTR timer, and pinned cards across browser tabs using Nexconn Channel Metadata.

## Inputs
- Working (this run): `client/src/lib/nexconnClient.ts`
- Working (this run): `server/src/services/nexconnService.ts`
- Working (this run): `client/src/App.tsx`
- Reference (every run): `../../_shared/nexconn-contract.md`
- Reference (every run): `../../_shared/incident-states.md`

Do NOT load: older stage artifacts, completed chaos scenarios, or unrelated styling files.

## Process
1. Inspect current channel metadata support in `server/src/services/nexconnService.ts`. Add endpoint caller for `POST /v4/group-channel/metadata/set` (or retrieve).
2. Wire up client-side metadata listener in `client/src/lib/nexconnClient.ts` using Nexconn SDK's channel metadata events.
3. Update `client/src/App.tsx` to reconcile incident state, active channel, and pinned cards when metadata updates arrive.
4. Verify fallback: if Nexconn platform metadata endpoint is rate-limited or unavailable, gracefully fall back to local REST polling without breaking UI.

## Outputs
- `client/src/lib/nexconnClient.ts`
- `server/src/services/nexconnService.ts`
- `client/src/App.tsx`

## Check
Run client and server dev processes. Open two tabs at `http://localhost:5173`. Trigger an incident in Tab A. Confirm Tab B receives the metadata update, transitions to `DIAGNOSING`, and displays the synchronized incident banner and MTTR timer. Write verdict to `check.md`.

