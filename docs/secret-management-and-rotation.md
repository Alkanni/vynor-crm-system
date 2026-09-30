# VYNOR CRM — Production Secret Storage & Rotation Procedure

> **Standard:** FND-016 [P0]  
> **Audience:** Security Leads, DevOps Engineers & AI Coding Agents  
> **Status:** Active

This document addresses production secret storage strategy, resolves the hosting platform consideration (**OPEN QUESTION** from implementation planning), and specifies exact zero-downtime secret rotation procedures.

---

## 1. Hosting Platform & Secret Storage Selection

### Resolution of OPEN QUESTION (Hosting Platform)

VYNOR CRM's architecture is containerized (Docker, Docker Compose, Caddy). Deployment models range from a dedicated VPS (Coolify/Docker Compose) to Managed Kubernetes (EKS/GKE) or PaaS (Railway/Render).

To remain **hosting-platform agnostic** while maintaining strict security:

1. **Primary Secret Manager Baseline:**
   - **Recommended:** **Doppler** or **Infisical** (or cloud-native equivalents: AWS Secrets Manager / GCP Secret Manager / Vault).
   - **Mechanism:** Secrets are injected directly into process memory at container startup (via environment variables). Secrets are never written to disk, baked into Docker images, or committed to git.
2. **Database-Stored Credential Envelopes:**
   - Channel credentials (WhatsApp tokens) and AI API keys are stored in the database **encrypted at rest** using AES-256-GCM ([AD-004](adr/0004-durable-state-before-side-effects.md), `ProviderCredentialEnvelope` contract).
   - The master encryption key (`ENCRYPTION_MASTER_KEY`) is stored strictly in the external Secret Manager.

---

## 2. Zero-Downtime Secret Rotation Procedures

### 2.1 Supabase Service Role Key & JWT Secret

- **Rotation Interval:** 180 days or immediately upon suspected leakage.
- **Impact:** Affects API JWT authentication guards and Supabase Admin clients.
- **Procedure:**
  1. Generate new JWT secret / service key in Supabase Project Settings.
  2. In dual-key transition mode, configure API to accept tokens signed with either key during the 1-hour grace window.
  3. Deploy updated `SUPABASE_JWT_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` to the Secret Manager.
  4. Perform rolling restart of `apps/api` and `apps/worker`.
  5. Verify successful token verification on `/api/v1/auth/verify`.
  6. Invalidate previous key in Supabase.

---

### 2.2 PostgreSQL Database Password

- **Rotation Interval:** 90 days.
- **Impact:** Affects Prisma connection pool and pg-boss queue runner.
- **Procedure:**
  1. In Supabase Database Settings, update user password.
  2. Update `DATABASE_URL` and `DIRECT_URL` in the Secret Manager.
  3. Trigger rolling restart of `apps/worker` followed by `apps/api`.
  4. Verify `/health/ready` database ping returns `200 OK`.

---

### 2.3 Object Storage Access Keys (RustFS / S3)

- **Rotation Interval:** 90 days.
- **Impact:** Affects attachment upload and signed download URL generation.
- **Procedure:**
  1. In RustFS/S3 console, create a new access key pair (`STORAGE_ACCESS_KEY_ID_NEW`, `STORAGE_SECRET_ACCESS_KEY_NEW`) on the bucket.
  2. Update environment secrets in the Secret Manager.
  3. Restart `apps/api` and `apps/worker`.
  4. Verify an attachment can be uploaded and downloaded via presigned URL.
  5. Delete the old access key pair in RustFS/S3.

---

### 2.4 Channel Credentials (WhatsApp, Meta, Telegram, LINE, Email)

- **Rotation Interval:** Follow the provider: system user tokens for WhatsApp and Messenger can be issued without expiry, long-lived Instagram tokens expire after 60 days, mailbox app passwords and bot tokens only change when revoked. Rotate immediately on suspected leakage.
- **Impact:** Affects receiving webhooks (app secret, channel secret) and sending replies (tokens, SMTP password) for that channel only.
- **Procedure:**
  1. Issue the new credential at the provider (a new system user token, a new app password, and so on). For Telegram, `/revoke` in @BotFather issues a new token and disables the old one at once, so update VYNOR right after.
  2. In VYNOR, open **Channels**, select the channel and choose **Update credentials**. VYNOR verifies the new values with the provider before saving, encrypts them with the active key and registers the webhook again. If verification fails the old credentials stay in use.
  3. Press **Test connection** and send a test message. The change is recorded in the audit log as `channel.reconnected`.
  4. Revoke the old credential at the provider.

Channel credentials are never configured through environment variables; see [Channel Setup Guide](channel-setup-guide.md).

---

### 2.5 Channel Credential Encryption Key

`ENCRYPTION_MASTER_KEY` (32 random bytes, base64) encrypts every channel credential with AES-256-GCM. Each stored envelope records the `keyId` it was encrypted with, so keys can be rotated without downtime. The API and the worker must always share the same key settings.

- **Rotation Interval:** Annual, or immediately on suspected leakage.
- **Procedure:**
  1. Generate a new key: `openssl rand -base64 32`.
  2. On the API and the worker, make the new key active and keep the old one for decryption:

     ```dotenv
     ENCRYPTION_MASTER_KEY=<new key>
     ENCRYPTION_KEY_ID=v2
     ENCRYPTION_PREVIOUS_KEYS=v1:<old key>
     ```

     `ENCRYPTION_PREVIOUS_KEYS` takes a comma-separated list of `keyId:key` pairs.

  3. Perform a rolling restart of `apps/worker` and `apps/api`. New and updated credentials are encrypted with `v2`; existing credentials still decrypt with `v1`.
  4. Re-encrypt existing channels by choosing **Update credentials** on each one.
  5. Confirm nothing depends on the old key any more:

     ```sql
     SELECT id, name, deleted_at FROM provider_accounts WHERE credentials->>'keyId' = 'v1';
     ```

  6. Remove the old key from `ENCRYPTION_PREVIOUS_KEYS`, restart both services, and archive it in the Secret Manager.

Losing the active key makes every stored channel credential unreadable; channels then have to be connected again. Back the key up in the Secret Manager before first use.
