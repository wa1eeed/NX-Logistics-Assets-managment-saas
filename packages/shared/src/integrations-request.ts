// ============================================================
// Integration / customization requests (e.g. WASL). NOT auto-activated — the
// tenant raises a request; the platform team reviews, sets up and activates it
// manually. Type is open-ended for future integrations.
// ============================================================

export type IntegrationStatus = 'REQUESTED' | 'UNDER_REVIEW' | 'IN_SETUP' | 'ACTIVE' | 'REJECTED' | 'CANCELLED';

export const INTEGRATION_STATUSES: IntegrationStatus[] = ['REQUESTED', 'UNDER_REVIEW', 'IN_SETUP', 'ACTIVE', 'REJECTED', 'CANCELLED'];

export interface IntegrationRequestDto {
  id: string;
  tenantId: string | null;
  tenantCode: string | null;
  type: string;
  status: IntegrationStatus;
  requestedBy: string | null;
  notes: string | null;
  handledBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateIntegrationRequestDto {
  type?: string;  // defaults to WASL
  notes?: string;
}
