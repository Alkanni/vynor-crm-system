# Channel Setup Guide

> **Issue:** [#37](https://github.com/Alkanni/vynor-crm-system/issues/37)
> **Audience:** Workspace admins, DevOps engineers and developers
> **Status:** Active

How to connect WhatsApp Business (Cloud API), Telegram, Email, Facebook Messenger, Instagram, LINE, Web Live Chat and your own system (Custom API) to VYNOR, what each platform needs, and how to test everything locally. For the internal design see [Channel Architecture & Contracts](channel-architecture-and-contracts.md).

---

## 1. What each channel supports

| Platform                    | How customer messages arrive                                      | Agent replies                | Delivery status             | Needs a public HTTPS URL |
| :-------------------------- | :---------------------------------------------------------------- | :--------------------------- | :-------------------------- | :----------------------: |
| WhatsApp Business Cloud API | Meta webhook                                                      | Text                         | Sent, delivered, read, fail |           Yes            |
| Telegram bot                | Telegram webhook, or polling by the worker when there is no HTTPS | Text                         | Sent, fail                  |            No            |
| Email (IMAP + SMTP)         | The worker checks the mailbox (IMAP)                              | Text over SMTP, threaded     | Sent, fail                  |            No            |
| Facebook Messenger          | Meta webhook                                                      | Text                         | Delivered, read, fail       |           Yes            |
| Instagram Direct            | Meta webhook                                                      | Text                         | Read, fail                  |           Yes            |
| LINE Official Account       | LINE webhook                                                      | Text (push message)          | Sent, fail                  |           Yes            |
| Web Live Chat               | Widget embedded on your website                                   | Text                         | Sent                        |  Reachable by visitors   |
| Custom API                  | Your system posts signed requests                                 | Signed POST to your endpoint | What your system reports    | Reachable by your system |

Incoming photos, voice notes, videos, documents and stickers are shown in the Inbox through short-lived signed links (the files stay with the provider until an agent opens them). Sending attachments from the Inbox is not supported yet; replies are text.

---

## 2. Before you start

### 2.1 Encryption key (required)

Channel credentials (access tokens, app secrets, mailbox passwords) are verified with the provider and then stored encrypted with AES-256-GCM, bound to the channel they belong to. API responses never return them; the app only shows masked hints such as `7000000001:••••le12`.

Set the same key on the **API and the worker**:

```bash
openssl rand -base64 32
```

```dotenv
ENCRYPTION_MASTER_KEY=<output of the command above>
ENCRYPTION_KEY_ID=v1
```

Without a key, connecting a channel fails with _"Channel credentials cannot be stored because ENCRYPTION_MASTER_KEY is not set"_. In `staging` and `production` the API and worker refuse to start without it. Rotation is described in [Secret Management & Rotation](secret-management-and-rotation.md#25-channel-credential-encryption-key).

### 2.2 Public HTTPS address for webhooks

WhatsApp, Messenger, Instagram and LINE only deliver messages to public HTTPS addresses. Set the public origin of the API:

```dotenv
PUBLIC_WEBHOOK_BASE_URL=https://crm.example.com
```

Every channel gets its own unguessable callback URL, `https://crm.example.com/api/v1/webhooks/<provider>/<channel key>`. The bundled Caddy configuration routes `/api/v1/webhooks/*` to the API with a 5 MB body limit. `PUBLIC_WEBHOOK_BASE_URL` defaults to `APP_URL`; when it is not HTTPS the app warns that the provider cannot reach the callback URL.

After changing `PUBLIC_WEBHOOK_BASE_URL`, restart the API and use **Update credentials** on each webhook channel so VYNOR registers the new URL with the provider.

### 2.3 Running services

- **API** (`apps/api`) receives webhooks, serves the app and the web chat widget.
- **Worker** (`apps/worker`) turns provider events into conversations, sends replies, and polls mailboxes and Telegram bots. Without it messages are received but never appear, and replies stay in _Sending_ (after 15 minutes they are marked failed).
- Database migrations must be applied (`pnpm --filter @vynor/database db:migrate:deploy`).

### 2.4 Permissions

Connecting, updating, testing and deleting channels requires `integration:manage` (workspace admins by default); seeing them requires `integration:read`. Replying requires `message:send`.

---

## 3. Connecting a channel

1. Open **Channels → Connect a platform** and pick the platform.
2. Fill in the fields. **Where do I find these?** lists the exact places in the provider's console.
3. Press **Connect**. VYNOR checks the credentials with the provider first (for example Telegram `getMe`, the WhatsApp phone number, an IMAP login and SMTP handshake). Nothing is stored if the check fails, and the provider's reason is shown.
4. The final step shows anything left to do: a callback URL and verify token to paste into the provider console, a polling note, a signing secret or the web chat embed snippet. The same details stay available in the channel's settings.

In the channel settings you can:

- **Test connection** — runs the provider health check again.
- **Update credentials** — re-enter secrets (they are never shown again). The current credentials keep working if the new ones are rejected.
- Assign **Human agents** and the **distribution method** used to auto-assign new conversations.
- **Delete** the channel. Conversations stay in the Inbox history; the callback URL and widget stop working and replies are blocked.

A channel marked **Reconnect** has credentials the provider no longer accepts (expired or revoked token, changed password). Replies are blocked until the credentials are updated.

---

## 4. Platform guides

### 4.1 WhatsApp Business Platform (Cloud API)

You need a Meta Business portfolio, a Meta app of type **Business** with the **WhatsApp** product, and a phone number registered in WhatsApp Manager.

1. **App Dashboard → WhatsApp → API Setup**: copy the **Phone number ID** and the **WhatsApp Business Account ID**.
2. **Business Settings → Users → System users**: create an admin system user, assign it your app and your WhatsApp account, then generate a token that never expires with `whatsapp_business_messaging` and `whatsapp_business_management`. This is the **Permanent access token**.
3. **App settings → Basic**: copy the **App secret**. VYNOR uses it to check the `X-Hub-Signature-256` header of every webhook.
4. Connect the channel in VYNOR. VYNOR subscribes your app to the WhatsApp Business Account (`POST /{WABA-ID}/subscribed_apps`) and, when `PUBLIC_WEBHOOK_BASE_URL` is HTTPS, points the phone number's webhook at the channel's callback URL.
5. If VYNOR could not set the webhook (no HTTPS yet, or Meta could not reach the URL), open **App Dashboard → WhatsApp → Configuration**, enter the **Callback URL** and **Verify token** shown by VYNOR, and subscribe to the **messages** field.
6. Press **Test connection**, then send a WhatsApp message to the number.

Good to know:

- **24-hour window.** WhatsApp only delivers free-form replies within 24 hours of the customer's last message. After that Meta requires approved template messages, which the Inbox does not send yet. The Inbox shows a banner when the window has closed and a failed reply explains why.
- The **test number** from API Setup can only message recipient numbers you added there.
- Several numbers can share one Meta app: connect each number as its own channel. Events are filed by phone number ID, so a single app-level callback URL also works.
- The Graph API version is `META_GRAPH_API_VERSION` (default `v26.0`).

### 4.2 Telegram

1. In Telegram, open **@BotFather** and send `/newbot` (or `/token` for an existing bot). Copy the token, for example `123456789:AAE…`.
2. Connect the channel in VYNOR.
   - With an HTTPS `PUBLIC_WEBHOOK_BASE_URL`, VYNOR calls `setWebhook` with a secret token and rejects requests without the matching `X-Telegram-Bot-Api-Secret-Token` header.
   - Otherwise VYNOR removes any webhook and the worker fetches updates with `getUpdates` every `TELEGRAM_POLL_INTERVAL_SECONDS` (default 3). This is the easiest way to try VYNOR locally.

Good to know:

- A bot token can only feed one system. Do not use the same bot in another tool at the same time; Telegram answers the second consumer with a conflict error.
- Customers must start the chat with the bot first; bots cannot message people who never wrote to them.
- Telegram does not report delivery or read receipts, so replies stay at _Sent_. If the customer blocked the bot, the reply fails with that reason.

### 4.3 Email (IMAP and SMTP)

1. Enable **IMAP** in the mailbox settings.
2. Create an **app password**. Gmail requires 2-Step Verification first ([Google guide](https://support.google.com/mail/answer/185833)); Yahoo and Zoho work the same way. Normal account passwords are rejected by these providers.
3. Connect the channel. The **Gmail**, **Yahoo** and **Zoho Mail** presets fill in the servers; for other providers use the IMAP/SMTP settings from their help pages (SSL on for ports 993/465, off for 143/587 with STARTTLS).

Good to know:

- The worker checks the inbox every `EMAIL_POLL_INTERVAL_SECONDS` (default 30). Only mail that arrives after connecting is imported.
- Replies go out over SMTP with a `Re:` subject and `In-Reply-To`/`References` headers, so they thread in the customer's mail client. Quoted history is trimmed from incoming replies.
- Incoming attachments are listed by name and size.
- **Microsoft 365 and Outlook.com** mailboxes only allow OAuth sign-in for IMAP and SMTP, which VYNOR does not support yet.

### 4.4 Facebook Messenger

1. Add the **Messenger** product to your Meta app and connect your Facebook Page.
2. Generate a **Page access token** with `pages_messaging` (for production, a token generated through a system user does not expire) and copy the **Page ID**.
3. Copy the **App secret** from **App settings → Basic**.
4. Connect the channel. VYNOR subscribes the Page to your app for `messages`, `messaging_postbacks`, `message_deliveries` and `message_reads`.
5. In **App Dashboard → Messenger → Settings → Webhooks**, enter the **Callback URL** and **Verify token** shown by VYNOR and subscribe to the same fields.

Messenger also has a 24-hour window for standard replies. To message people who have no role in your app, the app needs Advanced Access to `pages_messaging` (App Review).

### 4.5 Instagram Direct

1. Add **Instagram API with Instagram login** to your Meta app and add your Instagram **professional** (business or creator) account.
2. Generate an access token for the account with `instagram_business_basic` and `instagram_business_manage_messages`, and copy the **Instagram app secret** from the same page.
3. In the Instagram app on the phone, turn on **Settings → Messages and story replies → Message controls → Connected tools → Allow access to messages**.
4. Connect the channel. VYNOR subscribes the account for `messages` and `messaging_seen`.
5. In **Instagram → API setup with Instagram login → Configure webhooks**, enter the **Callback URL** and **Verify token** shown by VYNOR and subscribe to `messages` and `messaging_seen`.

Instagram uses the same 24-hour window. Long-lived Instagram tokens expire after 60 days; update the credentials in VYNOR before they do.

### 4.6 LINE Official Account

1. In the [LINE Developers console](https://developers.line.biz/console/), open the **Messaging API** channel of your Official Account.
2. Copy the **Channel secret** from **Basic settings**, then issue a long-lived **Channel access token** on the **Messaging API** tab.
3. Connect the channel. With an HTTPS `PUBLIC_WEBHOOK_BASE_URL`, VYNOR sets the webhook URL for you.
4. If VYNOR asks you to, turn on **Use webhook** on the Messaging API tab. Turning off the automatic greeting and auto-reply messages in LINE Official Account Manager keeps LINE from answering before your agents do.

Replies are sent as push messages, which count toward your LINE plan's monthly message quota.

### 4.7 Web Live Chat

1. Connect the channel with the website address (shown as the inbox identifier), a welcome message and the widget colour.
2. Paste the **embed snippet** into every page that should show the chat, just before `</body>`:

   ```html
   <script src="https://crm.example.com/api/v1/webchat/<widget key>/widget.js" async></script>
   ```

3. Visitors chat in the bubble; agents answer from the Inbox and replies appear in the widget within a few seconds.

The snippet points at `PUBLIC_WEBHOOK_BASE_URL` (or `APP_URL`), which must be reachable from your visitors' browsers over HTTPS. Each browser gets a signed visitor token stored locally, and each visitor IP is rate limited (20 sessions and 30 messages per minute per widget). Deleting the channel disables the snippet.

### 4.8 Custom API

Connect your own system (an app, a marketplace integration, another chat tool). Enter the HTTPS endpoint where VYNOR should send agent replies; after connecting, VYNOR shows the **Webhook URL** your system posts to and the **Signing secret** for both directions.

**Signing.** Every request in either direction carries:

- `X-Vynor-Timestamp`: Unix time in seconds.
- `X-Vynor-Signature`: `sha256=` + hex HMAC-SHA256 of `<timestamp>.<raw body>` with the signing secret.

VYNOR rejects requests with a wrong signature or a timestamp more than 5 minutes off.

```js
import { createHmac } from 'node:crypto';

const body = JSON.stringify(payload);
const timestamp = String(Math.floor(Date.now() / 1000));
const signature = `sha256=${createHmac('sha256', SIGNING_SECRET).update(`${timestamp}.${body}`).digest('hex')}`;

await fetch(WEBHOOK_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Vynor-Timestamp': timestamp,
    'X-Vynor-Signature': signature,
  },
  body,
});
```

**Customer message → VYNOR** (`POST` to the webhook URL). `messageId` must be unique per message; repeats are ignored. Send one object or `{ "events": [ … ] }`.

```json
{
  "messageId": "ext-1001",
  "contact": {
    "id": "cust-42",
    "name": "Budi Santoso",
    "email": "budi@example.com",
    "phone": "+6281234567890"
  },
  "text": "Halo, pesanan saya sudah dikirim?",
  "timestamp": "2026-09-30T08:00:00Z"
}
```

**Delivery update → VYNOR** for a reply your system handled, using the `messageId` your endpoint returned:

```json
{ "type": "status", "messageId": "your-reply-id", "status": "delivered" }
```

`status` is `sent`, `delivered`, `read` or `failed` (with an optional `"error": { "code": "…", "message": "…" }`).

**Agent reply → your endpoint.** VYNOR posts, with the signature headers and `X-Vynor-Channel`:

```json
{
  "type": "message",
  "id": "01920f6e-…",
  "channelId": "…",
  "conversationId": "…",
  "contact": { "id": "cust-42" },
  "text": "Sudah kami kirim hari ini.",
  "createdAt": "2026-09-30T08:01:00Z"
}
```

Answer with any `2xx` status, optionally `{ "messageId": "your-reply-id" }` for later status updates (otherwise VYNOR's `id` is used). `429`, `5xx` and timeouts are retried; other `4xx` answers fail the reply with the message your endpoint returned. Redirects are not followed. **Test connection** posts `{ "type": "ping", … }`.

---

## 5. Trying it locally

1. Start PostgreSQL, apply migrations and seed the database:

   ```bash
   pnpm --filter @vynor/database db:migrate:deploy
   pnpm --filter @vynor/database db:seed
   ```

2. Configure `apps/api/.env` and `apps/worker/.env` from their `.env.example` files with the same `ENCRYPTION_MASTER_KEY`. For the local sign-in button add `AUTH_DEV_SESSION_ENABLED=true` to the API (only honoured when `APP_ENV` is `local` or `test`).
3. Point the web app at the API in `apps/web/.env.local` (`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SOCKET_URL`) and run `pnpm dev`.
4. Open `/login` and choose **Sign in as local admin (development)** (seeded user `admin@vynor.local`).
5. Connect a **Telegram** bot (polling, no tunnel needed), an **Email** mailbox or a **Web Live Chat** widget right away. For WhatsApp, Messenger, Instagram and LINE, expose the API over HTTPS with a tunnel, for example:

   ```bash
   cloudflared tunnel --url http://localhost:3001
   ```

   Set `PUBLIC_WEBHOOK_BASE_URL` to the printed `https://…` address, restart the API, and connect (or update the credentials of) the channel.

When the API is unreachable the web app falls back to preview mode with sample data; the Channels page says so in a banner.

---

## 6. Troubleshooting

| Symptom                                                 | What to check                                                                                                                                                                |
| :------------------------------------------------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Channel credentials cannot be stored…" when connecting | `ENCRYPTION_MASTER_KEY` is set on the API and worker; restart both.                                                                                                          |
| WhatsApp/Meta/LINE messages never arrive                | The callback URL is public HTTPS, the verify token matches, the `messages` field is subscribed, and the API log shows no `401 Invalid webhook signature` (wrong app secret). |
| Telegram stops receiving after a while                  | The same bot token is used by another system (webhook or polling conflict).                                                                                                  |
| Email: "rejected the username or password"              | Use an app password and make sure IMAP is enabled. Microsoft 365 and Outlook.com need OAuth, which is not supported yet.                                                     |
| Replies stay in _Sending_                               | The worker is running and uses the same database and encryption key.                                                                                                         |
| Reply failed: 24-hour window                            | The customer has to write again, or use an approved template from the provider's tools.                                                                                      |
| Channel shows **Reconnect**                             | The token expired or was revoked, or the password changed. Use **Update credentials**.                                                                                       |
