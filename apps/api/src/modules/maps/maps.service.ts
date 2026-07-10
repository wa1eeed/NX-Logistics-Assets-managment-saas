import { Injectable, Logger } from '@nestjs/common';
import {
  MAPS_SETTING_KEY,
  type MapsGatewaySettings,
  type MapsRuntime,
  type UpdateMapsGatewayDto,
} from '@nx-lam/shared';
import { PrismaService } from '../../prisma/prisma.service';

interface StoredMapsConfig {
  enabled: boolean;
  apiKey: string | null;
}

/**
 * Google Maps provider config — a single platform-level API key stored in
 * `PlatformSetting` (edited by the platform operator), falling back to the
 * `GOOGLE_MAPS_API_KEY` env var. The runtime key is public by design (Maps JS
 * loads it in the browser), so `runtime()` returns it to authenticated clients;
 * the admin view only reports whether a key is set.
 */
@Injectable()
export class MapsService {
  private readonly logger = new Logger(MapsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async raw(): Promise<StoredMapsConfig> {
    const row = await this.prisma.platformSetting.findUnique({ where: { key: MAPS_SETTING_KEY } });
    const v = (row?.value ?? {}) as Partial<StoredMapsConfig>;
    const envKey = process.env.GOOGLE_MAPS_API_KEY?.trim() || null;
    const apiKey = (v.apiKey ?? envKey) || null;
    // Honor an explicit DB flag; otherwise default to enabled whenever a key exists.
    const enabled = v.enabled ?? !!apiKey;
    return { enabled, apiKey };
  }

  /** Admin view — the key value is masked (only whether one is set). */
  async getSettings(): Promise<MapsGatewaySettings> {
    const c = await this.raw();
    return { enabled: c.enabled, apiKeySet: !!c.apiKey };
  }

  /** Upsert the config. An empty/omitted apiKey keeps the stored one. */
  async updateSettings(dto: UpdateMapsGatewayDto): Promise<MapsGatewaySettings> {
    const current = await this.raw();
    const next: StoredMapsConfig = {
      enabled: dto.enabled ?? current.enabled,
      apiKey: dto.apiKey?.trim() ? dto.apiKey.trim() : current.apiKey,
    };
    await this.prisma.platformSetting.upsert({
      where: { key: MAPS_SETTING_KEY },
      create: { key: MAPS_SETTING_KEY, value: next as object },
      update: { value: next as object },
    });
    this.logger.log(`Maps provider updated (enabled=${next.enabled}, keySet=${!!next.apiKey})`);
    return { enabled: next.enabled, apiKeySet: !!next.apiKey };
  }

  /** What the web needs to boot Google Maps — key only when enabled AND set. */
  async runtime(): Promise<MapsRuntime> {
    const c = await this.raw();
    return { apiKey: c.enabled && c.apiKey ? c.apiKey : null };
  }
}
