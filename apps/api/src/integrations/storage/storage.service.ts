import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { Readable } from 'node:stream';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type {
  PlatformStorageSettings, StorageProvider, StorageStatus,
  TenantStorageSettings, UpdatePlatformStorageDto, UpdateTenantStorageDto,
} from '@nx-lam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { currentTenantId } from '../../common/tenant/tenant-context';
import { EntitlementsService } from '../../modules/entitlements/entitlements.service';

const R2_SETTING_KEY = 'integrations.r2';
/** Files that do not belong to any tenant (platform-level health checks etc.). */
const PLATFORM_NS = 'platform';

interface StoredAccount {
  provider?: StorageProvider | null;
  endpoint?: string | null;
  accessKeyId?: string | null;
  secretAccessKey?: string | null;
  bucket?: string | null;
  region?: string | null;
  publicBaseUrl?: string | null;
  ttl?: number | null;
}

interface ResolvedR2 {
  client: S3Client | null;
  provider: StorageProvider | 'LOCAL';
  scope: 'SHARED' | 'DEDICATED' | 'LOCAL';
  source: 'tenant' | 'db' | 'env' | 'none';
  bucket: string;
  ttl: number;
  endpoint: string | null;
  publicBaseUrl: string | null;
}

/** This company's folder prefix inside whichever bucket is effective. */
function tenantPrefix(tenantId: string): string {
  return `tenant_${tenantId}`;
}

/**
 * File storage abstraction (S3-compatible: R2 / S3 / GCS / OSS via endpoint).
 *
 * Resolution order, per request:
 *   1. The tenant's DEDICATED bucket (BYO storage) — enterprise data residency.
 *   2. The platform's SHARED account (DB setting, then .env) — every company gets
 *      an isolated folder `tenant_<id>/…` inside the one platform bucket (default).
 *   3. Local-disk fallback with HMAC-signed short-lived URLs (dev).
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly localDir: string;
  private readonly signSecret: string;
  /** Cache S3 clients by credential signature (supports many tenants at once). */
  private clients = new Map<string, S3Client>();

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
  ) {
    this.signSecret = config.get<string>('JWT_ACCESS_SECRET') ?? 'change-me';
    this.localDir = resolve(config.get<string>('STORAGE_LOCAL_DIR') ?? '.uploads');
  }

  private clientFor(endpoint: string, accessKeyId: string, secretAccessKey: string, region?: string | null): S3Client {
    const sig = `${endpoint}|${accessKeyId}|${secretAccessKey}|${region ?? 'auto'}`;
    let c = this.clients.get(sig);
    if (!c) {
      c = new S3Client({ region: region || 'auto', endpoint, credentials: { accessKeyId, secretAccessKey } });
      this.clients.set(sig, c);
    }
    return c;
  }

  /** Effective storage config for the current request (tenant → platform → env → local). */
  private async resolveR2(): Promise<ResolvedR2> {
    // 1) Tenant's own DEDICATED bucket (BYO storage).
    const tenantId = currentTenantId();
    if (tenantId) {
      const tc = await this.prisma.tenantStorageConfig.findUnique({ where: { tenantId } });
      if (tc?.mode === 'DEDICATED' && tc.endpoint && tc.accessKeyId && tc.secretAccessKey && tc.bucket) {
        return {
          client: this.clientFor(tc.endpoint, tc.accessKeyId, tc.secretAccessKey, tc.region),
          provider: (tc.provider as StorageProvider) ?? 'R2',
          scope: 'DEDICATED',
          source: 'tenant',
          bucket: tc.bucket,
          ttl: tc.ttl ?? 300,
          endpoint: tc.endpoint,
          publicBaseUrl: tc.publicBaseUrl ?? null,
        };
      }
    }

    // 2) Platform SHARED account (DB first, then .env).
    const row = await this.prisma.platformSetting.findUnique({ where: { key: R2_SETTING_KEY } });
    const db = (row?.value as StoredAccount | null) ?? {};
    const envEndpoint = this.config.get<string>('R2_ENDPOINT');
    const envKey = this.config.get<string>('R2_ACCESS_KEY_ID');
    const envSecret = this.config.get<string>('R2_SECRET_ACCESS_KEY');

    const dbComplete = !!(db.endpoint && db.accessKeyId && db.secretAccessKey);
    const envComplete = !!(envEndpoint && envKey && envSecret);
    const source: ResolvedR2['source'] = dbComplete ? 'db' : envComplete ? 'env' : 'none';

    const endpoint = (dbComplete ? db.endpoint : envEndpoint) ?? null;
    const accessKeyId = (dbComplete ? db.accessKeyId : envKey) ?? null;
    const secretAccessKey = (dbComplete ? db.secretAccessKey : envSecret) ?? null;
    const bucket = db.bucket || this.config.get<string>('R2_BUCKET') || 'fleet-assets';
    const ttl = Number(db.ttl || this.config.get<string>('R2_SIGNED_URL_TTL') || 300);
    const publicBaseUrl = db.publicBaseUrl || this.config.get<string>('R2_PUBLIC_BASE_URL') || null;
    const provider = (db.provider as StorageProvider) || 'R2';

    if (source === 'none' || !endpoint || !accessKeyId || !secretAccessKey) {
      return { client: null, provider: 'LOCAL', scope: 'LOCAL', source: 'none', bucket, ttl, endpoint: null, publicBaseUrl };
    }
    return {
      client: this.clientFor(endpoint, accessKeyId, secretAccessKey, db.region),
      provider, scope: 'SHARED', source, bucket, ttl, endpoint, publicBaseUrl,
    };
  }

  /**
   * Build a tenant-namespaced storage key:
   *   tenant_<tenantId>/<module>/<entityId>/<uuid>-<filename>
   * Each company gets an isolated, tidy folder inside whichever bucket is
   * effective (shared platform bucket, or the company's own dedicated bucket).
   * Outside a request (seed, platform jobs) files fall under `platform/`.
   */
  buildKey(prefix: string, fileName: string): string {
    const safe = fileName.replace(/[^\w.\-]+/g, '_');
    const tid = currentTenantId();
    const ns = tid ? tenantPrefix(tid) : PLATFORM_NS;
    const clean = prefix.replace(/^\/+|\/+$/g, '');
    return `${ns}/${clean}/${randomUUID()}-${safe}`;
  }

  /**
   * Defence-in-depth: a request scoped to tenant T may only touch keys under
   * T's folder (or legacy/un-namespaced keys). Cross-tenant keys are denied.
   */
  private assertTenantKey(key: string): void {
    const tenantId = currentTenantId();
    if (!tenantId) return; // platform/public context (e.g. signed local download)
    const first = key.split('/')[0];
    if (first.startsWith('tenant_') && first !== tenantPrefix(tenantId)) {
      throw new ForbiddenException('Cross-tenant file access denied');
    }
  }

  async putObject(key: string, body: Buffer, contentType?: string): Promise<void> {
    this.assertTenantKey(key);
    // SaaS guardrail: block the write if it would exceed the tenant's storage cap.
    if (currentTenantId()) {
      await this.entitlements.assertStorageAvailable(body.length);
    }

    const { client, bucket } = await this.resolveR2();
    if (client) {
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
    } else {
      const path = join(this.localDir, key);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, body);
    }

    // Record in the per-tenant storage ledger (source of truth for usage).
    if (currentTenantId()) {
      await this.entitlements.recordUpload(key, body.length, key.split('/')[1]);
    }
  }

  /** Short-lived URL the browser can open directly (≤ ttl, default 300s). */
  async getSignedUrl(key: string): Promise<string> {
    this.assertTenantKey(key);
    const { client, bucket, ttl } = await this.resolveR2();
    if (client) {
      return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: ttl });
    }
    const exp = Math.floor(Date.now() / 1000) + ttl;
    const sig = this.sign(key, exp);
    const base = this.config.get<string>('API_PUBLIC_URL') ?? '';
    return `${base}/api/storage/local?key=${encodeURIComponent(key)}&exp=${exp}&sig=${sig}`;
  }

  async deleteObject(key: string): Promise<void> {
    this.assertTenantKey(key);
    const { client, bucket } = await this.resolveR2();
    if (client) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    } else {
      const path = join(this.localDir, key);
      if (existsSync(path)) await unlink(path).catch(() => undefined);
    }
    // Free the space in the tenant's storage ledger.
    await this.entitlements.recordDelete(key);
  }

  // ---- effective status (for the current tenant) ----

  async status(): Promise<StorageStatus> {
    const r = await this.resolveR2();
    const tid = currentTenantId();
    return {
      provider: r.client ? r.provider : 'LOCAL',
      source: r.source,
      scope: r.scope,
      bucket: r.bucket,
      endpoint: r.endpoint,
      publicBaseUrl: r.publicBaseUrl,
      ttl: r.ttl,
      folderPrefix: tid ? `${tenantPrefix(tid)}/` : null,
    };
  }

  // ---- Platform shared account (the master account; one for all companies) ----

  async getPlatformStorage(): Promise<PlatformStorageSettings> {
    const row = await this.prisma.platformSetting.findUnique({ where: { key: R2_SETTING_KEY } });
    const db = (row?.value as StoredAccount | null) ?? {};
    return {
      provider: (db.provider as StorageProvider) ?? 'R2',
      endpoint: db.endpoint ?? null,
      accessKeyId: db.accessKeyId ?? null,
      bucket: db.bucket ?? null,
      region: db.region ?? null,
      publicBaseUrl: db.publicBaseUrl ?? null,
      ttl: db.ttl ?? null,
      secretSet: !!db.secretAccessKey,
    };
  }

  /** Upsert the platform account. An empty/omitted secret keeps the existing one. */
  async updatePlatformStorage(dto: UpdatePlatformStorageDto): Promise<PlatformStorageSettings> {
    const row = await this.prisma.platformSetting.findUnique({ where: { key: R2_SETTING_KEY } });
    const current = (row?.value as StoredAccount | null) ?? {};
    const next: StoredAccount = {
      provider: dto.provider ?? current.provider ?? 'R2',
      endpoint: dto.endpoint ?? current.endpoint ?? null,
      accessKeyId: dto.accessKeyId ?? current.accessKeyId ?? null,
      secretAccessKey: dto.secretAccessKey?.trim() ? dto.secretAccessKey.trim() : current.secretAccessKey ?? null,
      bucket: dto.bucket ?? current.bucket ?? null,
      region: dto.region ?? current.region ?? null,
      publicBaseUrl: dto.publicBaseUrl ?? current.publicBaseUrl ?? null,
      ttl: dto.ttl ?? current.ttl ?? null,
    };
    await this.prisma.platformSetting.upsert({
      where: { key: R2_SETTING_KEY },
      create: { key: R2_SETTING_KEY, value: next as object },
      update: { value: next as object },
    });
    this.clients.clear();
    this.logger.log('Platform storage account updated');
    return this.getPlatformStorage();
  }

  /** Round-trip test of the platform account (independent of tenant config). */
  async testPlatform(): Promise<{ ok: boolean; message: string }> {
    const s = await this.getPlatformStorage();
    if (!s.endpoint || !s.accessKeyId || !s.secretSet || !s.bucket) {
      return { ok: false, message: 'Platform account is incomplete (endpoint, key, secret, bucket required).' };
    }
    const row = await this.prisma.platformSetting.findUnique({ where: { key: R2_SETTING_KEY } });
    const db = (row?.value as StoredAccount | null) ?? {};
    const client = this.clientFor(db.endpoint!, db.accessKeyId!, db.secretAccessKey!, db.region);
    return this.roundTrip(client, s.bucket, `${PLATFORM_NS}/healthcheck`);
  }

  // ---- usage reconciliation (Phase 4: nightly correction of the counter) ----

  /**
   * Best-effort: sum the bytes actually stored under `tenant_<id>/` in the
   * platform SHARED bucket via ListObjectsV2. Returns null when no real R2/S3
   * account is configured (dev/local) — caller then falls back to the ledger.
   */
  async listTenantBytes(tenantId: string): Promise<number | null> {
    const row = await this.prisma.platformSetting.findUnique({ where: { key: R2_SETTING_KEY } });
    const db = (row?.value as StoredAccount | null) ?? {};
    if (!db.endpoint || !db.accessKeyId || !db.secretAccessKey || !db.bucket) return null;
    const client = this.clientFor(db.endpoint, db.accessKeyId, db.secretAccessKey, db.region);
    const prefix = `${tenantPrefix(tenantId)}/`;
    let total = 0;
    let token: string | undefined;
    do {
      const res = await client.send(new ListObjectsV2Command({ Bucket: db.bucket, Prefix: prefix, ContinuationToken: token }));
      for (const o of res.Contents ?? []) total += o.Size ?? 0;
      token = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (token);
    return total;
  }

  /**
   * Reconcile every tenant's usage snapshot (TenantUsage): storage bytes from the
   * actual bucket (ListObjectsV2) when R2 is live, else from the storage ledger;
   * seats from active users. Runs out-of-context (platform job) so all queries
   * pass tenantId explicitly. Returns a summary for logging/UI.
   */
  async reconcileAll(): Promise<{ tenants: number; fromBucket: number; fromLedger: number }> {
    const tenants = await this.prisma.tenant.findMany({ select: { id: true } });
    let fromBucket = 0;
    let fromLedger = 0;
    for (const t of tenants) {
      let bytes = await this.listTenantBytes(t.id).catch(() => null);
      if (bytes != null) {
        fromBucket += 1;
      } else {
        const agg = await this.prisma.storageObject.aggregate({ _sum: { sizeBytes: true }, where: { tenantId: t.id } });
        bytes = Number(agg._sum.sizeBytes ?? BigInt(0));
        fromLedger += 1;
      }
      const seatsUsed = await this.prisma.user.count({ where: { tenantId: t.id, deletedAt: null, isActive: true } });
      await this.prisma.tenantUsage.upsert({
        where: { tenantId: t.id },
        create: { tenantId: t.id, seatsUsed, storageBytes: BigInt(bytes) },
        update: { seatsUsed, storageBytes: BigInt(bytes) },
      });
    }
    this.logger.log(`Usage reconcile: ${tenants.length} tenants (bucket=${fromBucket}, ledger=${fromLedger})`);
    return { tenants: tenants.length, fromBucket, fromLedger };
  }

  // ---- This company's storage option (folder, or its own dedicated bucket) ----

  async getTenantStorage(): Promise<TenantStorageSettings> {
    const tid = currentTenantId();
    const tc = tid ? await this.prisma.tenantStorageConfig.findUnique({ where: { tenantId: tid } }) : null;
    return {
      mode: (tc?.mode as TenantStorageSettings['mode']) ?? 'SHARED',
      provider: (tc?.provider as StorageProvider) ?? 'R2',
      endpoint: tc?.endpoint ?? null,
      accessKeyId: tc?.accessKeyId ?? null,
      bucket: tc?.bucket ?? null,
      region: tc?.region ?? null,
      publicBaseUrl: tc?.publicBaseUrl ?? null,
      ttl: tc?.ttl ?? null,
      secretSet: !!tc?.secretAccessKey,
      folderPrefix: tid ? `${tenantPrefix(tid)}/` : '',
    };
  }

  async updateTenantStorage(dto: UpdateTenantStorageDto): Promise<TenantStorageSettings> {
    const tid = currentTenantId();
    if (!tid) throw new ForbiddenException('No tenant context');
    const current = await this.prisma.tenantStorageConfig.findUnique({ where: { tenantId: tid } });
    const data = {
      mode: dto.mode ?? current?.mode ?? 'SHARED',
      provider: dto.provider ?? current?.provider ?? 'R2',
      endpoint: dto.endpoint ?? current?.endpoint ?? null,
      accessKeyId: dto.accessKeyId ?? current?.accessKeyId ?? null,
      secretAccessKey: dto.secretAccessKey?.trim() ? dto.secretAccessKey.trim() : current?.secretAccessKey ?? null,
      bucket: dto.bucket ?? current?.bucket ?? null,
      region: dto.region ?? current?.region ?? null,
      publicBaseUrl: dto.publicBaseUrl ?? current?.publicBaseUrl ?? null,
      ttl: dto.ttl ?? current?.ttl ?? null,
    };
    await this.prisma.tenantStorageConfig.upsert({
      where: { tenantId: tid },
      create: { tenantId: tid, ...data },
      update: data,
    });
    this.clients.clear();
    this.logger.log(`Tenant storage config updated (${data.mode})`);
    return this.getTenantStorage();
  }

  /** Round-trip test of THIS company's dedicated bucket. */
  async testTenant(): Promise<{ ok: boolean; message: string }> {
    const tid = currentTenantId();
    if (!tid) return { ok: false, message: 'No tenant context.' };
    const tc = await this.prisma.tenantStorageConfig.findUnique({ where: { tenantId: tid } });
    if (tc?.mode !== 'DEDICATED' || !tc.endpoint || !tc.accessKeyId || !tc.secretAccessKey || !tc.bucket) {
      return { ok: false, message: 'Configure a complete dedicated bucket first.' };
    }
    const client = this.clientFor(tc.endpoint, tc.accessKeyId, tc.secretAccessKey, tc.region);
    return this.roundTrip(client, tc.bucket, `${tenantPrefix(tid)}/healthcheck`);
  }

  private async roundTrip(client: S3Client, bucket: string, prefix: string): Promise<{ ok: boolean; message: string }> {
    const key = `${prefix}/${randomUUID()}.txt`;
    try {
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: Buffer.from('ok'), ContentType: 'text/plain' }));
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      return { ok: true, message: `Connected to bucket "${bucket}".` };
    } catch (err) {
      return { ok: false, message: (err as Error).message };
    }
  }

  // ---- local-only helpers (used by StorageController) ----

  sign(key: string, exp: number): string {
    return createHmac('sha256', this.signSecret).update(`${key}:${exp}`).digest('hex');
  }

  verify(key: string, exp: number, sig: string): boolean {
    if (Number.isNaN(exp) || exp < Math.floor(Date.now() / 1000)) return false;
    return this.sign(key, exp) === sig;
  }

  openLocal(key: string): Readable {
    const path = join(this.localDir, key);
    if (!existsSync(path)) throw new NotFoundException('File not found');
    return createReadStream(path);
  }
}
