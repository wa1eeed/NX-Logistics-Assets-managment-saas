-- AlterTable
ALTER TABLE "EquipmentRequest" ADD COLUMN     "refNo" TEXT;

-- AlterTable
ALTER TABLE "ExternalLeaseContract" ADD COLUMN     "refNo" TEXT;

-- AlterTable
ALTER TABLE "HandoverInspection" ADD COLUMN     "ip" TEXT,
ADD COLUMN     "signedById" TEXT,
ADD COLUMN     "signedByRole" TEXT;

-- AlterTable
ALTER TABLE "MaintenanceWorkOrder" ADD COLUMN     "refNo" TEXT;

-- AlterTable
ALTER TABLE "SaleOrder" ADD COLUMN     "refNo" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentRequest_refNo_key" ON "EquipmentRequest"("refNo");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalLeaseContract_refNo_key" ON "ExternalLeaseContract"("refNo");

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceWorkOrder_refNo_key" ON "MaintenanceWorkOrder"("refNo");

-- CreateIndex
CREATE UNIQUE INDEX "SaleOrder_refNo_key" ON "SaleOrder"("refNo");

