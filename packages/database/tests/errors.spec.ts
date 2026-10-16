import { describe, expect, it } from 'vitest';
import { isUniqueConstraintViolation, Prisma } from '../src/index.js';

function prismaError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('write failed', { code, clientVersion: 'test' });
}

describe('isUniqueConstraintViolation (issue #40)', () => {
  it('recognizes a unique constraint violation', () => {
    expect(isUniqueConstraintViolation(prismaError('P2002'))).toBe(true);
  });

  it('ignores other Prisma errors and non-Prisma values', () => {
    expect(isUniqueConstraintViolation(prismaError('P2025'))).toBe(false);
    expect(isUniqueConstraintViolation(new Error('P2002'))).toBe(false);
    expect(isUniqueConstraintViolation({ code: 'P2002' })).toBe(false);
    expect(isUniqueConstraintViolation(undefined)).toBe(false);
  });
});
