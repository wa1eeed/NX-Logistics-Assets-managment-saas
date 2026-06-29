// ============================================================
// Storage model — how each tenant's files are stored.
//
// Pattern used by most B2B SaaS (and our default):
//   SHARED  — one platform-owned, S3-compatible account; every company gets an
//             isolated folder: bucket/tenant_<tenantId>/<module>/<file>.
// Enterprise option (data residency / sovereignty / "bring your own bucket"):
//   DEDICATED — the company plugs in its OWN bucket + credentials; the platform
//               writes that company's files to it. Resolved per-tenant at runtime.
//
// The driver is S3-compatible, so the same code targets Cloudflare R2, AWS S3,
// Google Cloud Storage (S3 interop) or Alibaba OSS by changing the endpoint.
// ============================================================

export type StorageMode = 'SHARED' | 'DEDICATED';

export const STORAGE_MODES: StorageMode[] = ['SHARED', 'DEDICATED'];

export type StorageProvider = 'R2' | 'S3' | 'GCS' | 'OSS';

export const STORAGE_PROVIDERS: StorageProvider[] = ['R2', 'S3', 'GCS', 'OSS'];

export const STORAGE_PROVIDER_LABELS: Record<StorageProvider, string> = {
  R2: 'Cloudflare R2',
  S3: 'Amazon S3',
  GCS: 'Google Cloud Storage',
  OSS: 'Alibaba OSS',
};

/** Platform shared account config (the master account; secret never exposed). */
export interface PlatformStorageSettings {
  provider: StorageProvider;
  endpoint: string | null;
  accessKeyId: string | null;
  bucket: string | null;
  region: string | null;
  publicBaseUrl: string | null;
  ttl: number | null;
  secretSet: boolean;
}

/** A single tenant's storage option (their folder, or their own dedicated bucket). */
export interface TenantStorageSettings {
  mode: StorageMode;
  provider: StorageProvider;
  endpoint: string | null;
  accessKeyId: string | null;
  bucket: string | null;
  region: string | null;
  publicBaseUrl: string | null;
  ttl: number | null;
  secretSet: boolean;
  /** This company's folder inside whichever bucket is effective, e.g. tenant_<id>/ */
  folderPrefix: string;
}

export interface UpdatePlatformStorageDto {
  provider?: StorageProvider;
  endpoint?: string | null;
  accessKeyId?: string | null;
  secretAccessKey?: string;
  bucket?: string | null;
  region?: string | null;
  publicBaseUrl?: string | null;
  ttl?: number | null;
}

export interface UpdateTenantStorageDto {
  mode?: StorageMode;
  provider?: StorageProvider;
  endpoint?: string | null;
  accessKeyId?: string | null;
  secretAccessKey?: string;
  bucket?: string | null;
  region?: string | null;
  publicBaseUrl?: string | null;
  ttl?: number | null;
}
