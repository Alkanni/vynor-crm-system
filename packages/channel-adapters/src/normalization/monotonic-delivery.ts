import { type DeliveryStatus, isDeliveryStatusMonotonic } from '@vynor/contracts';

export interface DeliveryTransitionResult {
  accepted: boolean;
  isNoop: boolean;
  currentStatus: DeliveryStatus;
  finalStatus: DeliveryStatus;
  reason?: string;
}

/**
 * Applies monotonic delivery status progression rules (FND-064).
 * Returns whether the transition was accepted and the resolved final status.
 */
export function applyDeliveryStatusTransition(
  currentStatus: DeliveryStatus,
  incomingStatus: DeliveryStatus,
): DeliveryTransitionResult {
  // 1. Same status is an idempotent no-op
  if (currentStatus === incomingStatus) {
    return {
      accepted: true,
      isNoop: true,
      currentStatus,
      finalStatus: currentStatus,
      reason: 'Idempotent duplicate status update',
    };
  }

  // 2. Validate monotonic progression
  const isValid = isDeliveryStatusMonotonic(currentStatus, incomingStatus);

  if (!isValid) {
    return {
      accepted: false,
      isNoop: true,
      currentStatus,
      finalStatus: currentStatus,
      reason: `Out-of-order transition rejected: cannot transition from "${currentStatus}" to "${incomingStatus}"`,
    };
  }

  return {
    accepted: true,
    isNoop: false,
    currentStatus,
    finalStatus: incomingStatus,
  };
}
