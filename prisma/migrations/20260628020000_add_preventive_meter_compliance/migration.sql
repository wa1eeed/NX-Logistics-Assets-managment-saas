-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "currentMeter" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "meterType" TEXT NOT NULL DEFAULT 'NONE',
ADD COLUMN     "meterUpdatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "VehicleDetail" ADD COLUMN     "insuranceExpiry" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "MeterReading" (
    "tenantId" TEXT,
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "note" TEXT,
    "recordedBy" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeterReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenancePlan" (
    "tenantId" TEXT,
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "intervalType" TEXT NOT NULL,
    "intervalValue" INTEGER NOT NULL,
    "lastServiceMeter" INTEGER,
    "lastServiceAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenancePlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MeterReading_assetId_idx" ON "MeterReading"("assetId");

-- CreateIndex
CREATE INDEX "MeterReading_tenantId_idx" ON "MeterReading"("tenantId");

-- CreateIndex
CREATE INDEX "MaintenancePlan_assetId_idx" ON "MaintenancePlan"("assetId");

-- CreateIndex
CREATE INDEX "MaintenancePlan_tenantId_idx" ON "MaintenancePlan"("tenantId");

-- AddForeignKey
ALTER TABLE "MeterReading" ADD CONSTRAINT "MeterReading_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenancePlan" ADD CONSTRAINT "MaintenancePlan_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

