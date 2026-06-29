import { IsObject } from 'class-validator';

export class UpdateSettingsDto {
  /** Map of settingKey -> value. Only known catalog keys are accepted. */
  @IsObject()
  values!: Record<string, unknown>;
}
