// ============================================
// Chaos Engine — 3 Simulated Production Outages
// ============================================
// Each scenario contains a realistic stack trace, metrics snapshot,
// and metadata that gets injected into the Nexconn incident channel.

export type ScenarioId = 'db_deadlock' | 'pod_crashloop' | 'redis_502';

export interface ChaosScenario {
  id: ScenarioId;
  title: string;
  severity: 'SEV-1' | 'SEV-2';
  description: string;
  stackTrace: string;
  metrics: {
    cpuPercent: number;
    errorRatePercent: number;
    healthyPods: string;
    requestLatencyMs: number;
  };
}

export const SCENARIOS: Record<ScenarioId, ChaosScenario> = {
  db_deadlock: {
    id: 'db_deadlock',
    title: 'PostgreSQL Connection Pool Exhaustion & Deadlock',
    severity: 'SEV-1',
    description: 'Production order-service experiencing cascading timeouts due to PostgreSQL deadlock on orders table. Connection pool fully exhausted (200/200). All write operations failing with HTTP 504.',
    stackTrace: `CRITICAL ALERT — order-service-v2.4.1 — 2026-11-09T20:14:02.841Z

PostgresError: 55P03 lock_not_available
    at Parser.parseErrorMessage (node_modules/pg-protocol/src/parser.ts:369:69)
    at Parser.handlePacket (node_modules/pg-protocol/src/parser.ts:188:21)
    at Socket.<anonymous> (node_modules/pg-protocol/src/index.ts:11:42)

  Origin: src/repositories/order_repo.ts:142
  Query:  SELECT * FROM orders WHERE id = $1 FOR UPDATE NOWAIT
  
  Transaction PID 8841 has been holding row-level lock on orders_pkey
  for 45,203ms. Waiting transactions: 8842, 8843, 8844, 8845.

  Connection Pool Status:
    Pool Size:     200 / 200 (EXHAUSTED)
    Idle:          0
    Waiting Queue: 147 requests
    Avg Wait:      12,400ms

  Related Errors (last 60s):
    - 342x PostgresError: 55P03 lock_not_available
    - 89x  TimeoutError: Connection acquisition timeout (10000ms)
    - 12x  Error: Client has encountered a connection error (ECONNRESET)

  Affected Endpoints:
    POST /api/orders       → HTTP 504 (avg 12.4s)
    GET  /api/orders/:id   → HTTP 504 (avg 8.7s)
    PUT  /api/orders/:id   → HTTP 504 (avg 15.1s)`,
    metrics: {
      cpuPercent: 94,
      errorRatePercent: 48.2,
      healthyPods: '2/12',
      requestLatencyMs: 12400,
    },
  },

  pod_crashloop: {
    id: 'pod_crashloop',
    title: 'Bad Canary Deployment v2.4.1 — CrashLoopBackOff',
    severity: 'SEV-1',
    description: 'Canary deployment v2.4.1 causing CrashLoopBackOff across 8 pods. NullPointerException in new payment validation module. Customer checkout flow completely broken.',
    stackTrace: `CRITICAL ALERT — payment-gateway-v2.4.1 — 2026-11-09T20:14:02.841Z

kubectl get pods -n production:
NAME                              READY   STATUS             RESTARTS   AGE
payment-gw-v241-7d4f8b6c9-abc12  0/1     CrashLoopBackOff   8          12m
payment-gw-v241-7d4f8b6c9-def34  0/1     CrashLoopBackOff   7          12m
payment-gw-v241-7d4f8b6c9-ghi56  0/1     CrashLoopBackOff   8          12m
payment-gw-v241-7d4f8b6c9-jkl78  0/1     Error              6          12m
payment-gw-v240-stable-5c3a1b    1/1     Running            0          14d
payment-gw-v240-stable-9f2e4d    1/1     Running            0          14d

Container Logs (payment-gw-v241-7d4f8b6c9-abc12):
TypeError: Cannot read properties of null (reading 'currencyCode')
    at PaymentValidator.validate (src/validators/payment_validator.ts:87)
    at CheckoutService.processPayment (src/services/checkout.ts:234)
    at Router.handle (node_modules/express/lib/router/index.js:144)

  Root Stack:
    src/validators/payment_validator.ts:87 — this.config.currencyMap[payload.currencyCode]
    payload.currencyCode is null when region === "APAC" (new code path in v2.4.1)

  Deployment Info:
    Image:     registry.internal/payment-gw:v2.4.1-canary
    Deployed:  12 minutes ago by ci-bot via ArgoCD
    Previous:  v2.4.0-stable (14 days, 0 incidents)
    Rollback:  v2.4.0-stable available

  Impact:
    - 100% of APAC checkout requests failing (HTTP 500)
    - 34% of global checkout volume affected
    - Revenue impact: ~$2,400/minute estimated`,
    metrics: {
      cpuPercent: 12,
      errorRatePercent: 34.0,
      healthyPods: '2/8',
      requestLatencyMs: 50,
    },
  },

  redis_502: {
    id: 'redis_502',
    title: 'Redis Cache Stampede & Stripe Webhook Timeout',
    severity: 'SEV-1',
    description: 'Redis cluster experiencing cache stampede after TTL expiry on product catalog. Thundering herd causing 502s on API gateway. Stripe webhook deliveries timing out, risking payment state inconsistency.',
    stackTrace: `CRITICAL ALERT — api-gateway / redis-cluster — 2026-11-09T20:14:02.841Z

Error: Redis connection to redis-prod-001:6379 failed - LOADING Redis is loading the dataset in memory
    at RedisClient._onError (node_modules/redis/lib/client.ts:142)
    at Socket.emit (node:events:519:28)

  Cache Stampede Detected:
    Key Pattern:   product:catalog:*
    TTL Expired:   2026-11-09T20:12:00Z (all 12,847 keys simultaneously)
    Concurrent Rebuilds: 3,241 requests competing to rebuild cache
    Redis Memory:  14.2GB / 16GB (88.7%)
    Eviction Policy: allkeys-lru (actively evicting)

  API Gateway (nginx):
    502 Bad Gateway responses: 1,247 in last 120s
    Upstream timeout: proxy_read_timeout exceeded (30s)
    Active connections: 4,892 (normal: ~800)

  Stripe Webhook Failures:
    POST /webhooks/stripe → HTTP 502 (Stripe retry queue growing)
    Failed Events:
      - payment_intent.succeeded  ×  89 events (payments received but not recorded)
      - invoice.paid              ×  34 events
      - charge.refunded           ×  12 events
    Stripe Dashboard: 135 pending webhook retries
    Risk: Payment state drift between Stripe and internal ledger

  Affected Services:
    GET  /api/products    → HTTP 502 (cache miss → DB overload)
    POST /api/checkout    → HTTP 504 (Stripe call timeout)
    POST /webhooks/stripe → HTTP 502 (handler timeout)`,
    metrics: {
      cpuPercent: 78,
      errorRatePercent: 62.1,
      healthyPods: '6/12',
      requestLatencyMs: 8900,
    },
  },
};

export function getScenario(id: ScenarioId): ChaosScenario {
  const scenario = SCENARIOS[id];
  if (!scenario) throw new Error(`Unknown scenario: ${id}`);
  return scenario;
}

export function getAllScenarioIds(): ScenarioId[] {
  return Object.keys(SCENARIOS) as ScenarioId[];
}

