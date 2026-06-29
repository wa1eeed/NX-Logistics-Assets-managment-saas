import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';

const DEFAULT_INTERVAL_MS = 24 * 60 * 60 * 1000; // daily

/**
 * Nightly storage-usage reconciliation (Phase 4). Recomputes every tenant's
 * TenantUsage snapshot from the real bucket (ListObjectsV2) when R2 is live, else
 * from the storage ledger — correcting any drift in the counter. Self-contained
 * (no extra deps); also triggerable manually via POST /storage/reconcile.
 */
@Injectable()
export class StorageReconcileScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StorageReconcileScheduler.name);
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    const interval = Number(this.config.get<string>('STORAGE_RECONCILE_INTERVAL_MS')) || DEFAULT_INTERVAL_MS;
    this.timer = setInterval(() => {
      void this.storage.reconcileAll().catch((e) => this.logger.error(`Reconcile failed: ${(e as Error).message}`));
    }, interval);
    this.logger.log(`Storage reconcile scheduler started (every ${Math.round(interval / 3600000)}h).`);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
