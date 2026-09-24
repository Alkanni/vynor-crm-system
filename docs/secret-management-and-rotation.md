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

### 2.4 Meta WhatsApp Cloud API Access Token

- **Rotation Interval:** 60 days (or before system user token expiration).
- **Impact:** Affects outbound WhatsApp message delivery.
- **Procedure:**
  1. In Meta Business Manager -> System Users, generate a new permanent access token with `whatsapp_business_messaging` permissions.
  2. Encrypt the new credentials into a `ProviderCredentialEnvelope` using the current active master key.
  3. Update the `ChannelAccount` record in PostgreSQL with the new envelope ciphertext and set `rotatedAt = NOW()`.
  4. Dispatch a test outbound message template.
  5. Revoke the previous token in Meta Business Manager.

---

### 2.5 Master Envelope Encryption Key (Key Re-encryption)

- **Rotation Interval:** Annual.
- **Procedure:**
  1. Add new master key version (`ENCRYPTION_KEY_V2`) to the Secret Manager.
  2. Run the administrative re-encryption utility:
     - Fetch all rows from `ChannelAccount` where `keyId = 'v1'`.
     - Decrypt payload using `ENCRYPTION_KEY_V1`.
     - Re-encrypt payload using `ENCRYPTION_KEY_V2` with a fresh IV.
     - Update records with `keyId = 'v2'`.
  3. Verify all adapters can decrypt credentials with key `v2`.
  4. Deprecate and archive `ENCRYPTION_KEY_V1`.
