import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { OwnershipType, type ExternalLeaseSummary, type SupplierSummary } from '@nx-lam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { nextRefNo } from '../../common/refno';
import { CreateLeaseDto, CreateSupplierDto, UpdateSupplierDto } from './dto/acquisition.dto';

const DAY = 24 * 60 * 60 * 1000;
const dec = (v: Prisma.Decimal | null): number | null => (v == null ? null : Number(v));

@Injectable()
export class AcquisitionService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------- Suppliers ----------------

  async listSuppliers(): Promise<SupplierSummary[]> {
    const rows = await this.prisma.supplier.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
      include: { _count: { select: { leases: true } } },
    });
    return rows.map((s) => ({
      id: s.id, name: s.name, dealType: s.dealType as SupplierSummary['dealType'],
      contact: (s.contact as Record<string, unknown> | null) ?? null,
      leaseCount: s._count.leases, createdAt: s.createdAt.toISOString(),
    }));
  }

  async createSupplier(dto: CreateSupplierDto) {
    return this.prisma.supplier.create({
      data: { name: dto.name.trim(), dealType: dto.dealType ?? 'BOTH', contact: dto.contact ? (dto.contact as Prisma.InputJsonValue) : undefined },
    });
  }

  async updateSupplier(id: string, dto: UpdateSupplierDto) {
    await this.ensureSupplier(id);
    return this.prisma.supplier.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.dealType !== undefined ? { dealType: dto.dealType } : {}),
        ...(dto.contact !== undefined ? { contact: dto.contact as Prisma.InputJsonValue } : {}),
      },
    });
  }

  async removeSupplier(id: string): Promise<{ id: string }> {
    await this.ensureSupplier(id);
    const leases = await this.prisma.externalLeaseContract.count({ where: { supplierId: id } });
    if (leases > 0) throw new BadRequestException('Cannot delete a supplier with lease contracts');
    await this.prisma.supplier.update({ where: { id }, data: { deletedAt: new Date() } });
    return { id };
  }

  // ---------------- External lease ----------------

  async listLeases(user: AuthenticatedUser): Promise<ExternalLeaseSummary[]> {
    const rows = await this.prisma.externalLeaseContract.findMany({
      orderBy: { createdAt: 'desc' },
      include: { supplier: true, asset: true },
    });
    const finance = user.permissions.includes('finance.read');
    return rows.map((l) => {
      const base: ExternalLeaseSummary = {
        id: l.id, refNo: l.refNo, assetId: l.assetId, assetCode: l.asset.code,
        supplierId: l.supplierId, supplierName: l.supplier.name, ratePeriod: l.ratePeriod,
        startDate: l.startDate.toISOString(), endDate: l.endDate.toISOString(),
        maintenanceBearer: l.maintenanceBearer, insuranceBearer: l.insuranceBearer,
        returnObligation: l.returnObligation,
        daysRemaining: Math.ceil((l.endDate.getTime() - Date.now()) / DAY),
      };
      if (finance) base.periodicRate = dec(l.periodicRate);
      return base;
    });
  }

  async createLease(dto: CreateLeaseDto): Promise<ExternalLeaseSummary> {
    const asset = await this.prisma.asset.findFirst({ where: { id: dto.assetId, deletedAt: null } });
    if (!asset) throw new BadRequestException('Asset not found');
    if (asset.ownershipType !== OwnershipType.EXTERNALLY_RENTED) {
      throw new BadRequestException('Lease can only be attached to an externally-rented asset');
    }
    const supplier = await this.prisma.supplier.findFirst({ where: { id: dto.supplierId, deletedAt: null } });
    if (!supplier) throw new BadRequestException('Supplier not found');
    const existing = await this.prisma.externalLeaseContract.findUnique({ where: { assetId: dto.assetId } });
    if (existing) throw new ConflictException('Asset already has a lease contract');
    const from = new Date(dto.startDate);
    const to = new Date(dto.endDate);
    if (!(from < to)) throw new BadRequestException('startDate must be before endDate');

    await this.prisma.externalLeaseContract.create({
      data: {
        refNo: await nextRefNo(this.prisma, 'externalLeaseContract', 'LEASE'),
        assetId: dto.assetId,
        supplierId: dto.supplierId,
        periodicRate: dto.periodicRate,
        ratePeriod: dto.ratePeriod ?? 'MONTHLY',
        startDate: from,
        endDate: to,
        maintenanceBearer: dto.maintenanceBearer ?? 'SUPPLIER',
        insuranceBearer: dto.insuranceBearer ?? 'SUPPLIER',
        returnObligation: dto.returnObligation ?? true,
      },
    });
    const list = await this.listLeases({ permissions: ['finance.read'] } as AuthenticatedUser);
    return list.find((l) => l.assetId === dto.assetId)!;
  }

  private async ensureSupplier(id: string) {
    const s = await this.prisma.supplier.findFirst({ where: { id, deletedAt: null } });
    if (!s) throw new NotFoundException('Supplier not found');
    return s;
  }
}
