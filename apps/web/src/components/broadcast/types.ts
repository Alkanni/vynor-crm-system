export type BroadcastStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type TemplateApprovalStatus = 'APPROVED' | 'PENDING' | 'REJECTED';
export type TemplateCategory = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';

export interface MetaHsmTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  language: string;
  status: TemplateApprovalStatus;
  rejectionReason?: string | undefined;
  body: string;
  variables: string[]; // e.g. ['{{1}}', '{{2}}']
}

export type BroadcastState =
  | 'DRAFT'
  | 'AUDIENCE_SIZING'
  | 'TEMPLATE_SELECTION'
  | 'PARAMETER_MAPPING'
  | 'PREFLIGHT_WARNING'
  | 'SCHEDULED'
  | 'DISPATCHING'
  | 'COMPLETED'
  | 'PAUSED';

export interface PreflightCheckResult {
  id: string;
  title: string;
  status: 'PASS' | 'WARNING' | 'FAIL';
  details: string;
}

export interface BroadcastCampaignData {
  id: string;
  name: string;
  channelId: string;
  targetSegment: string;
  audienceCount: number;
  templateId: string;
  variableMapping: Record<string, string>; // e.g. { '{{1}}': 'contact.name', '{{2}}': 'order.tracking_number' }
  dispatchSchedule: 'IMMEDIATE' | 'SCHEDULED';
  scheduledTimestamp?: string | undefined;
  throttleMessagesPerSec: number;
  state: BroadcastState;
}

export interface DispatchTelemetry {
  total: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  progressPercent: number;
  currentRatePerSec: number;
}
