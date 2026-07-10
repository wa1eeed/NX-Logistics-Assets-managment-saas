import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './integrations/storage/storage.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { OrgUnitsModule } from './modules/org-units/org-units.module';
import { AssetTypesModule } from './modules/asset-types/asset-types.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { AssetsModule } from './modules/assets/assets.module';
import { RentalsModule } from './modules/rentals/rentals.module';
import { HandoverModule } from './modules/handover/handover.module';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';
import { DisposalModule } from './modules/disposal/disposal.module';
import { AcquisitionModule } from './modules/acquisition/acquisition.module';
import { DriversModule } from './modules/drivers/drivers.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { KpisModule } from './modules/kpis/kpis.module';
import { LookupsModule } from './modules/lookups/lookups.module';
import { SettingsModule } from './modules/settings/settings.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { EntitlementsModule } from './modules/entitlements/entitlements.module';
import { BillingModule } from './modules/billing/billing.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { TrackingModule } from './modules/tracking/tracking.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { PlatformModule } from './modules/platform/platform.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { PreventiveModule } from './modules/preventive/preventive.module';
import { PublicModule } from './modules/public/public.module';
import { MapsModule } from './modules/maps/maps.module';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { ModuleAccessGuard } from './common/guards/module-access.guard';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { TenantContextInterceptor } from './common/tenant/tenant-context.interceptor';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // running cwd is apps/api; the single source of truth .env lives at repo root
      envFilePath: ['../../.env'],
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    StorageModule,
    AuditModule,
    AuthModule,
    UsersModule,
    RbacModule,
    OrgUnitsModule,
    AssetTypesModule,
    CatalogModule,
    AssetsModule,
    RentalsModule,
    HandoverModule,
    MaintenanceModule,
    DisposalModule,
    AcquisitionModule,
    DriversModule,
    NotificationsModule,
    KpisModule,
    LookupsModule,
    SettingsModule,
    DashboardModule,
    EntitlementsModule,
    BillingModule,
    PaymentsModule,
    InvoicesModule,
    TrackingModule,
    IntegrationsModule,
    PlatformModule,
    TenantModule,
    PreventiveModule,
    PublicModule,
    MapsModule,
  ],
  controllers: [HealthController],
  providers: [
    // Order matters: auth → throttle → permissions → module entitlement
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: ModuleAccessGuard },
    // Outermost interceptor: establish tenant context before anything queries the DB.
    { provide: APP_INTERCEPTOR, useClass: TenantContextInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
