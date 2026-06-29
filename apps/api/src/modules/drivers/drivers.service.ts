import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { DriverSummary } from '@nx-lam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDriverDto, UpdateDriverDto } from './drivers.controller';

@Injectable()
export class DriversService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<DriverSummary[]> {
    const rows = await this.prisma.driver.findMany({
      where: { deletedAt: null },
      orderBy: { fullName: 'asc' },
      include: { vehicles: { include: { asset: { select: { code: true } } }, take: 1 } },
    });
    return rows.map((d) => ({
      id: d.id,
      fullName: d.fullName,
      iqamaNumber: d.iqamaNumber,
      licenseExpiry: d.licenseExpiry?.toISOString() ?? null,
      iqamaExpiry: d.iqamaExpiry?.toISOString() ?? null,
      isActive: d.isActive,
      assignedVehicleCode: d.vehicles[0]?.asset.code ?? null,
      createdAt: d.createdAt.toISOString(),
    }));
  }

  async create(dto: CreateDriverDto) {
    return this.prisma.driver.create({
      data: {
        fullName: dto.fullName.trim(),
        iqamaNumber: dto.iqamaNumber?.trim() || null,
        licenseExpiry: dto.licenseExpiry ? new Date(dto.licenseExpiry) : null,
        iqamaExpiry: dto.iqamaExpiry ? new Date(dto.iqamaExpiry) : null,
      },
    });
  }

  async update(id: string, dto: UpdateDriverDto) {
    await this.ensure(id);
    return this.prisma.driver.update({
      where: { id },
      data: {
        ...(dto.fullName !== undefined ? { fullName: dto.fullName.trim() } : {}),
        ...(dto.iqamaNumber !== undefined ? { iqamaNumber: dto.iqamaNumber?.trim() || null } : {}),
        ...(dto.licenseExpiry !== undefined ? { licenseExpiry: dto.licenseExpiry ? new Date(dto.licenseExpiry) : null } : {}),
        ...(dto.iqamaExpiry !== undefined ? { iqamaExpiry: dto.iqamaExpiry ? new Date(dto.iqamaExpiry) : null } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async remove(id: string): Promise<{ id: string }> {
    await this.ensure(id);
    await this.prisma.driver.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
    return { id };
  }

  /** Assign (or unassign) a driver to a vehicle. A driver holds at most one vehicle. */
  async assignVehicle(driverId: string, assetId: string | null): Promise<DriverSummary> {
    const driver = await this.ensure(driverId);
    if (!driver.isActive && assetId) throw new BadRequestException('Inactive drivers cannot be assigned');

    // release whatever this driver currently holds
    await this.prisma.vehicleDetail.updateMany({ where: { currentDriverId: driverId }, data: { currentDriverId: null } });

    if (assetId) {
      const vehicle = await this.prisma.vehicleDetail.findUnique({ where: { assetId } });
      if (!vehicle) throw new BadRequestException('Selected asset is not a registered vehicle');
      // assigning replaces any previous driver on that vehicle
      await this.prisma.vehicleDetail.update({ where: { assetId }, data: { currentDriverId: driverId } });
    }

    const updated = (await this.list()).find((d) => d.id === driverId);
    if (!updated) throw new NotFoundException('Driver not found');
    return updated;
  }

  /** Vehicles (assets with a plate) for the assignment picker, with current holder. */
  async assignableVehicles(): Promise<{ assetId: string; code: string; plateNumber: string | null; currentDriverId: string | null; currentDriverName: string | null }[]> {
    const rows = await this.prisma.vehicleDetail.findMany({
      where: { asset: { deletedAt: null } },
      include: { asset: { select: { code: true } }, currentDriver: { select: { id: true, fullName: true } } },
      orderBy: { asset: { code: 'asc' } },
    });
    return rows.map((v) => ({
      assetId: v.assetId,
      code: v.asset.code,
      plateNumber: v.plateNumber,
      currentDriverId: v.currentDriver?.id ?? null,
      currentDriverName: v.currentDriver?.fullName ?? null,
    }));
  }

  private async ensure(id: string) {
    const d = await this.prisma.driver.findFirst({ where: { id, deletedAt: null } });
    if (!d) throw new NotFoundException('Driver not found');
    return d;
  }
}
