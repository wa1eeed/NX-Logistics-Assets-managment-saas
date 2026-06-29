import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { currentTenantId, TENANT_MODELS } from '../common/tenant/tenant-context';

const READ_ACTIONS = ['findFirst', 'findFirstOrThrow', 'findMany', 'count', 'aggregate', 'groupBy', 'updateMany', 'deleteMany'];

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super();
    // Multi-tenant isolation: scope every query on a tenant-owned model to the
    // current request's tenant (set by TenantContextInterceptor). No context
    // (seed, public routes) → no scoping.
    this.$use(async (params, next) => {
      const tenantId = currentTenantId();
      const model = params.model;
      if (!tenantId || !model || !TENANT_MODELS.has(model)) return next(params);

      const action = params.action;
      if (READ_ACTIONS.includes(action)) {
        params.args = params.args ?? {};
        params.args.where = { AND: [params.args.where ?? {}, { tenantId }] };
      } else if (action === 'findUnique' || action === 'findUniqueOrThrow') {
        params.action = action === 'findUnique' ? 'findFirst' : 'findFirstOrThrow';
        params.args = params.args ?? {};
        params.args.where = { AND: [params.args.where ?? {}, { tenantId }] };
      } else if (action === 'create') {
        params.args.data = { ...params.args.data, tenantId };
      } else if (action === 'createMany') {
        const d = params.args.data;
        params.args.data = Array.isArray(d) ? d.map((x: Record<string, unknown>) => ({ ...x, tenantId })) : { ...d, tenantId };
      } else if (action === 'update' || action === 'delete') {
        params.args.where = { ...params.args.where, tenantId }; // extendedWhereUnique
      } else if (action === 'upsert') {
        params.args.where = { ...params.args.where, tenantId };
        params.args.create = { ...params.args.create, tenantId };
      }
      return next(params);
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Prisma connected (tenant-scoping middleware active)');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
