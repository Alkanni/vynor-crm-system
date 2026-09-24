# Health Checks, Orchestration Probes & Subsystem Indicators

This document establishes the official liveness probe, readiness probe, and subsystem health indicator standards across VYNOR CRM services, conforming to **FND-049**, **FND-050**, and **AD-001**.

---

## 1. Orchestration Probes Overview (FND-049)

To ensure reliable operations within Docker, Kubernetes, and reverse-proxy topologies (Caddy), VYNOR CRM explicitly decouples **Liveness** from **Readiness**.

```mermaid
flowchart TD
    subgraph Container Orchestrator / Docker
        LivenessCheck["GET /api/v1/health/liveness<br/>(Every 10s)"]
    end

    subgraph Load Balancer / Caddy Proxy
        ReadinessCheck["GET /api/v1/health/readiness<br/>(Every 5s)"]
    end

    subgraph apps/api
        LivenessHandler["Liveness Handler<br/>(Event loop heartbeat)"]
        ReadinessHandler["Readiness Handler<br/>(Database connectivity)"]
    end

    LivenessCheck -->|Fails 3x| RestartContainer["Restart Container Process"]
    LivenessCheck -->|Succeeds| LivenessHandler
    ReadinessCheck -->|Fails| DropFromProxy["Temporarily Drop from Routing Pool"]
    ReadinessCheck -->|Succeeds (200 OK)| RouteTraffic["Route Inbound Client Traffic"]
    ReadinessCheck --> ReadinessHandler
```

### 1.1 Liveness Probe (`GET /api/v1/health/liveness`)

- **Purpose:** Verifies that the Node.js event loop is spinning and responsive to HTTP requests.
- **Rule:** **Must never** check downstream external dependencies (PostgreSQL, Redis, third-party APIs). If a database outage occurs, the API must not be restarted by orchestrators, as restarting would exacerbate connection storms.
- **Response:** Always returns `200 OK` when process is alive:
  ```json
  {
    "status": "UP",
    "service": "vynor-api",
    "uptimeSeconds": 1420,
    "timestamp": "2026-09-24T06:30:00.000Z"
  }
  ```

### 1.2 Readiness Probe (`GET /api/v1/health/readiness`)

- **Purpose:** Verifies that the instance is capable of successfully serving customer traffic.
- **Dependency Checks:** Executes a lightweight database ping (`SELECT 1`).
- **Response Codes:**
  - `200 OK`: Database connected (`status: "UP"`).
  - `503 Service Unavailable`: Database unreachable (`status: "DOWN"`).

---

## 2. Subsystem Health Indicators (FND-050)

Administrators and monitoring services can query the comprehensive health report via:

- `GET /api/v1/health`
- `GET /api/v1/health/indicators`

### Subsystem Indicator Specifications

| Subsystem       | Indicator Metrics                    | UP Criteria                         | DEGRADED Criteria                | DOWN Criteria                       |
| :-------------- | :----------------------------------- | :---------------------------------- | :------------------------------- | :---------------------------------- |
| **`database`**  | Query latency (ms)                   | Latency $\le 1000\text{ ms}$        | Latency $> 1000\text{ ms}$       | Connection rejected / timed out     |
| **`outbox`**    | Pending lag count, Dead-letter count | Lag $\le 100$, Dead-letter $= 0$    | Lag $> 100$ or Dead-letter $> 0$ | Database table unreadable           |
| **`queue`**     | `pg-boss` backlog & failed jobs      | Backlog healthy, Error rate $< 5\%$ | Error rate $5\% - 20\%$          | Queue service stopped               |
| **`webhooks`**  | Ingress journal response timing      | ACK $\le 500\text{ ms}$             | ACK $> 500\text{ ms}$            | Ingress failing signature / storage |
| **`providers`** | Meta WhatsApp Cloud API status       | Token valid, webhook ping $200$     | Partial rate limits              | Token revoked / Auth failure        |

---

## 3. Overall System Health Report Contract

```json
{
  "statusCode": 200,
  "data": {
    "status": "UP",
    "service": "vynor-api",
    "environment": "production",
    "version": "1.0.0",
    "uptimeSeconds": 86400,
    "timestamp": "2026-09-24T06:30:00.000Z",
    "indicators": {
      "database": {
        "status": "UP",
        "latencyMs": 4
      },
      "outbox": {
        "status": "UP",
        "latencyMs": 8,
        "details": {
          "pendingLagCount": 0,
          "deadLetterCount": 0
        }
      },
      "webhooks": {
        "status": "UP",
        "details": {
          "ingressBuffer": "active",
          "fastAckTargetMs": 500
        }
      }
    }
  }
}
```

---

## 4. Background Worker Health Checks (`apps/worker`)

Because the background worker daemon does not expose external ingress ports, worker health is determined via:

1. **Heartbeat Logging:** Worker emits periodic structured Pino logs at `info` level (`{ context: 'WorkerHeartbeat', status: 'healthy', uptimeSeconds }`).
2. **Process Signals:** Orchestrators monitor process PID liveness and Docker non-root exit codes.
3. **Database Outbox Drain Rate:** External monitors observe the `outbox_events` table; if pending event lag increases without consumption, an alert is triggered.
