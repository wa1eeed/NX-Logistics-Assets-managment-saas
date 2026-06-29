-- DropIndex
DROP INDEX "Asset_code_key";

-- DropIndex
DROP INDEX "AssetClass_code_key";

-- DropIndex
DROP INDEX "AssetType_name_key";

-- DropIndex
DROP INDEX "EquipmentRequest_refNo_key";

-- DropIndex
DROP INDEX "ExternalLeaseContract_refNo_key";

-- DropIndex
DROP INDEX "Lookup_type_value_key";

-- DropIndex
DROP INDEX "MaintenanceWorkOrder_refNo_key";

-- DropIndex
DROP INDEX "Model_manufacturer_name_key";

-- DropIndex
DROP INDEX "RentalContract_authorizationNo_key";

-- DropIndex
DROP INDEX "SaleOrder_refNo_key";

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "code" TEXT NOT NULL DEFAULT 'TNT-0000';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "code" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Asset_tenantId_code_key" ON "Asset"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "AssetClass_tenantId_code_key" ON "AssetClass"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "AssetType_tenantId_name_key" ON "AssetType"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentRequest_tenantId_refNo_key" ON "EquipmentRequest"("tenantId", "refNo");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalLeaseContract_tenantId_refNo_key" ON "ExternalLeaseContract"("tenantId", "refNo");

-- CreateIndex
CREATE UNIQUE INDEX "Lookup_tenantId_type_value_key" ON "Lookup"("tenantId", "type", "value");

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceWorkOrder_tenantId_refNo_key" ON "MaintenanceWorkOrder"("tenantId", "refNo");

-- CreateIndex
CREATE UNIQUE INDEX "Model_tenantId_manufacturer_name_key" ON "Model"("tenantId", "manufacturer", "name");

-- CreateIndex
CREATE UNIQUE INDEX "RentalContract_tenantId_authorizationNo_key" ON "RentalContract"("tenantId", "authorizationNo");

-- CreateIndex
CREATE UNIQUE INDEX "SaleOrder_tenantId_refNo_key" ON "SaleOrder"("tenantId", "refNo");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_code_key" ON "Tenant"("code");

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_code_key" ON "User"("tenantId", "code");

