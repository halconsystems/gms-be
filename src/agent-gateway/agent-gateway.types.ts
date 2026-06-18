export interface AgentHandshake {
  org_id: string;
  office_id: string;
  agent_secret: string;
}

export interface ScanRequestPayload {
  scanId: string;
  userId: string;
}

export interface ScanResultMessage {
  type: 'scan_result';
  scanId: string;
  image?: string;
  template?: string;
  quality?: number;
  fingerName?: string;
  success: boolean;
  error?: string;
  code?: string;
}

export interface OutgoingScanRequest {
  type: 'scan_request';
  scanId: string;
}

export interface ScanResultPublishPayload {
  scanId: string;
  s3Url?: string;
  s3Key?: string;
  userId?: string;
  success: boolean;
  error?: string;
  code?: string;
}

export type AgentErrorCode =
  | 'CONCURRENT_CAPTURE'
  | 'CAPTURE_TIMEOUT'
  | string;

export function requestChannel(orgId: string, officeId: string): string {
  return `scan:request:${orgId}:${officeId}`;
}

export function resultChannel(scanId: string): string {
  return `scan:result:${scanId}`;
}
