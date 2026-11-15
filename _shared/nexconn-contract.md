# Nexconn Platform & SDK Contract (The Factory)

Stable reference for Nexconn Chat SDK Web integration and Server Platform API.

## 1. Credentials (Env Managed)
Loaded from `.env` (Never read/edit without permission):
- `NEXCONN_APP_KEY`: Application public identifier
- `NEXCONN_APP_SECRET`: Private signing secret
- `NEXCONN_BOT_USER_ID`: Persistent bot identifier (`warroom_bot`)
- `NEXCONN_API_URL`: Platform REST base url (default: `https://api.sg-light-api.com`)

## 2. Server API Authentication Signature
Nexconn Server REST calls require SHA-1 header signing:
- **Formula**: `SHA1(AppSecret + Nonce + Timestamp)`
- **Headers**:
  ```http
  App-Key: {NEXCONN_APP_KEY}
  Nonce: {random integer string}
  Timestamp: {Date.now().toString()}
  Signature: {sha1 hex digest}
  Content-Type: application/json
  ```

## 3. Channel Conventions
- **Format**: `#inc-<incidentId>` (e.g., `#inc-1731501234567`)
- **Type**: Group Channel (`POST /v4/group-channel/create`)
- **Members**: Current engineer user (`lead_dev`), on-call responder (`sre_oncall`), bot user (`warroom_bot`).
- **Dynamic Join**: `POST /v4/group-channel/join` adds invited responders directly without approval.

## 4. Message Dispatch Convention
Server dispatches messages via `POST /v4/group-channel/message/send`:
```json
{
  "channelId": "inc-<id>",
  "senderId": "warroom_bot",
  "text": "Human readable summary for fallbacks",
  "customType": "DIAGNOSTIC_LOG | ROOT_CAUSE_ANALYSIS | ACTION_CARD | TYPING_INDICATOR | INCIDENT_SYNC",
  "customData": "JSON stringified payload from card-schemas.md"
}
```

## 5. Web SDK Client Protocol
- **Initialization**: `NCEngine.init({ appKey })`
- **Session Connect**: `engine.connect(userId, token)`
- **Channel Subscription**: `engine.getGroupChannel(channelId)`
- **Event Listeners**:
  - `onMessageReceived(msg)`: Parses `msg.customType` and `JSON.parse(msg.customData)`
  - Direct message submission via `channel.sendMessage({ text })`

