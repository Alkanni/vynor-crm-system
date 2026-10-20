// Container health check (Dockerfile HEALTHCHECK): exits 0 only while the worker keeps writing
// fresh heartbeats, i.e. its event loop runs, the BullMQ job queue runs and the database
// answers (see health/worker-heartbeat.service.ts).
import { isHeartbeatFresh } from './health/heartbeat.js';

process.exit((await isHeartbeatFresh()) ? 0 : 1);
