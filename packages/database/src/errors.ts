import { Prisma } from '@prisma/client';

/** Prisma error code for a write that violates a unique constraint. */
const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

/** True when a write failed because a row with the same unique key already exists. */
export function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === UNIQUE_CONSTRAINT_VIOLATION
  );
}
