import { z } from 'zod';

/**
 * Normalized message delivery statuses (FND-064).
 */
export const DELIVERY_STATUSES = ['PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED'] as const;

export const DeliveryStatusSchema = z.enum(DELIVERY_STATUSES);
export type DeliveryStatus = z.infer<typeof DeliveryStatusSchema>;

/**
 * Monotonic rank values for delivery statuses.
 * Higher rank indicates a more advanced delivery stage.
 */
export const DELIVERY_STATUS_RANKS: Record<DeliveryStatus, number> = {
  PENDING: 0,
  SENT: 1,
  DELIVERED: 2,
  READ: 3,
  FAILED: -1, // Special terminal error state
};

/**
 * Validates whether transitioning from currentStatus to nextStatus is valid
 * under strict monotonic progression rules (FND-064).
 *
 * Rules:
 * 1. An identical status transition is idempotent (valid, no-op).
 * 2. Status progresses strictly forward: PENDING -> SENT -> DELIVERED -> READ.
 * 3. A status cannot regress backwards (e.g., READ cannot regress to DELIVERED or SENT).
 * 4. FAILED can only be applied from non-terminal states (PENDING, SENT, DELIVERED).
 *    Once a message is confirmed READ, it cannot transition to FAILED due to a late webhook error.
 */
export function isDeliveryStatusMonotonic(
  currentStatus: DeliveryStatus,
  nextStatus: DeliveryStatus,
): boolean {
  // 1. Idempotent identical status update
  if (currentStatus === nextStatus) {
    return true;
  }

  // 2. Terminal READ state cannot be overridden
  if (currentStatus === 'READ') {
    return false;
  }

  // 3. FAILED state transition
  if (nextStatus === 'FAILED') {
    return currentStatus !== 'FAILED';
  }

  // 4. If current is already FAILED, only explicit retry (PENDING) can change it
  if (currentStatus === 'FAILED') {
    return nextStatus === 'PENDING';
  }

  // 5. Standard forward progression (SENT -> DELIVERED -> READ)
  const currentRank = DELIVERY_STATUS_RANKS[currentStatus];
  const nextRank = DELIVERY_STATUS_RANKS[nextStatus];

  return nextRank > currentRank;
}

/**
 * Normalized delivery status receipt contract (FND-064).
 */
export const NormalizedDeliveryReceiptSchema = z.object({
  workspaceId: z.string(),
  providerAccountId: z.string(),
  providerMessageId: z.string(),
  recipientIdentifier: z.string(),
  status: DeliveryStatusSchema,
  timestamp: z.string().datetime(),
  rawEventRef: z.object({
    providerEventId: z.string(),
    providerEventKey: z.string(),
  }),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
      details: z.unknown().optional(),
    })
    .optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type NormalizedDeliveryReceipt = z.infer<typeof NormalizedDeliveryReceiptSchema>;
