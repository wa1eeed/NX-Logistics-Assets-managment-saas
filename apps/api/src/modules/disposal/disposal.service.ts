import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  AssetStatus, OwnershipType, SaleOrderStatus, type SaleOrderSummary,
} from '@nx-lam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AssetStatusService } from '../assets/asset-status.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { nextRefNo } from '../../common/refno';
import { CompleteSaleDto, ProposeSaleDto } from './dto/disposal.dto';

const dec = (v: Prisma.Decimal | null): number | null => (v == null ? null : Number(v));
const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

/** Effective book value: manual override, else straight-line auto-compute. */
function effectiveBookValue(a: { purchasePrice: Prisma.Decimal | null; depreciationRate: Prisma.Decimal | null; bookValue: Prisma.Decimal | null; purchaseDate: Date | null }): number | null {
  const manual = dec(a.bookValue);
  if (manual != null) return manual;
  const price = dec(a.purchasePrice);
  if (price == null) return null;
  const rate = dec(a.depreciationRate);
  if (rate == null || a.purchaseDate == null) return price;
  const years = (Date.now() - a.purchaseDate.getTime()) / MS_PER_YEAR;
  return Math.round(Math.max(price - price * rate * years, 0) * 100) / 100;
}

@Injectable()
export class DisposalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assetStatus: AssetStatusService,
  ) {}

  private canSeeFinance(u: AuthenticatedUser) {
    return u.permissions.includes('finance.read');
  }

  async list(status: SaleOrderStatus | undefined, user: AuthenticatedUser): Promise<SaleOrderSummary[]> {
    const rows = await this.prisma.saleOrder.findMany({
      where: { ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
      include: { asset: { include: { assetType: true } } },
    });
    return rows.map((r) => this.toSummary(r, user));
  }

  async propose(dto: ProposeSaleDto, user: AuthenticatedUser): Promise<SaleOrderSummary> {
    const asset = await this.prisma.asset.findFirst({ where: { id: dto.assetId, deletedAt: null } });
    if (!asset) throw new BadRequestException('Asset not found');
    if (asset.ownershipType !== OwnershipType.OWNED) throw new BadRequestException('Only owned assets can be sold');
    if (asset.status === AssetStatus.DISPOSED) throw new BadRequestException('Asset already disposed');
    const existing = await this.prisma.saleOrder.findUnique({ where: { assetId: dto.assetId } });
    if (existing && existing.status !== SaleOrderStatus.CANCELLED) {
      throw new ConflictException('An active sale order already exists for this asset');
    }
    if (existing) {
      // reuse the cancelled order row (assetId is unique)
      const updated = await this.prisma.saleOrder.update({
        where: { id: existing.id },
        data: {
          status: SaleOrderStatus.PROPOSED, askingPrice: dto.askingPrice ?? null,
          proposedBy: user.id, approvedBy: null, listedAt: null, soldAt: null, salePrice: null, buyerName: null,
        },
        include: { asset: { include: { assetType: true } } },
      });
      return this.toSummary(updated, user);
    }
    const row = await this.prisma.saleOrder.create({
      data: {
        refNo: await nextRefNo(this.prisma, 'saleOrder', 'SALE'),
        assetId: dto.assetId,
        status: SaleOrderStatus.PROPOSED,
        askingPrice: dto.askingPrice ?? null,
        proposedBy: user.id,
      },
      include: { asset: { include: { assetType: true } } },
    });
    return this.toSummary(row, user);
  }

  async approve(id: string, user: AuthenticatedUser): Promise<SaleOrderSummary> {
    const so = await this.getOrThrow(id);
    if (so.status !== SaleOrderStatus.PROPOSED) throw new BadRequestException('Only proposed orders can be approved');
    // Separation of duties: approver must differ from proposer.
    if (so.proposedBy && so.proposedBy === user.id) {
      throw new ForbiddenException('Approver must differ from the proposer (separation of duties)');
    }
    const asset = await this.prisma.asset.findUnique({ where: { id: so.assetId } });
    if (!asset) throw new NotFoundException('Asset not found');

    await this.prisma.saleOrder.update({
      where: { id }, data: { status: SaleOrderStatus.LISTED, approvedBy: user.id, listedAt: new Date() },
    });
    // Available → FOR_SALE now; In-duty → flag "not to be re-rented" (goes FOR_SALE on return).
    if (asset.status === AssetStatus.AVAILABLE) {
      await this.assetStatus.changeStatus(so.assetId, AssetStatus.FOR_SALE, user.id, { reason: `Sale order ${so.refNo} approved` });
    } else if (asset.status === AssetStatus.IN_DUTY) {
      await this.prisma.asset.update({ where: { id: so.assetId }, data: { forSaleFlag: true } });
    }
    return this.summaryById(id, user);
  }

  async complete(id: string, dto: CompleteSaleDto, user: AuthenticatedUser): Promise<SaleOrderSummary> {
    const so = await this.getOrThrow(id);
    if (so.status !== SaleOrderStatus.LISTED) throw new BadRequestException('Only listed orders can be completed');
    const asset = await this.prisma.asset.findUnique({ where: { id: so.assetId } });
    if (asset?.status !== AssetStatus.FOR_SALE) throw new BadRequestException('Asset must be For Sale to complete the sale');

    await this.prisma.saleOrder.update({
      where: { id }, data: { status: SaleOrderStatus.SOLD, salePrice: dto.salePrice, buyerName: dto.buyerName.trim(), soldAt: new Date() },
    });
    await this.assetStatus.changeStatus(so.assetId, AssetStatus.DISPOSED, user.id, { reason: `Sold via ${so.refNo} for ${dto.salePrice}` });
    return this.summaryById(id, user);
  }

  async withdraw(id: string, user: AuthenticatedUser): Promise<SaleOrderSummary> {
    const so = await this.getOrThrow(id);
    if (!([SaleOrderStatus.PROPOSED, SaleOrderStatus.LISTED] as SaleOrderStatus[]).includes(so.status as SaleOrderStatus)) {
      throw new BadRequestException('Only proposed/listed orders can be withdrawn');
    }
    const asset = await this.prisma.asset.findUnique({ where: { id: so.assetId } });
    await this.prisma.saleOrder.update({ where: { id }, data: { status: SaleOrderStatus.CANCELLED } });
    if (asset?.status === AssetStatus.FOR_SALE) {
      await this.assetStatus.changeStatus(so.assetId, AssetStatus.AVAILABLE, user.id, { reason: `Sale order ${so.refNo} withdrawn` });
    }
    if (asset?.forSaleFlag) await this.prisma.asset.update({ where: { id: so.assetId }, data: { forSaleFlag: false } });
    return this.summaryById(id, user);
  }

  private async getOrThrow(id: string) {
    const so = await this.prisma.saleOrder.findUnique({ where: { id } });
    if (!so) throw new NotFoundException('Sale order not found');
    return so;
  }

  private async summaryById(id: string, user: AuthenticatedUser) {
    const row = await this.prisma.saleOrder.findUniqueOrThrow({ where: { id }, include: { asset: { include: { assetType: true } } } });
    return this.toSummary(row, user);
  }

  private toSummary(
    r: Prisma.SaleOrderGetPayload<{ include: { asset: { include: { assetType: true } } } }>,
    user: AuthenticatedUser,
  ): SaleOrderSummary {
    const salePrice = dec(r.salePrice);
    const bookValue = effectiveBookValue(r.asset);
    const base: SaleOrderSummary = {
      id: r.id,
      refNo: r.refNo,
      assetId: r.assetId,
      assetCode: r.asset.code,
      assetTypeName: r.asset.assetType.name,
      status: r.status as SaleOrderStatus,
      buyerName: r.buyerName,
      proposedBy: r.proposedBy,
      approvedBy: r.approvedBy,
      listedAt: r.listedAt?.toISOString() ?? null,
      soldAt: r.soldAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    };
    if (this.canSeeFinance(user)) {
      base.askingPrice = dec(r.askingPrice);
      base.salePrice = salePrice;
      base.bookValue = bookValue;
      base.profitLoss = salePrice != null && bookValue != null ? Math.round((salePrice - bookValue) * 100) / 100 : null;
    }
    return base;
  }
}
