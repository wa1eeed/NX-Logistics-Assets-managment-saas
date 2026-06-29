import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  DEFAULT_VAT_RATE,
  type InvoiceDto, type InvoiceLineKind, type InvoiceSeller, type PaymentPurpose, type UpdateInvoiceSellerDto,
} from '@nx-lam/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { currentTenantId } from '../../common/tenant/tenant-context';

const SELLER_KEY = 'invoice.seller';
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Tax invoices. The seller (platform) is stored platform-side; the buyer (tenant)
 * is snapshotted at issue time. Invoices are issued automatically when a Tap
 * payment is confirmed. NOT tenant-scoped at the model level (the serial is a
 * global platform sequence) — tenant-facing reads filter by tenant explicitly.
 */
@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- seller (platform operator) config ----

  async getSeller(): Promise<InvoiceSeller> {
    const row = await this.prisma.platformSetting.findUnique({ where: { key: SELLER_KEY } });
    const v = (row?.value as Partial<InvoiceSeller> | null) ?? {};
    return {
      name: v.name || 'NX-LAM Platform',
      vatNumber: v.vatNumber ?? null,
      crNumber: v.crNumber ?? null,
      address: v.address ?? null,
    };
  }

  async updateSeller(dto: UpdateInvoiceSellerDto): Promise<InvoiceSeller> {
    const current = await this.getSeller();
    const next: InvoiceSeller = {
      name: dto.name ?? current.name,
      vatNumber: dto.vatNumber !== undefined ? dto.vatNumber : current.vatNumber,
      crNumber: dto.crNumber !== undefined ? dto.crNumber : current.crNumber,
      address: dto.address !== undefined ? dto.address : current.address,
    };
    await this.prisma.platformSetting.upsert({
      where: { key: SELLER_KEY }, create: { key: SELLER_KEY, value: next as object }, update: { value: next as object },
    });
    return next;
  }

  // ---- issuing (called once a Tap payment is confirmed) ----

  private async nextNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const n = await this.prisma.invoice.count(); // global sequence (Invoice not tenant-scoped)
    return `INV-${year}-${String(n + 1).padStart(4, '0')}`;
  }

  private describe(p: { purpose: PaymentPurpose; quantity: number | null; moduleKey: string | null }): { description: string; kind: InvoiceLineKind; qty: number } {
    if (p.purpose === 'SEATS') return { description: `Extra user seats × ${p.quantity ?? 1}`, kind: 'SEATS', qty: Math.max(1, p.quantity ?? 1) };
    if (p.purpose === 'MODULE') return { description: `Module add-on: ${p.moduleKey}`, kind: 'MODULE', qty: 1 };
    if (p.purpose === 'TRACKING') return { description: `Vehicle tracking — ${p.quantity ?? 1} vehicle(s)`, kind: 'PER_VEHICLE', qty: Math.max(1, p.quantity ?? 1) };
    return { description: 'Subscription wallet top-up', kind: 'TOPUP', qty: 1 };
  }

  /** Issue a paid tax invoice for a confirmed payment. Amount is treated as VAT-inclusive. */
  async issueForPayment(p: {
    id: string; tenantId: string | null; purpose: PaymentPurpose; amount: number;
    quantity: number | null; moduleKey: string | null; providerChargeId: string | null; currency?: string;
  }): Promise<void> {
    if (!p.tenantId || !(p.amount > 0)) return;
    const tenant = await this.prisma.tenant.findUnique({ where: { id: p.tenantId } });
    if (!tenant) return;
    const seller = await this.getSeller();

    const vatRate = DEFAULT_VAT_RATE;
    const total = round2(p.amount);
    const subtotal = round2(total / (1 + vatRate / 100));
    const vatAmount = round2(total - subtotal);
    const { description, kind, qty } = this.describe(p);
    const number = await this.nextNumber();

    await this.prisma.invoice.create({
      data: {
        tenantId: p.tenantId,
        number,
        status: 'PAID',
        sellerName: seller.name, sellerVat: seller.vatNumber, sellerCr: seller.crNumber, sellerAddress: seller.address,
        buyerName: tenant.legalName || tenant.name,
        buyerVat: tenant.vatNumber, buyerCr: tenant.crNumber,
        buyerAddress: [tenant.city].filter(Boolean).join(', ') || null,
        currency: p.currency || 'SAR',
        subtotal: new Prisma.Decimal(subtotal),
        vatRate: new Prisma.Decimal(vatRate),
        vatAmount: new Prisma.Decimal(vatAmount),
        total: new Prisma.Decimal(total),
        paymentMethod: 'TAP',
        paymentRef: p.providerChargeId ?? p.id,
        subscriptionRef: tenant.code,
        lines: { create: [{ description, quantity: new Prisma.Decimal(qty), unitPrice: new Prisma.Decimal(round2(subtotal / qty)), lineTotal: new Prisma.Decimal(subtotal), kind }] },
      },
    });
  }

  // ---- reads ----

  async listMine(): Promise<InvoiceDto[]> {
    const tenantId = currentTenantId();
    if (!tenantId) throw new ForbiddenException('No tenant context');
    const rows = await this.prisma.invoice.findMany({ where: { tenantId }, orderBy: { issuedAt: 'desc' }, include: { lines: true } });
    return rows.map((r) => this.toDto(r));
  }

  async getMine(id: string): Promise<InvoiceDto> {
    const tenantId = currentTenantId();
    const row = await this.prisma.invoice.findFirst({ where: { id, ...(tenantId ? { tenantId } : {}) }, include: { lines: true } });
    if (!row) throw new NotFoundException('Invoice not found');
    return this.toDto(row);
  }

  async listAll(): Promise<InvoiceDto[]> {
    const rows = await this.prisma.invoice.findMany({ orderBy: { issuedAt: 'desc' }, take: 200, include: { lines: true } });
    return rows.map((r) => this.toDto(r));
  }

  private toDto(r: Prisma.InvoiceGetPayload<{ include: { lines: true } }>): InvoiceDto {
    return {
      id: r.id, number: r.number, type: r.type, status: r.status as InvoiceDto['status'],
      seller: { name: r.sellerName, vat: r.sellerVat, cr: r.sellerCr, address: r.sellerAddress },
      buyer: { name: r.buyerName, vat: r.buyerVat, cr: r.buyerCr, address: r.buyerAddress },
      currency: r.currency,
      subtotal: Number(r.subtotal), vatRate: Number(r.vatRate), vatAmount: Number(r.vatAmount), total: Number(r.total),
      periodStart: r.periodStart ? r.periodStart.toISOString() : null,
      periodEnd: r.periodEnd ? r.periodEnd.toISOString() : null,
      subscriptionRef: r.subscriptionRef, paymentMethod: r.paymentMethod, paymentRef: r.paymentRef,
      issuedAt: r.issuedAt.toISOString(),
      lines: r.lines.map((l) => ({
        id: l.id, description: l.description, quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice), lineTotal: Number(l.lineTotal), kind: l.kind as InvoiceLineKind | null,
      })),
    };
  }
}
