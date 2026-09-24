# Container Security, Vulnerability Scanning, and Provenance Plan

This document establishes the container hardening policy, automated vulnerability scanning gates, Software Bill of Materials (SBOM) generation, and cryptographic provenance attestation for VYNOR CRM (**FND-INF-007**).

---

## 1. Container Hardening Baseline (FND-INF-001)

All VYNOR CRM container images (`apps/api`, `apps/worker`, `apps/web`) adhere to defense-in-depth hardening standards:

### 1.1 Non-Root Execution

- Containers never run as `root` (UID 0).
- Runtime processes execute under dedicated system accounts:
  - `vynor:nodejs` (UID `1001`, GID `1001`) for API and Worker services.
  - `nextjs:nodejs` (UID `1001`, GID `1001`) for the Web frontend.
- Filesystem permissions are strictly scoped during build stages to prevent privilege escalation.

### 1.2 Minimal Attack Surface

- Base images use minimal Alpine Linux (`node:24-alpine`) or distroless images, stripping build tools, package managers, and development headers from the final runner stages.
- Multi-stage builds isolate build-time secrets and compile-time devDependencies from production images.
- Unnecessary Linux capabilities are dropped (`cap_drop: ["ALL"]`) in container orchestration.

---

## 2. Automated Vulnerability Scanning

### 2.1 Scanner Selection: Aqua Security Trivy

VYNOR CRM standardizes on [Trivy](https://github.com/aquasecurity/trivy) for vulnerability scanning of:

- Container base OS packages (Alpine APKs).
- Application language dependencies (npm / pnpm packages from `pnpm-lock.yaml`).
- Misconfigurations and embedded secrets.

### 2.2 Security Gate & Enforcement Thresholds

| Vulnerability Severity | CI / Deployment Action                          | Remediation SLA             |
| :--------------------- | :---------------------------------------------- | :-------------------------- |
| **CRITICAL**           | **Hard Failure (Blocks CI & Deployment)**       | Immediate (Within 24 hours) |
| **HIGH**               | Warning / Soft gate (Fails if fix is available) | 14 days                     |
| **MEDIUM**             | Logged to vulnerability report                  | 30 days                     |
| **LOW**                | Informational                                   | Routine dependency updates  |

### 2.3 CI Integration

Trivy runs automatically in GitHub Actions on every pull request affecting Dockerfiles, lockfiles, or applications, and runs as a scheduled weekly cron scan against production base images. Results are exported in SARIF format and uploaded directly to GitHub Code Scanning Alerts.

---

## 3. Software Bill of Materials (SBOM)

### 3.1 Standards & Formats

VYNOR CRM generates automated SBOMs using **Syft** (`anchore/sbom-action`) for every built container image, supporting two canonical open standards:

1. **SPDX 2.3 JSON:** The ISO/IEC standard format for software package data.
2. **CycloneDX 1.5 JSON:** The OWASP flagship standard for application security and software supply-chain analysis.

### 3.2 SBOM Contents

Each SBOM catalogues:

- Root operating system layers, package names, versions, licenses, and architecture.
- Full transitive dependency graph of all npm workspace packages and external dependencies.
- Cryptographic SHA-256 digests of all binaries, JavaScript bundles, and Prisma engine libraries.

### 3.3 Storage and Distribution

SBOM artifacts are stored alongside published container images in GitHub Packages / GitHub Releases and can be audited by downstream consumers.

---

## 4. Cryptographic Provenance & Signing (SLSA Level 3)

### 4.1 Sigstore Cosign Keyless Signing

Container images published to container registries (GHCR / AWS ECR) are cryptographically signed using **Sigstore Cosign** via GitHub Actions OIDC keyless authentication:

```bash
# Example GitHub Actions keyless image signing
cosign sign --yes "${IMAGE_URI}@${IMAGE_DIGEST}"
```

- **Keyless Trust:** Relies on GitHub OIDC identity tokens; no static private keys or long-lived secrets are stored in repository settings.
- **Transparency Log:** Signatures and certificates are recorded in Rekor, Sigstore's public tamper-evident transparency log.

### 4.2 In-Toto SLSA Provenance Attestation

Each build generates a verifiable SLSA Provenance attestation documenting:

- Exact Git commit SHA, branch, and repository URL.
- GitHub Actions workflow run ID and trigger event.
- Builder identity and environment parameters.
- Digest of input dependencies and output image artifacts.

```bash
# Example Cosign SLSA provenance attestation
cosign attest --yes \
  --predicate sbom-spdx.json \
  --type spdxjson \
  "${IMAGE_URI}@${IMAGE_DIGEST}"
```

### 4.3 Deployment Verification Policy

Production container orchestrators or Kubernetes clusters enforce admission validation via Kyverno or OPA Gatekeeper:

- Reject images without a valid Sigstore signature matching the official VYNOR CRM GitHub repository.
- Reject images with unverified provenance or critical unpatched CVEs.
