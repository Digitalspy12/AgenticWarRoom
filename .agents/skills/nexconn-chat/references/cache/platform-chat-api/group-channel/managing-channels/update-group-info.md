# Update group channel info

Update the profile and permission settings for a group channel.

## Request[​](#request "Direct link to Request")

**POST:** `https://`[Base URL](/platform-chat-api/prepare-to-use-api/base-url.md)`/v4/group-channel/profile/update`

**Rate limit:** 100 per second

**Signature:** Required. See [API request signature](/platform-chat-api/prepare-to-use-api/auth.md).

## Request body[​](#request-body "Direct link to Request body")

Content type: `application/json`

| Parameter         | Type     | Required | Description                                                                                                                                                                                           |
| ----------------- | -------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `channelId`       | `String` | Yes      | Group channel ID. Max 64 characters. Supports uppercase and lowercase letters and numbers.                                                                                                            |
| `groupProfile`    | `JSON`   | No       | Group basic information in JSON format. See the key descriptions below.                                                                                                                               |
| `permissions`     | `JSON`   | No       | Group permission settings in JSON format. See the key descriptions below.                                                                                                                             |
| `groupExtProfile` | `JSON`   | No       | Group extended information in JSON format. Keys must be prefixed with `ext_` and cannot exceed 32 characters. Values cannot exceed 256 characters. Up to 10 key-value pairs are supported by default. |

**`groupProfile` keys:**

| Key            | Type     | Description                              |
| -------------- | -------- | ---------------------------------------- |
| `name`         | `String` | Group name. Max 64 characters.           |
| `introduction` | `String` | Group introduction. Max 512 characters.  |
| `announcement` | `String` | Group announcement. Max 1024 characters. |
| `portraitUrl`  | `String` | Group avatar URL. Max 128 characters.    |

**`permissions` keys:**

| Key              | Type     | Description                                                                                                                                           |
| ---------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `joinPerm`       | `Number` | Permission to join the group. `0`: Owner approval required (default). `1`: No approval needed. `2`: Approved by owner or admin. `3`: No one can join. |
| `removePerm`     | `Number` | Permission to remove members. `0`: Owner only (default). `1`: Owner and admins. `2`: All members.                                                     |
| `memInvitePerm`  | `Number` | Permission to invite others. `0`: Owner only (default). `1`: Owner and admins. `2`: All members.                                                      |
| `invitePerm`     | `Number` | Invitation handling. `0`: Invitee consent not required (default). `1`: Invitee consent required.                                                      |
| `profilePerm`    | `Number` | Permission to modify group profile. `0`: Owner only (default). `1`: Owner and admins. `2`: All members.                                               |
| `memProfilePerm` | `Number` | Permission to set member profile. `0`: Owner, admins, and self (default). `1`: Owner and self. `2`: Self only.                                        |

## Request example[​](#request-example "Direct link to Request example")

HTTP

```http
POST /v4/group-channel/profile/update HTTP/1.1
Host: api.sg-light-api.com
App-Key: uwd1c0sxdlx2
Nonce: 14314
Timestamp: 1408710653491
Signature: 45beb7cc7307889a8e711219a47b7cf6a5b000e8
Content-Type: application/json

{
    "channelId": "testGroupId",
    "groupProfile": {
        "introduction": "Group introduction",
        "name": "Group name"
    }
}

```

## Response[​](#response "Direct link to Response")

| Field  | Type     | Description                                                                         |
| ------ | -------- | ----------------------------------------------------------------------------------- |
| `code` | `Number` | Return code. `0` indicates success. See [Status codes](/platform-chat-api/code.md). |

## Response example[​](#response-example "Direct link to Response example")

HTTP

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{"code":0}

```
