import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AssetStatus, OwnershipType, canTransition } from '@nx-lam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

interface ChangeOpts {
  forSaleFlag?: boolean;
  reason?: string;
  ip?: string | null;
}

/**
 * Central guardian of Asset.status. Status is never written directly elsewhere —
 * every change flows through here, validating the state machine + ownership rules
 * and recording an append-only STATUS_CHANGE audit entry.
 */
@Injectable()
export class AssetStatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async changeStatus(assetId: string, to: AssetStatus, actorId: string | null, opts: ChangeOpts = {}) {
    const asset = await this.prisma.asset.findFirst({ where: { id: assetId, deletedAt: null } });
    if (!asset) throw new NotFoundException('Asset not found');

    const from = asset.status as AssetStatus;
    if (from === to) {
      throw new BadRequestException(`Asset is already ${to}`);
    }
    if (!canTransition(from, to)) {
      throw new BadRequestException(`Illegal transition: ${from} → ${to}`);
    }

    // Ownership rules: only OWNED assets can be put up for sale; an
    // EXTERNALLY_RENTED asset leaves the fleet via "return to lessor" (DISPOSED).
    if (to === AssetStatus.FOR_SALE && asset.ownershipType !== OwnershipType.OWNED) {
      throw new BadRequestException('Only owned assets can be listed for sale');
    }
    if (to === AssetStatus.DISPOSED && from === AssetStatus.AVAILABLE && asset.ownershipType !== OwnershipType.EXTERNALLY_RENTED) {
      throw new BadRequestException('Owned assets are disposed via the sale flow (FOR_SALE → DISPOSED)');
    }

    const updated = await this.prisma.asset.update({
      where: { id: assetId },
      data: {
        status: to,
        ...(opts.forSaleFlag !== undefined ? { forSaleFlag: opts.forSaleFlag } : {}),
      },
    });

    await this.audit.record({
      actorId,
      action: 'STATUS_CHANGE',
      entityType: 'Asset',
      entityId: assetId,
      before: { status: from, forSaleFlag: asset.forSaleFlag },
      after: { status: to, forSaleFlag: updated.forSaleFlag, reason: opts.reason ?? null },
      ip: opts.ip ?? null,
    });

    return updated;
  }
}
