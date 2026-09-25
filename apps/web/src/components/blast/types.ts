export type RowValidationStatus = 'VALID' | 'INVALID_SYNTAX' | 'DUPLICATE' | 'BLOCKED';

export interface ParsedBlastRow {
  rowNumber: number;
  phone: string;
  name: string;
  variable1?: string | undefined;
  variable2?: string | undefined;
  status: RowValidationStatus;
  rejectionReason?: string | undefined;
}

export interface BlastParseSummary {
  totalRows: number;
  validCount: number;
  invalidSyntaxCount: number;
  duplicateCount: number;
  blockedCount: number;
}

export type BlastDispatcherState = 'EMPTY' | 'PARSING' | 'CATEGORIZED' | 'DISPATCHING' | 'FINISHED';
