# VYNOR CRM

Internal Omnichannel Communication & AI Engagement System.

## Development prerequisites

- Node.js `24.19.0`
- pnpm `11.25.0`

The required versions are also pinned in `.nvmrc`, `.node-version`, and the
root `package.json`.

## Workspace

```text
apps/
  api/       NestJS HTTP application shell
  web/       Next.js operator application shell
  worker/    NestJS background worker shell
packages/
  ai/
  channel-adapters/
  contracts/
  database/
  observability/
  shared/
  storage/
```

Install dependencies and validate the workspace:

```bash
corepack enable
pnpm install
pnpm typecheck
pnpm build
```

Run all application shells in development mode:

```bash
pnpm dev
```

This repository currently contains engineering foundation only. No business
capability has been implemented yet.
