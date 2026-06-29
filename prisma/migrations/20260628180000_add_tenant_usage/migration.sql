-- CreateTable: materialized per-tenant usage snapshot (seats + storage bytes)
CREATE TABLE "TenantUsage" (
    "tenantId" TEXT NOT NULL,
    "seatsUsed" INTEGER NOT NULL DEFAULT 0,
    "storageBytes" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantUsage_pkey" PRIMARY KEY ("tenantId")
);
