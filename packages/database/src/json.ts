import { Prisma } from '@prisma/client';

/**
 * Types a value for a JSON column. Contract interfaces lack the index signature Prisma's JSON
 * input type requires, so values that are plain JSON by construction are cast here, once.
 */
export function asJsonInput(value: object): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
}
