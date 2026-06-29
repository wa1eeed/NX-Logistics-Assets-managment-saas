import { BadRequestException, Injectable } from '@nestjs/common';
import { SETTING_DEFS, type SettingItem } from '@nx-lam/shared';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<SettingItem[]> {
    const rows = await this.prisma.setting.findMany();
    const valueByKey = new Map(rows.map((r) => [r.key, r.value]));

    return SETTING_DEFS.map((def) => ({
      key: def.key,
      value: valueByKey.has(def.key) ? valueByKey.get(def.key) : def.defaultValue,
      group: def.group,
      labelEn: def.labelEn,
      labelAr: def.labelAr,
      descriptionEn: def.descriptionEn,
      descriptionAr: def.descriptionAr,
    }));
  }

  async update(values: Record<string, unknown>, actorId?: string): Promise<SettingItem[]> {
    const known = new Map(SETTING_DEFS.map((d) => [d.key, d]));
    const keys = Object.keys(values);
    const unknown = keys.filter((k) => !known.has(k));
    if (unknown.length) {
      throw new BadRequestException(`Unknown setting keys: ${unknown.join(', ')}`);
    }

    await this.prisma.$transaction(
      keys.map((key) => {
        const def = known.get(key)!;
        const value = values[key] as object;
        return this.prisma.setting.upsert({
          where: { key },
          create: { key, value, group: def.group, updatedBy: actorId ?? null },
          update: { value, updatedBy: actorId ?? null },
        });
      }),
    );

    return this.list();
  }
}
