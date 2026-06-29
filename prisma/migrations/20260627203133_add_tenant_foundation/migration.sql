-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "AssetClass" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "AssetType" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Driver" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "EquipmentRequest" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "ExternalLeaseContract" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "HandoverInspection" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Lookup" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "MaintenanceCard" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "MaintenanceWorkOrder" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Model" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "OrgUnit" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "RentalContract" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "SaleOrder" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Setting" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "UserRole" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "VehicleDetail" ADD COLUMN     "tenantId" TEXT;

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE INDEX "Asset_tenantId_idx" ON "Asset"("tenantId");

-- CreateIndex
CREATE INDEX "AssetClass_tenantId_idx" ON "AssetClass"("tenantId");

-- CreateIndex
CREATE INDEX "AssetType_tenantId_idx" ON "AssetType"("tenantId");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_idx" ON "AuditLog"("tenantId");

-- CreateIndex
CREATE INDEX "Document_tenantId_idx" ON "Document"("tenantId");

-- CreateIndex
CREATE INDEX "Driver_tenantId_idx" ON "Driver"("tenantId");

-- CreateIndex
CREATE INDEX "EquipmentRequest_tenantId_idx" ON "EquipmentRequest"("tenantId");

-- CreateIndex
CREATE INDEX "ExternalLeaseContract_tenantId_idx" ON "ExternalLeaseContract"("tenantId");

-- CreateIndex
CREATE INDEX "HandoverInspection_tenantId_idx" ON "HandoverInspection"("tenantId");

-- CreateIndex
CREATE INDEX "Lookup_tenantId_idx" ON "Lookup"("tenantId");

-- CreateIndex
CREATE INDEX "MaintenanceCard_tenantId_idx" ON "MaintenanceCard"("tenantId");

-- CreateIndex
CREATE INDEX "MaintenanceWorkOrder_tenantId_idx" ON "MaintenanceWorkOrder"("tenantId");

-- CreateIndex
CREATE INDEX "Model_tenantId_idx" ON "Model"("tenantId");

-- CreateIndex
CREATE INDEX "OrgUnit_tenantId_idx" ON "OrgUnit"("tenantId");

-- CreateIndex
CREATE INDEX "RentalContract_tenantId_idx" ON "RentalContract"("tenantId");

-- CreateIndex
CREATE INDEX "SaleOrder_tenantId_idx" ON "SaleOrder"("tenantId");

-- CreateIndex
CREATE INDEX "Setting_tenantId_idx" ON "Setting"("tenantId");

-- CreateIndex
CREATE INDEX "Supplier_tenantId_idx" ON "Supplier"("tenantId");

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- CreateIndex
CREATE INDEX "UserRole_tenantId_idx" ON "UserRole"("tenantId");

-- CreateIndex
CREATE INDEX "VehicleDetail_tenantId_idx" ON "VehicleDetail"("tenantId");

