// ============================================================
// Tax invoices — full fields for a compliant Saudi tax invoice, WITHOUT any
// ZATCA integration yet (zatcaUuid/zatcaQr reserved, left empty). The seller is
// the platform operator; the buyer is the tenant (snapshot at issue time).
// ============================================================

/** Default VAT rate (%) — configurable per invoice. */
export const DEFAULT_VAT_RATE = 15;

export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PAID' | 'VOID';
export type InvoiceLineKind = 'SEATS' | 'MODULE' | 'TOPUP' | 'PER_VEHICLE' | 'SUBSCRIPTION' | 'OTHER';

export interface InvoiceLineDto {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  kind: InvoiceLineKind | null;
}

export interface InvoiceDto {
  id: string;
  number: string;
  type: string;
  status: InvoiceStatus;
  seller: { name: string; vat: string | null; cr: string | null; address: string | null };
  buyer: { name: string; vat: string | null; cr: string | null; address: string | null };
  currency: string;
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  periodStart: string | null;
  periodEnd: string | null;
  subscriptionRef: string | null;
  paymentMethod: string | null;
  paymentRef: string | null;
  issuedAt: string;
  lines: InvoiceLineDto[];
}

/** Seller (platform operator) details — stored platform-side, editable by the admin. */
export interface InvoiceSeller {
  name: string;
  vatNumber: string | null;
  crNumber: string | null;
  address: string | null;
}

export interface UpdateInvoiceSellerDto {
  name?: string;
  vatNumber?: string | null;
  crNumber?: string | null;
  address?: string | null;
}
