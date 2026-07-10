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
  routingApiKey: string | null;
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
    const routingApiKey = (v.routingApiKey ?? process.env.OPENROUTESERVICE_API_KEY?.trim() ?? null) || null;
    // Honor an explicit DB flag; otherwise default to enabled whenever a key exists.
    const enabled = v.enabled ?? !!apiKey;
    return { enabled, apiKey, routingApiKey };
  }

  /** Admin view — key values are masked (only whether each is set). */
  async getSettings(): Promise<MapsGatewaySettings> {
    const c = await this.raw();
    return { enabled: c.enabled, apiKeySet: !!c.apiKey, routingKeySet: !!c.routingApiKey };
  }

  /** Upsert the config. An empty/omitted key keeps the stored one. */
  async updateSettings(dto: UpdateMapsGatewayDto): Promise<MapsGatewaySettings> {
    const current = await this.raw();
    const next: StoredMapsConfig = {
      enabled: dto.enabled ?? current.enabled,
      apiKey: dto.apiKey?.trim() ? dto.apiKey.trim() : current.apiKey,
      routingApiKey: dto.routingApiKey?.trim() ? dto.routingApiKey.trim() : current.routingApiKey,
    };
    await this.prisma.platformSetting.upsert({
      where: { key: MAPS_SETTING_KEY },
      create: { key: MAPS_SETTING_KEY, value: next as object },
      update: { value: next as object },
    });
    this.logger.log(`Maps provider updated (enabled=${next.enabled}, mapsKey=${!!next.apiKey}, routingKey=${!!next.routingApiKey})`);
    return { enabled: next.enabled, apiKeySet: !!next.apiKey, routingKeySet: !!next.routingApiKey };
  }

  /** What the web needs to boot Google Maps — key only when enabled AND set. */
  async runtime(): Promise<MapsRuntime> {
    const c = await this.raw();
    return { apiKey: c.enabled && c.apiKey ? c.apiKey : null };
  }

  /** Server-side ORS routing key (never sent to the browser). */
  async routingKey(): Promise<string | null> {
    return (await this.raw()).routingApiKey;
  }
}
