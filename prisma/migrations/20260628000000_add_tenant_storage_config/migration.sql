-- CreateTable
CREATE TABLE "TenantStorageConfig" (
    "tenantId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'SHARED',
    "provider" TEXT NOT NULL DEFAULT 'R2',
    "endpoint" TEXT,
    "accessKeyId" TEXT,
    "secretAccessKey" TEXT,
    "bucket" TEXT,
    "region" TEXT,
    "publicBaseUrl" TEXT,
    "ttl" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantStorageConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TenantStorageConfig_tenantId_key" ON "TenantStorageConfig"("tenantId");

-- CreateIndex
CREATE INDEX "TenantStorageConfig_tenantId_idx" ON "TenantStorageConfig"("tenantId");

