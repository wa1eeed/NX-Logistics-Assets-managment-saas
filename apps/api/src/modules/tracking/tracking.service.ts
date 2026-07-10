import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type {
  ConsoleVehicle, ConsoleTask, GeofenceDto, GeofenceEventDto, TrackedAssetDto, TrackingConsole, TrackingDeviceDto, TrackingProvider, TrackingStatusDto,
} from '@nx-lam/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { currentTenantId, tenantContext } from '../../common/tenant/tenant-context';
import { isInsideGeofence } from './geofence-detect';

const DEFAULT_PER_VEHICLE = 15;

/**
 * Vehicle tracking. Enablement is gated by an active TrackingAddon (from a plan
 * or a standalone per-vehicle purchase). Location source is abstracted; the
 * hardware ingest endpoint is authenticated by a per-device HMAC signature.
 */
@Injectable()
export class TrackingService {
  constructor(private readonly prisma: PrismaService) {}

  private requireTenant(): string {
    const id = currentTenantId();
    if (!id) throw new ForbiddenException('No tenant context');
    return id;
  }

  /** True when the tenant has an active tracking add-on (plan or standalone). */
  async isEnabled(tenantId?: string): Promise<boolean> {
    const id = tenantId ?? currentTenantId();
    if (!id) return false;
    const addon = await this.prisma.trackingAddon.findUnique({ where: { tenantId: id } });
    return !!addon && addon.status === 'ACTIVE' && addon.vehicleQuota > 0;
  }

  async status(): Promise<TrackingStatusDto> {
    const tenantId = this.requireTenant();
    const [addon, trackedCount, deviceCount] = await Promise.all([
      this.prisma.trackingAddon.findUnique({ where: { tenantId } }),
      this.prisma.asset.count({ where: { trackingEnabled: true, deletedAt: null } }),
      this.prisma.trackingDevice.count(),
    ]);
    return {
      enabled: !!addon && addon.status === 'ACTIVE' && addon.vehicleQuota > 0,
      source: addon?.source ?? null,
      vehicleQuota: addon?.vehicleQuota ?? 0,
      trackedCount,
      perVehiclePrice: addon?.perVehiclePrice != null ? Number(addon.perVehiclePrice) : null,
      deviceCount,
    };
  }

  /** Activate/extend the add-on (called after a confirmed TRACKING payment, or by a plan). */
  async activateAddon(tenantId: string, addQuota: number, perVehiclePrice: number | null, source: 'ADDON' | 'PLAN' = 'ADDON'): Promise<void> {
    const existing = await this.prisma.trackingAddon.findUnique({ where: { tenantId } });
    const quota = (existing?.vehicleQuota ?? 0) + Math.max(0, addQuota);
    const nextSource = existing && existing.source !== source ? 'BOTH' : source;
    await this.prisma.trackingAddon.upsert({
      where: { tenantId },
      create: { tenantId, source, vehicleQuota: quota, perVehiclePrice, status: 'ACTIVE', activatedAt: new Date() },
      update: { vehicleQuota: quota, status: 'ACTIVE', source: nextSource, ...(perVehiclePrice != null ? { perVehiclePrice } : {}), activatedAt: existing?.activatedAt ?? new Date() },
    });
  }

  // ---- per-asset enablement (respects quota) ----

  async enableAsset(assetId: string): Promise<{ assetId: string; trackingEnabled: boolean }> {
    const tenantId = this.requireTenant();
    if (!(await this.isEnabled(tenantId))) throw new ForbiddenException('Tracking is not active for your subscription');
    const asset = await this.prisma.asset.findFirst({ where: { id: assetId, deletedAt: null } });
    if (!asset) throw new NotFoundException('Asset not found');
    if (!asset.trackingEnabled) {
      const addon = await this.prisma.trackingAddon.findUnique({ where: { tenantId } });
      const used = await this.prisma.asset.count({ where: { trackingEnabled: true, deletedAt: null } });
      if (used >= (addon?.vehicleQuota ?? 0)) {
        throw new ForbiddenException(`Tracking quota reached (${addon?.vehicleQuota ?? 0}). Buy more vehicle slots.`);
      }
    }
    await this.prisma.asset.update({ where: { id: assetId }, data: { trackingEnabled: true } });
    return { assetId, trackingEnabled: true };
  }

  async disableAsset(assetId: string): Promise<{ assetId: string; trackingEnabled: boolean }> {
    this.requireTenant();
    await this.prisma.asset.updateMany({ where: { id: assetId }, data: { trackingEnabled: false } });
    return { assetId, trackingEnabled: false };
  }

  // ---- devices ----

  async registerDevice(dto: { assetId: string; provider?: TrackingProvider; externalId: string }): Promise<TrackingDeviceDto & { signingKey: string }> {
    const tenantId = this.requireTenant();
    const asset = await this.prisma.asset.findFirst({ where: { id: dto.assetId, deletedAt: null } });
    if (!asset) throw new NotFoundException('Asset not found');
    const dupe = await this.prisma.trackingDevice.findUnique({ where: { externalId: dto.externalId } });
    if (dupe) throw new BadRequestException('A device with this external id already exists');
    // Registering a device puts the asset under tracking (respecting the quota).
    if (!asset.trackingEnabled) await this.enableAsset(dto.assetId);
    const signingKey = randomBytes(24).toString('hex');
    const d = await this.prisma.trackingDevice.create({
      data: { tenantId, assetId: dto.assetId, provider: dto.provider ?? 'HARDWARE', externalId: dto.externalId, signingKey },
    });
    return { ...this.toDevice(d, asset.code), signingKey };
  }

  async listDevices(): Promise<TrackingDeviceDto[]> {
    this.requireTenant();
    const devices = await this.prisma.trackingDevice.findMany({ orderBy: { createdAt: 'desc' } });
    const assetIds = [...new Set(devices.map((d) => d.assetId))];
    const assets = await this.prisma.asset.findMany({ where: { id: { in: assetIds } }, select: { id: true, code: true } });
    const codeById = new Map(assets.map((a) => [a.id, a.code]));
    return devices.map((d) => this.toDevice(d, codeById.get(d.assetId) ?? null));
  }

  // ---- live locations ----

  async trackedAssets(): Promise<TrackedAssetDto[]> {
    this.requireTenant();
    const assets = await this.prisma.asset.findMany({
      where: { trackingEnabled: true, deletedAt: null },
      select: { id: true, code: true, manufacturer: true, model: true },
      take: 500,
    });
    const out: TrackedAssetDto[] = [];
    for (const a of assets) {
      const last = await this.prisma.locationPing.findFirst({ where: { assetId: a.id }, orderBy: { recordedAt: 'desc' } });
      out.push({
        assetId: a.id, code: a.code, name: [a.manufacturer, a.model].filter(Boolean).join(' ') || a.code,
        lastLat: last?.lat ?? null, lastLng: last?.lng ?? null, speed: last?.speed ?? null,
        lastSeenAt: last?.recordedAt ? last.recordedAt.toISOString() : null,
      });
    }
    return out;
  }

  // ---- live operations console (drivers ↔ tasks ↔ map) ----

  async consoleData(): Promise<TrackingConsole> {
    this.requireTenant();
    const [vehicles, contracts, requests] = await Promise.all([
      // The GPS unit lives on the asset → the *vehicle* is the tracked entity.
      this.prisma.asset.findMany({
        where: { trackingEnabled: true, deletedAt: null },
        select: {
          id: true, code: true, manufacturer: true, model: true, region: true,
          vehicle: { select: { currentDriver: { select: { fullName: true } } } },
        },
        take: 500,
      }),
      this.prisma.rentalContract.findMany({
        where: { status: { in: ['ACTIVE', 'EXTENDED'] } },
        include: { asset: { select: { id: true, code: true, region: true } }, orgUnit: { select: { name: true } } },
        take: 300,
      }),
      this.prisma.equipmentRequest.findMany({
        where: { status: 'PENDING' },
        include: { orgUnit: { select: { name: true } } },
        orderBy: { createdAt: 'desc' }, take: 300,
      }),
    ]);

    // Resolve requested asset-type names for pending requests.
    const typeIds = [...new Set(requests.map((r) => r.assetTypeId))];
    const types = typeIds.length
      ? await this.prisma.assetType.findMany({ where: { id: { in: typeIds } }, select: { id: true, name: true } })
      : [];
    const typeName = new Map(types.map((t) => [t.id, t.name]));
    // Reserved-asset codes for pending requests that already have one earmarked.
    const reservedIds = [...new Set(requests.map((r) => r.reservedAssetId).filter(Boolean) as string[])];
    const reserved = reservedIds.length
      ? await this.prisma.asset.findMany({ where: { id: { in: reservedIds } }, select: { id: true, code: true, region: true } })
      : [];
    const reservedCode = new Map(reserved.map((a) => [a.id, a.code]));
    const reservedRegion = new Map(reserved.map((a) => [a.id, a.region]));

    // Latest ping per asset (single query → reduce to first-per-asset).
    const assetIds = [...new Set([
      ...vehicles.map((v) => v.id),
      ...contracts.map((c) => c.assetId),
    ])];
    const last = new Map<string, { lat: number; lng: number; recordedAt: Date }>();
    if (assetIds.length) {
      const pings = await this.prisma.locationPing.findMany({ where: { assetId: { in: assetIds } }, orderBy: { recordedAt: 'desc' } });
      for (const p of pings) if (!last.has(p.assetId)) last.set(p.assetId, { lat: p.lat, lng: p.lng, recordedAt: p.recordedAt });
    }
    const ageMin = (d: Date) => (Date.now() - d.getTime()) / 60000;

    // asset → active contract (project) and asset → driver name (so tasks can show the driver too).
    const contractByAsset = new Map(contracts.map((c) => [c.assetId, c]));
    const driverByAsset = new Map<string, string>();
    for (const v of vehicles) if (v.vehicle?.currentDriver) driverByAsset.set(v.id, v.vehicle.currentDriver.fullName);

    const vehicleDtos: ConsoleVehicle[] = vehicles.map((v) => {
      const p = last.get(v.id);
      const online = !!p && ageMin(p.recordedAt) <= 15;
      const contract = contractByAsset.get(v.id) ?? null;
      // ACTIVE = connected + on a mission · AVAILABLE = connected + free · OFFLINE = no recent ping.
      const status: ConsoleVehicle['status'] = !online ? 'OFFLINE' : contract ? 'ACTIVE' : 'AVAILABLE';
      return {
        id: v.id, code: v.code,
        name: [v.manufacturer, v.model].filter(Boolean).join(' ') || v.code,
        region: v.region ?? null,
        driverName: v.vehicle?.currentDriver?.fullName ?? null,
        projectName: contract?.orgUnit.name ?? null,
        taskRef: contract?.authorizationNo ?? null,
        since: contract?.startDate.toISOString() ?? null,
        lat: online ? p!.lat : null,
        lng: online ? p!.lng : null,
        lastSeenAt: p ? p.recordedAt.toISOString() : null,
        status,
      };
    });

    const activeTasks: ConsoleTask[] = contracts.map((c) => {
      const p = last.get(c.assetId);
      return {
        id: c.id, kind: 'ACTIVE', ref: c.authorizationNo, title: c.asset.code, subtitle: c.orgUnit.name,
        region: c.asset.region ?? null,
        projectName: c.orgUnit.name, assetCode: c.asset.code, driverName: driverByAsset.get(c.assetId) ?? null, itemLabel: null,
        lat: p?.lat ?? null, lng: p?.lng ?? null, date: c.startDate.toISOString(),
      };
    });
    const pendingTasks: ConsoleTask[] = requests.map((r) => ({
      id: r.id, kind: 'PENDING', ref: r.refNo ?? r.id.slice(0, 6).toUpperCase(),
      title: r.orgUnit.name, subtitle: typeName.get(r.assetTypeId) ?? null,
      region: r.reservedAssetId ? reservedRegion.get(r.reservedAssetId) ?? null : null,
      projectName: r.orgUnit.name, assetCode: r.reservedAssetId ? reservedCode.get(r.reservedAssetId) ?? null : null,
      driverName: null, itemLabel: typeName.get(r.assetTypeId) ?? null,
      lat: null, lng: null, date: r.createdAt.toISOString(),
    }));

    return { vehicles: vehicleDtos, tasks: [...pendingTasks, ...activeTasks] };
  }

  // ---- geofences ----

  async listGeofences(): Promise<GeofenceDto[]> {
    this.requireTenant();
    const rows = await this.prisma.geofence.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map((g) => ({ id: g.id, name: g.name, type: g.type as GeofenceDto['type'], geo: g.geo as Record<string, unknown>, isActive: g.isActive }));
  }

  async createGeofence(dto: { name: string; type?: string; geo: Record<string, unknown> }): Promise<GeofenceDto> {
    this.requireTenant();
    const g = await this.prisma.geofence.create({ data: { name: dto.name, type: dto.type ?? 'CIRCLE', geo: dto.geo as Prisma.InputJsonValue } });
    return { id: g.id, name: g.name, type: g.type as GeofenceDto['type'], geo: g.geo as Record<string, unknown>, isActive: g.isActive };
  }

  async deleteGeofence(id: string): Promise<{ id: string }> {
    this.requireTenant();
    await this.prisma.geofence.deleteMany({ where: { id } });
    return { id };
  }

  /** Recent enter/exit events (newest first), enriched with asset code + zone name. */
  async listGeofenceEvents(limit = 100): Promise<GeofenceEventDto[]> {
    this.requireTenant();
    const rows = await this.prisma.geofenceEvent.findMany({ orderBy: { at: 'desc' }, take: Math.min(Math.max(limit, 1), 500) });
    if (rows.length === 0) return [];
    const assetIds = [...new Set(rows.map((r) => r.assetId))];
    const fenceIds = [...new Set(rows.map((r) => r.geofenceId))];
    const [assets, fences] = await Promise.all([
      this.prisma.asset.findMany({ where: { id: { in: assetIds } }, select: { id: true, code: true } }),
      this.prisma.geofence.findMany({ where: { id: { in: fenceIds } }, select: { id: true, name: true } }),
    ]);
    const assetCode = new Map(assets.map((a) => [a.id, a.code]));
    const fenceName = new Map(fences.map((f) => [f.id, f.name]));
    return rows.map((r) => ({
      id: r.id, assetId: r.assetId, assetCode: assetCode.get(r.assetId) ?? null,
      geofenceId: r.geofenceId, geofenceName: fenceName.get(r.geofenceId) ?? null,
      type: r.type as 'ENTER' | 'EXIT', lat: r.lat, lng: r.lng, at: r.at.toISOString(),
    }));
  }

  /**
   * Detect zone enter/exit for a single ping and record GeofenceEvents. MUST run
   * inside the device's tenant context (so geofences/asset/events are scoped).
   * Compares the fences the point is now inside against the asset's stored set.
   */
  private async detectZoneTransitions(assetId: string, lat: number, lng: number, at: Date): Promise<void> {
    const fences = await this.prisma.geofence.findMany({ where: { isActive: true }, select: { id: true, type: true, geo: true } });
    if (fences.length === 0) return;
    const inside = fences.filter((f) => isInsideGeofence(f.type, f.geo as Record<string, unknown>, lat, lng)).map((f) => f.id);
    const asset = await this.prisma.asset.findFirst({ where: { id: assetId }, select: { geoZoneIds: true } });
    if (!asset) return;
    const prev = Array.isArray(asset.geoZoneIds) ? (asset.geoZoneIds as string[]) : [];
    const entered = inside.filter((id) => !prev.includes(id));
    const exited = prev.filter((id) => !inside.includes(id));
    if (entered.length === 0 && exited.length === 0) return;
    const events = [
      ...entered.map((geofenceId) => ({ assetId, geofenceId, type: 'ENTER', lat, lng, at })),
      ...exited.map((geofenceId) => ({ assetId, geofenceId, type: 'EXIT', lat, lng, at })),
    ];
    await this.prisma.geofenceEvent.createMany({ data: events });
    await this.prisma.asset.updateMany({ where: { id: assetId }, data: { geoZoneIds: inside as Prisma.InputJsonValue } });
  }

  // ---- ingest (PUBLIC; authenticated by per-device HMAC) ----

  /**
   * Ingest a location ping. Signature = HMAC-SHA256(signingKey, canonical) where
   * canonical = `${externalId}|${lat}|${lng}|${recordedAt}`. Runs without tenant
   * context (device → tenant resolved from the matched device).
   */
  async ingest(body: { externalId: string; lat: number; lng: number; speed?: number; heading?: number; recordedAt?: string }, signature: string): Promise<{ ok: true }> {
    const device = await this.prisma.trackingDevice.findUnique({ where: { externalId: body.externalId } });
    if (!device || device.status !== 'ACTIVE') throw new UnauthorizedException('Unknown or inactive device');
    const recordedAt = body.recordedAt ?? new Date().toISOString();
    const canonical = `${body.externalId}|${body.lat}|${body.lng}|${recordedAt}`;
    const expected = createHmac('sha256', device.signingKey).update(canonical).digest('hex');
    if (!this.safeEqual(expected, signature)) throw new UnauthorizedException('Invalid signature');

    await this.prisma.locationPing.create({
      data: {
        tenantId: device.tenantId, assetId: device.assetId, deviceId: device.id,
        lat: body.lat, lng: body.lng, speed: body.speed ?? null, heading: body.heading ?? null,
        source: device.provider, recordedAt: new Date(recordedAt),
      },
    });
    await this.prisma.trackingDevice.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });
    // Zone enter/exit detection — scoped to the device's tenant, and never allowed
    // to fail the ingest (the ping is already recorded).
    if (device.tenantId) {
      try {
        await tenantContext.run({ tenantId: device.tenantId }, () =>
          this.detectZoneTransitions(device.assetId, body.lat, body.lng, new Date(recordedAt)),
        );
      } catch { /* swallow — detection is a side-effect */ }
    }
    return { ok: true };
  }

  private safeEqual(a: string, b: string): boolean {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    return ab.length === bb.length && timingSafeEqual(ab, bb);
  }

  private toDevice(d: { id: string; assetId: string; provider: string; externalId: string; status: string; lastSeenAt: Date | null }, assetCode: string | null): TrackingDeviceDto {
    return {
      id: d.id, assetId: d.assetId, assetCode, provider: d.provider as TrackingProvider,
      externalId: d.externalId, status: d.status, lastSeenAt: d.lastSeenAt ? d.lastSeenAt.toISOString() : null,
    };
  }
}
